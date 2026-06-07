import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogPayload {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /** Grava log de auditoria de forma assíncrona (não bloqueia a resposta) */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          userEmail: payload.userEmail,
          action: payload.action,
          entity: payload.entity,
          entityId: payload.entityId,
          // VULN-012: nunca logar dados sensíveis (senhas, tokens, CPF completo)
          meta: payload.meta ? (this.sanitizeMeta(payload.meta) as object) : undefined,
          ip: payload.ip,
          userAgent: payload.userAgent?.slice(0, 255),
        },
      });
    } catch (err) {
      // Falha no audit log nunca deve quebrar a requisição
      this.logger.error('Falha ao gravar audit log', err);
    }
  }

  /** Remove campos sensíveis antes de persistir */
  private sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const BLOCKED = new Set([
      'password', 'senha', 'token', 'accessToken', 'refreshToken',
      'secret', 'cpf', 'cvv', 'cardNumber',
    ]);
    return Object.fromEntries(
      Object.entries(meta).filter(([k]) => !BLOCKED.has(k.toLowerCase())),
    );
  }

  /** Busca logs de auditoria do tenant (paginado) */
  async find(tenantId: string, opts: { page?: number; limit?: number; action?: string; userId?: string }) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(opts.action ? { action: { contains: opts.action } } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
