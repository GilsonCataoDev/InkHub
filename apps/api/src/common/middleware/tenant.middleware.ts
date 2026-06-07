import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolve o tenant a partir de:
 * 1. Header X-Tenant-ID (prioridade, usado pelo frontend)
 * 2. Subdomínio da requisição (ex: studio1.inkhub.app → slug "studio1")
 *
 * Preenche `req.tenantId` para uso nos guards/decorators.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  // UUID v4 regex — garante que só UUIDs válidos são aceitos como tenantId
  private readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  async use(req: Request & { tenantId?: string }, _res: Response, next: NextFunction) {
    // 1. Header explícito (frontend SPA / mobile)
    // VULN-001 / VULN-003: query param ?tenantId= removido — só header aceito aqui.
    // O TenantGuard valida consistência com o JWT logo após.
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId) {
      // Rejeitar qualquer coisa que não seja um UUID — previne injection/manipulação
      if (!this.UUID_RE.test(headerTenantId)) {
        return next(); // ignora header inválido; TenantGuard vai rejeitar se necessário
      }
      req.tenantId = headerTenantId;
      return next();
    }

    // 2. Subdomínio
    const host = (req.headers['host'] ?? '').split(':')[0];
    const appDomain = process.env['NEXT_PUBLIC_APP_DOMAIN'] ?? 'inkhub.app';
    if (host.endsWith(`.${appDomain}`)) {
      const slug = host.replace(`.${appDomain}`, '');
      if (slug && slug !== 'www' && slug !== 'api') {
        const tenant = await this.prisma.tenant.findFirst({
          where: { slug, active: true, deletedAt: null },
          select: { id: true },
        });
        if (tenant) {
          req.tenantId = tenant.id;
          return next();
        }
      }
    }

    next();
  }
}
