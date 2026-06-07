import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';
import { CafeService } from './cafe.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Cafe')
@ApiBearerAuth()
@Controller('cafe')
export class CafeController {
  constructor(private service: CafeService) {}

  @Get('menu')
  @ApiOperation({ summary: 'Cardápio por categoria' })
  getMenu(@TenantId() tenantId: string) {
    return this.service.getMenu(tenantId);
  }

  @Post('menu/items')
  @ApiOperation({ summary: 'Adicionar item ao cardápio' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA)
  createItem(@TenantId() tenantId: string, @Body() dto: {
    name: string; price: number; categoryId?: string; description?: string;
  }) {
    return this.service.createItem(tenantId, dto);
  }

  @Put('menu/items/:id')
  @ApiOperation({ summary: 'Atualizar item do cardápio' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA)
  updateItem(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { available?: boolean; price?: number; name?: string },
  ) {
    return this.service.updateItem(id, tenantId, dto);
  }

  @Delete('menu/items/:id')
  @ApiOperation({ summary: 'Remover item do cardápio' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deleteItem(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.deleteItem(id, tenantId);
  }

  @Get('tables')
  @ApiOperation({ summary: 'Status de todas as mesas' })
  getTables(@TenantId() tenantId: string) {
    return this.service.getTables(tenantId);
  }

  @Put('tables/:id/status')
  @ApiOperation({ summary: 'Atualizar status da mesa' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA, UserRole.RECEPTIONIST)
  updateTableStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('status') status: TableStatus,
  ) {
    return this.service.updateTableStatus(id, tenantId, status);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Abrir comanda para mesa' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA, UserRole.RECEPTIONIST)
  openOrder(
    @TenantId() tenantId: string,
    @Body() dto: { tableId: string; notes?: string },
  ) {
    return this.service.openOrder(dto.tableId, tenantId, dto.notes);
  }

  @Post('orders/:id/items')
  @ApiOperation({ summary: 'Adicionar item à comanda' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA, UserRole.RECEPTIONIST)
  addItem(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { cafeItemId?: string; quantity: number; notes?: string },
  ) {
    return this.service.addItem(id, tenantId, dto);
  }

  @Post('orders/:id/close')
  @ApiOperation({ summary: 'Fechar comanda' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BARISTA, UserRole.RECEPTIONIST)
  closeOrder(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('paymentMethod') paymentMethod: string,
  ) {
    return this.service.closeOrder(id, tenantId, paymentMethod);
  }
}
