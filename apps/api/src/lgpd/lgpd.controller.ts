import {
  Controller, Delete, Get, Param, Req, HttpCode, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { UserRole } from '@prisma/client';
import { LgpdService } from './lgpd.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../audit/audit.interceptor';

interface AuthRequest extends Request {
  tenantId: string;
  user: { id: string; role: UserRole };
}

@ApiTags('LGPD')
@ApiBearerAuth()
@Controller('lgpd')
export class LgpdController {
  constructor(private readonly service: LgpdService) {}

  /**
   * LGPD Art. 18, V — Portabilidade de dados
   * Retorna JSON com todos os dados pessoais do cliente.
   */
  @Get('clients/:id/export')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Audit('lgpd.export', 'Client')
  @ApiOperation({ summary: 'Exportar dados pessoais do cliente (LGPD)' })
  async export(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const data = await this.service.exportData(id, req.tenantId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dados-cliente-${id}-${Date.now()}.json"`,
    );
    return res.json(data);
  }

  /**
   * LGPD Art. 18, VII — Direito ao esquecimento
   * Anonimiza todos os dados pessoais do cliente.
   */
  @Delete('clients/:id/forget')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @Audit('lgpd.forget', 'Client')
  @ApiOperation({ summary: 'Anonimizar dados pessoais do cliente (LGPD esquecimento)' })
  forgetMe(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.forgetMe(id, req.tenantId);
  }
}
