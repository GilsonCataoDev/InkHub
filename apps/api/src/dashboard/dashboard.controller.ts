import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Dados gerais do dashboard' })
  getOverview(@TenantId() tenantId: string) {
    return this.service.getOverview(tenantId);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Receita diária (últimos N dias)' })
  getRevenueChart(
    @TenantId() tenantId: string,
    @Query('days') days = 30,
  ) {
    return this.service.getRevenueChart(tenantId, Number(days));
  }
}
