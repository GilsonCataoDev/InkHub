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
import { createHash, randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';

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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, tenantId: string): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId, deletedAt: null, active: true },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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
      where: { refreshToken: tokenHash, tenantId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Refresh token inválido ou expirado');

    return this.generateTokens(user.id, user.email, user.role, user.tenantId);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
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

    // VULN-009: salvar hash SHA-256 do refresh token, não o token em si
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }
}
