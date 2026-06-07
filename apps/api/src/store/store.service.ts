import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockMovementType } from '@prisma/client';

interface CreateProductDto {
  name: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  categoryId?: string;
  supplierId?: string;
  description?: string;
  unit?: string;
  minStock?: number;
}

interface UpdateProductDto extends Partial<CreateProductDto> {
  active?: boolean;
}

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, categoryId?: string, search?: string, lowStock?: boolean) {
    const where = {
      tenantId,
      deletedAt: null,
      active: true,
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (lowStock) return products.filter((p) => p.stock <= p.minStock);
    return products;
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        supplier: true,
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(dto: CreateProductDto, tenantId: string) {
    return this.prisma.product.create({ data: { tenantId, ...dto } });
  }

  async update(id: string, dto: UpdateProductDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addStock(productId: string, tenantId: string, dto: {
    type: StockMovementType; quantity: number; reason?: string; unitCost?: number;
  }) {
    const product = await this.findOne(productId, tenantId);

    const addTypes: StockMovementType[] = [
      StockMovementType.PURCHASE,
      StockMovementType.RETURN,
      StockMovementType.ADJUSTMENT,
    ];
    const delta = addTypes.includes(dto.type) ? dto.quantity : -dto.quantity;

    return this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
      }),
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          productId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          unitCost: dto.unitCost ?? product.costPrice,
        },
      }),
    ]);
  }

  async getCategories(tenantId: string) {
    return this.prisma.category.findMany({ where: { tenantId, deletedAt: null } });
  }

  async createCategory(tenantId: string, name: string) {
    return this.prisma.category.create({ data: { tenantId, name } });
  }

  async getSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({ where: { tenantId, deletedAt: null } });
  }

  async createSupplier(tenantId: string, dto: {
    name: string; email?: string; phone?: string; cnpj?: string; notes?: string;
  }) {
    return this.prisma.supplier.create({ data: { tenantId, ...dto } });
  }

  async getLowStockAlerts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null, active: true },
      include: { category: { select: { name: true } } },
    });
    return products.filter((p) => p.stock <= p.minStock);
  }
}
