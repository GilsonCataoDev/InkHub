import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('crm')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class CrmController {
  constructor(private service: CrmService) {}

  @Get('birthdays')
  @ApiOperation({ summary: 'Clientes aniversariantes do mês' })
  getBirthdays(@TenantId() tenantId: string) {
    return this.service.getBirthdaysThisMonth(tenantId);
  }

  @Get('inactive')
  @ApiOperation({ summary: 'Clientes inativos há X dias' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getInactive(@TenantId() tenantId: string, @Query('days') days?: number) {
    return this.service.getInactiveClients(tenantId, days ? Number(days) : 60);
  }

  @Get('top-spenders')
  @ApiOperation({ summary: 'Clientes que mais gastaram' })
  getTopSpenders(@TenantId() tenantId: string) {
    return this.service.getTopSpenders(tenantId);
  }

  @Get('clients/:id/timeline')
  @ApiOperation({ summary: 'Timeline de interações do cliente' })
  getTimeline(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getClientTimeline(id, tenantId);
  }

  @Post('clients/:id/interactions')
  @ApiOperation({ summary: 'Registrar interação com cliente' })
  createInteraction(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { type: string; description: string },
  ) {
    return this.service.createInteraction(id, tenantId, dto.type, dto.description, user.sub);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Listar campanhas' })
  getCampaigns(@TenantId() tenantId: string) {
    return this.service.getCampaigns(tenantId);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Criar campanha de e-mail' })
  createCampaign(
    @TenantId() tenantId: string,
    @Body() dto: { name: string; subject: string; body: string; segment: string },
  ) {
    return this.service.createCampaign(tenantId, dto);
  }
}
