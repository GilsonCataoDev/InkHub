import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';

export const AUDIT_ACTION_KEY = 'audit:action';
export const AUDIT_ENTITY_KEY = 'audit:entity';

/**
 * Decorador para marcar endpoints que devem ser auditados.
 *
 * @example
 * @Audit('user.delete', 'User')
 */
export const Audit = (action: string, entity?: string) =>
  (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    if (entity) Reflect.defineMetadata(AUDIT_ENTITY_KEY, entity, descriptor.value);
    return descriptor;
  };

interface AuthRequest extends Request {
  tenantId?: string;
  user?: { sub: string; email: string; tenantId?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private audit: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, ctx.getHandler());
    if (!action) return next.handle(); // só audita endpoints decorados

    const req = ctx.switchToHttp().getRequest<AuthRequest>();

    return next.handle().pipe(
      tap(() => {
        // Executa após resposta bem-sucedida (não audita falhas — o ExceptionFilter já loga)
        const tenantId = req.tenantId ?? req.user?.['tenantId'];
        if (!tenantId) return;

        const entity = this.reflector.get<string>(AUDIT_ENTITY_KEY, ctx.getHandler());

        void this.audit.log({
          tenantId,
          userId: req.user?.sub,
          userEmail: req.user?.email,
          action,
          entity,
          entityId: (req.params as Record<string, string>)?.['id'],
          ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }),
    );
  }
}
