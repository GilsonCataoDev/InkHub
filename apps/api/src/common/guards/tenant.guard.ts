import {
  Injectable, CanActivate, ExecutionContext,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(), context.getClass(),
    ]);

    if (skipTenant) return true;

    const request = context.switchToHttp().getRequest<Request & { tenantId?: string; user?: JwtPayload }>();

    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
    const jwtTenantId    = request.user?.tenantId;

    // ── Segurança: header deve ser consistente com o JWT ─────────────────────
    // Se o usuário está autenticado E enviou X-Tenant-ID, os dois DEVEM bater.
    // Isso previne que um usuário do Tenant A envie X-Tenant-ID do Tenant B
    // para acessar dados de outro tenant (VULN-001).
    if (jwtTenantId && headerTenantId && headerTenantId !== jwtTenantId) {
      throw new ForbiddenException('X-Tenant-ID incompatível com o token de autenticação');
    }

    // JWT tem prioridade; header só é usado para rotas públicas (sem JWT)
    const tenantId = jwtTenantId ?? headerTenantId;

    if (!tenantId) {
      if (isPublic) return true;
      throw new BadRequestException('Tenant não identificado');
    }

    request.tenantId = tenantId;
    return true;
  }
}
