import { Controller, Post, Get, Param, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ConsentService } from './consent.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('Consent')
@ApiBearerAuth()
@Controller('clients/:clientId/consent')
export class ConsentController {
  constructor(private service: ConsentService) {}

  @Post('sign')
  @ApiOperation({ summary: 'Assinar termo de consentimento digital (gera PDF)' })
  sign(
    @Param('clientId') clientId: string,
    @TenantId() tenantId: string,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ?? req.socket.remoteAddress ?? '0.0.0.0';
    const ua = req.headers['user-agent'];
    return this.service.sign(clientId, tenantId, ip, ua);
  }

  @Get()
  @ApiOperation({ summary: 'Listar termos assinados do cliente' })
  getConsents(@Param('clientId') clientId: string, @TenantId() tenantId: string) {
    return this.service.getConsents(clientId, tenantId);
  }
}
