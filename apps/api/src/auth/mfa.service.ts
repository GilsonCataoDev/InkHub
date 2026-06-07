/**
 * VULN-014 — MFA TOTP para ADMIN e MANAGER
 * Usa otplib v13 (RFC 6238 / Google Authenticator compatível)
 */
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

// Chave AES-256 para criptografar o segredo TOTP em repouso
function getEncKey(): Buffer {
  const raw = process.env['MFA_ENCRYPTION_KEY'] ?? '';
  if (raw.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY deve ter ao menos 32 caracteres');
  }
  return Buffer.from(raw.slice(0, 32), 'utf-8');
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getEncKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(stored: string): string {
  const [ivHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', getEncKey(), iv);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf-8');
}

function totpVerify(token: string, secret: string): boolean {
  const result = verifySync({ token, secret });
  return typeof result === 'object' ? result.valid : Boolean(result);
}

@Injectable()
export class MfaService {
  constructor(private prisma: PrismaService) {}

  /** Gera segredo TOTP e retorna QR code data-URL para o usuário escanear */
  async setupMfa(userId: string, tenantId: string): Promise<{ qrCode: string; secret: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, active: true },
      select: { id: true, email: true, role: true, mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedException();
    if (!([UserRole.ADMIN, UserRole.MANAGER] as string[]).includes(user.role)) {
      throw new ForbiddenException('MFA disponível apenas para ADMIN e MANAGER');
    }
    if (user.mfaEnabled) throw new BadRequestException('MFA já está ativo nesta conta');

    const secret = generateSecret();
    const otpAuthUrl = generateURI({ label: user.email, issuer: 'InkHub', secret });
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    // Salva o segredo criptografado — ainda não habilita (aguarda verificação)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptSecret(secret) },
    });

    return { qrCode, secret };
  }

  /** Verifica o TOTP e habilita o MFA permanentemente */
  async enableMfa(userId: string, tenantId: string, token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaSecret) throw new BadRequestException('Execute /auth/mfa/setup primeiro');
    if (user.mfaEnabled) throw new BadRequestException('MFA já está ativo');

    const secret = decryptSecret(user.mfaSecret);
    if (!totpVerify(token, secret)) {
      throw new UnauthorizedException('Código TOTP inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { message: 'MFA ativado com sucesso' };
  }

  /** Desativa o MFA (requer código TOTP atual para confirmar identidade) */
  async disableMfa(userId: string, tenantId: string, token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaEnabled || !user?.mfaSecret) {
      throw new BadRequestException('MFA não está ativo');
    }

    const secret = decryptSecret(user.mfaSecret);
    if (!totpVerify(token, secret)) {
      throw new UnauthorizedException('Código TOTP inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return { message: 'MFA desativado' };
  }

  /** Valida TOTP durante o fluxo de login (chamado após autenticação de senha) */
  verifyToken(encryptedSecret: string, token: string): boolean {
    const secret = decryptSecret(encryptedSecret);
    return totpVerify(token, secret);
  }
}
