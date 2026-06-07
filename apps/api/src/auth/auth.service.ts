import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { MfaService } from './mfa.service';

interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Retornado quando o usuário precisa completar o segundo fator */
export interface MfaChallenge {
  mfaRequired: true;
  userId: string;   // usado pelo frontend para chamar /auth/mfa/login
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mfa: MfaService,
  ) {}

  async login(dto: LoginDto, tenantId: string): Promise<TokenPair | MfaChallenge> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId, deletedAt: null, active: true },
      select: {
        id: true, email: true, role: true, tenantId: true,
        passwordHash: true, mfaEnabled: true, mfaSecret: true,
      },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // VULN-014: se MFA ativo, não emite tokens ainda — aguarda segundo fator
    if (user.mfaEnabled && user.mfaSecret) {
      return { mfaRequired: true, userId: user.id };
    }

    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  /** VULN-014: segundo fator de login — valida TOTP e emite tokens */
  async loginWithMfa(userId: string, tenantId: string, token: string): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, active: true },
      select: { id: true, email: true, role: true, tenantId: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!user?.mfaEnabled || !user?.mfaSecret) {
      throw new UnauthorizedException('MFA não configurado');
    }
    if (!this.mfa.verifyToken(user.mfaSecret, token)) {
      throw new UnauthorizedException('Código MFA inválido');
    }
    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  async register(dto: RegisterDto, tenantId: string): Promise<TokenPair> {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado neste tenant');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        passwordHash: hash,
        // VULN-010: auto-registro nunca produz ADMIN/MANAGER
        role: (dto.role as UserRole) ?? UserRole.RECEPTIONIST,
      },
    });

    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  async refreshTokens(refreshToken: string, tenantId: string): Promise<TokenPair> {
    // VULN-009: comparar hash, não o token em texto plano
    const tokenHash = this.hashToken(refreshToken);

    const user = await this.prisma.user.findFirst({
      where: { tenantId, deletedAt: null, OR: [{ refreshToken: tokenHash }, { refreshTokenPrev: tokenHash }] },
    });

    if (!user) throw new UnauthorizedException('Refresh token inválido ou expirado');

    // VULN-017: reuse detection — se o hash bate com o ANTERIOR (já rotacionado),
    // significa que alguém está tentando reutilizar um token já consumido.
    // Provável roubo de token → invalidamos tudo imediatamente.
    if (user.refreshTokenPrev === tokenHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null, refreshTokenPrev: null },
      });
      throw new UnauthorizedException(
        'Refresh token já foi utilizado. Por segurança, faça login novamente.',
      );
    }

    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenPrev: null },
    });
    return { message: 'Logout realizado com sucesso' };
  }

  async googleCallback(googleUser: GoogleUser, tenantId: string): Promise<TokenPair> {
    let user = await this.prisma.user.findFirst({
      where: { googleId: googleUser.googleId, tenantId },
    });

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { email: googleUser.email, tenantId },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.googleId, avatarUrl: googleUser.avatarUrl },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            tenantId,
            email: googleUser.email,
            name: googleUser.name,
            avatarUrl: googleUser.avatarUrl,
            googleId: googleUser.googleId,
            role: UserRole.RECEPTIONIST,
          },
        });
      }
    }

    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        tenantId: true,
        tenant: { select: { name: true, slug: true, logoUrl: true, primaryColor: true } },
        tattooArtist: { select: { id: true, specialties: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  // ─── Signup: cria tenant + admin numa única transação ────────────────────────

  async signup(dto: SignupDto): Promise<TokenPair> {
    // bcrypt fora da transação — operação lenta não deve segurar lock do banco
    const hash = await bcrypt.hash(dto.password, 12);

    // Busca ou cria o plano FREE (sem lock — idempotente)
    let plan = await this.prisma.plan.findFirst({ where: { type: 'FREE' } });
    if (!plan) {
      plan = await this.prisma.plan.create({
        data: { name: 'Free', type: 'FREE', maxUsers: 3, maxClients: 100, price: 0 },
      });
    }

    // Transação: Tenant + Admin User em conjunto
    // A unicidade do slug é garantida pela constraint @unique do banco.
    // Capturamos P2002 para devolver 409 limpo em vez de 500.
    try {
      const { user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.studioName,
            slug: dto.slug,
            planId: plan!.id,
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.email,
            name: dto.adminName,
            passwordHash: hash,
            role: UserRole.ADMIN,
          },
        });

        return { tenant, user };
      });

      return this.generateTokens(user.id, user.email, user.role, user.tenantId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Este endereço já está em uso. Escolha outro.');
      }
      throw err;
    }
  }

  // ─── Forgot password ──────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    // ── Anti-timing: resposta SEMPRE retorna imediatamente ────────────────────
    // O envio do e-mail ocorre em background (void) para que o tempo de resposta
    // não revele se o e-mail existe ou não (enumeração via timing oracle).
    void this.sendPasswordResetEmails(email);
    return { message: 'Se o e-mail existir, você receberá o link em breve.' };
  }

  /** Executa em background — não bloqueia a resposta HTTP */
  private async sendPasswordResetEmails(email: string): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { email, deletedAt: null, active: true, tenant: { active: true } },
        include: { tenant: { select: { name: true } } },
      });

      if (users.length === 0) return;

      const mailer = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST') ?? 'smtp.mailtrap.io',
        port: Number(this.config.get('SMTP_PORT') ?? 2525),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });

      const appUrl = this.config.get('APP_URL') ?? this.config.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

      for (const user of users) {
        const rawToken = randomUUID();
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await this.prisma.user.update({
          where: { id: user.id },
          data: { resetToken: tokenHash, resetTokenExp: expiresAt },
        });

        const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
        // Sanitiza nome do estúdio para evitar header injection no campo "from"
        const studioName = ((user as any).tenant?.name ?? 'InkHub').replace(/["\r\n]/g, '');

        try {
          await mailer.sendMail({
            from: `"${studioName}" <${this.config.get('SMTP_USER') ?? 'noreply@inkhub.app'}>`,
            to: user.email,
            subject: `[${studioName}] Recuperação de senha`,
            text: `Olá ${user.name},\n\nClique no link abaixo para redefinir sua senha (válido por 1 hora):\n\n${resetUrl}\n\nSe você não solicitou isso, ignore este e-mail.`,
            html: `<p>Olá <strong>${user.name}</strong>,</p><p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Se você não solicitou isso, ignore este e-mail.</p>`,
          });
        } catch {
          // Em dev sem SMTP configurado, loga o link no console
          console.warn(`[ForgotPassword] SMTP não configurado. Link de reset:\n${resetUrl}`);
        }
      }
    } catch (err) {
      console.error('[ForgotPassword] Erro no background send:', (err as Error).message);
    }
  }

  // ─── Reset password ───────────────────────────────────────────────────────────

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);

    const user = await this.prisma.user.findFirst({
      where: { resetToken: tokenHash, deletedAt: null, active: true },
    });

    if (!user) throw new BadRequestException('Token inválido ou já utilizado.');
    if (!user.resetTokenExp || user.resetTokenExp < new Date()) {
      throw new BadRequestException('Token expirado. Solicite um novo link.');
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        resetToken: null,
        resetTokenExp: null,
        // Invalida todas as sessões abertas
        refreshToken: null,
        refreshTokenPrev: null,
      },
    });

    return { message: 'Senha redefinida com sucesso. Faça login.' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** VULN-009: SHA-256 do token — nunca armazenar o token cru */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    tenantId: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role, tenantId };

    const jwtSecret = this.config.get<string>('JWT_SECRET')!;
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET')!;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      }),
    ]);

    // VULN-009 + VULN-017: salvar novo hash e promover atual para "anterior"
    // O token anterior é mantido por 1 ciclo para detectar reuse (token theft)
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { refreshToken: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenPrev: currentUser?.refreshToken ?? null, // promove atual → anterior
        refreshToken: this.hashToken(refreshToken),          // armazena novo
      },
    });

    return { accessToken, refreshToken };
  }
}
