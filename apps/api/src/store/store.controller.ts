import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { StoreService } from './store.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Store')
@ApiBearerAuth()
@Controller('store')
export class StoreController {
  constructor(private service: StoreService) {}

  @Get('products')
  @ApiOperation({ summary: 'Listar produtos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  findAll(
    @TenantId() tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.service.findAll(tenantId, categoryId, search, lowStock === 'true');
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Detalhes do produto' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post('products')
  @ApiOperation({ summary: 'Criar produto' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_KEEPER)
  create(
    @Body() dto: { name: string; sku: string; costPrice: number; salePrice: number; categoryId?: string },
    @TenantId() tenantId: string,
  ) {
    return this.service.create(dto, tenantId);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Atualizar produto' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_KEEPER)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; salePrice?: number; active?: boolean },
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Remover produto' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }

  @Post('products/:id/stock')
  @ApiOperation({ summary: 'Registrar movimentação de estoque' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_KEEPER)
  addStock(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { type: StockMovementType; quantity: number; reason?: string; unitCost?: number },
  ) {
    return this.service.addStock(id, tenantId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorias' })
  getCategories(@TenantId() tenantId: string) {
    return this.service.getCategories(tenantId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Criar categoria' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_KEEPER)
  createCategory(@TenantId() tenantId: string, @Body('name') name: string) {
    return this.service.createCategory(tenantId, name);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Listar fornecedores' })
  getSuppliers(@TenantId() tenantId: string) {
    return this.service.getSuppliers(tenantId);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Cadastrar fornecedor' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_KEEPER)
  createSupplier(
    @TenantId() tenantId: string,
    @Body() dto: { name: string; email?: string; phone?: string; cnpj?: string },
  ) {
    return this.service.createSupplier(tenantId, dto);
  }
}
