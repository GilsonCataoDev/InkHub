import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CashFlowType, InvoiceType, InvoiceStatus } from '@prisma/client';
import { FinancialService } from './financial.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Financial')
@ApiBearerAuth()
@Controller('financial')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class FinancialController {
  constructor(private service: FinancialService) {}

  @Get('cash-flow')
  @ApiOperation({ summary: 'Fluxo de caixa por período' })
  @ApiQuery({ name: 'startDate', required: true, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2025-01-31' })
  getCashFlow(
    @TenantId() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getCashFlow(tenantId, startDate, endDate);
  }

  @Post('cash-flow')
  @ApiOperation({ summary: 'Registrar entrada ou saída' })
  createEntry(
    @TenantId() tenantId: string,
    @Body() dto: {
      type: CashFlowType; amount: number; category: string;
      description: string; date?: string;
    },
  ) {
    return this.service.createCashFlowEntry(tenantId, dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Contas a pagar/receber' })
  @ApiQuery({ name: 'type', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  getInvoices(
    @TenantId() tenantId: string,
    @Query('type') type?: InvoiceType,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.service.getInvoices(tenantId, type, status);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Criar conta a pagar ou receber' })
  createInvoice(
    @TenantId() tenantId: string,
    @Body() dto: {
      type: InvoiceType; description: string; amount: number;
      dueDate: string; category?: string;
    },
  ) {
    return this.service.createInvoice(tenantId, dto);
  }

  @Post('invoices/:id/pay')
  @ApiOperation({ summary: 'Marcar fatura como paga' })
  payInvoice(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('paidAmount') paidAmount: number,
  ) {
    return this.service.payInvoice(id, tenantId, paidAmount);
  }

  @Get('dre')
  @ApiOperation({ summary: 'DRE simplificado mensal' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  getDRE(
    @TenantId() tenantId: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.service.getDRE(tenantId, Number(month), Number(year));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo do dashboard financeiro' })
  getSummary(@TenantId() tenantId: string) {
    return this.service.getDashboardSummary(tenantId);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Exportar fluxo de caixa em CSV' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  exportCsv(
    @TenantId() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    return this.service.exportCsv(tenantId, startDate, endDate, res);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Exportar DRE em PDF' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  exportPdf(
    @TenantId() tenantId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
  ) {
    return this.service.exportPdf(tenantId, Number(month), Number(year), res);
  }
}
