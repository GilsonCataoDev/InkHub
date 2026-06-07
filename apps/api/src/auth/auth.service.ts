import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { UserRole } from '@prisma/client';
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
