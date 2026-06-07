import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    // VULN-004: falhar na inicialização se JWT_SECRET não estiver configurado
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        'JWT_SECRET ausente ou muito curto (mínimo 32 caracteres). ' +
        'Configure a variável de ambiente antes de iniciar a aplicação.',
      );
    }

    super({
      // VULN-007: cookie httpOnly tem prioridade; Authorization header como fallback
      // (mantém compatibilidade com clientes mobile/API que usam Bearer)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => (req?.cookies as Record<string, string> | undefined)?.['access_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, active: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return payload;
  }
}
