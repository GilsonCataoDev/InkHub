import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TableStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class CafeService {
  constructor(private prisma: PrismaService) {}

  // ─── Menu ────────────────────────────────────────────────────────────────────
  async getMenu(tenantId: string) {
    return this.prisma.cafeCategory.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        items: {
          where: { tenantId, deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createItem(tenantId: string, dto: {
    name: string; price: number; categoryId?: string;
    description?: string; imageUrl?: string; stock?: number; minStock?: number;
  }) {
    return this.prisma.cafeItem.create({ data: { tenantId, ...dto } });
  }

  async updateItem(id: string, tenantId: string, dto: Partial<{
    name: string; price: number; available: boolean; description: string;
  }>) {
    const item = await this.prisma.cafeItem.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.cafeItem.update({ where: { id }, data: dto });
  }

  async deleteItem(id: string, tenantId: string) {
    const item = await this.prisma.cafeItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return this.prisma.cafeItem.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ─── Tables ──────────────────────────────────────────────────────────────────
  async getTables(tenantId: string) {
    return this.prisma.table.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        orders: {
          where: { status: OrderStatus.OPEN },
          include: { items: { include: { cafeItem: true, product: true } } },
        },
      },
      orderBy: { number: 'asc' },
    });
  }

  async updateTableStatus(id: string, tenantId: string, status: TableStatus) {
    const table = await this.prisma.table.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!table) throw new NotFoundException('Mesa não encontrada');
    return this.prisma.table.update({ where: { id }, data: { status } });
  }

  // ─── Orders ──────────────────────────────────────────────────────────────────
  async openOrder(tableId: string, tenantId: string, notes?: string) {
    const table = await this.prisma.table.findFirst({ where: { id: tableId, tenantId } });
    if (!table) throw new NotFoundException('Mesa não encontrada');

    const existing = await this.prisma.order.findFirst({
      where: { tableId, tenantId, status: OrderStatus.OPEN },
    });
    if (existing) throw new BadRequestException('Mesa já possui comanda aberta');

    const order = await this.prisma.order.create({
      data: { tenantId, tableId, notes },
    });

    await this.prisma.table.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });

    return order;
  }

  async addItem(orderId: string, tenantId: string, dto: {
    cafeItemId?: string; productId?: string; quantity: number; notes?: string;
  }) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, status: OrderStatus.OPEN },
    });
    if (!order) throw new NotFoundException('Comanda não encontrada ou já fechada');

    let unitPrice = 0;
    if (dto.cafeItemId) {
      // VULN-019: usar findFirst + tenantId para evitar acesso cross-tenant via UUID conhecido
      const item = await this.prisma.cafeItem.findFirst({ where: { id: dto.cafeItemId, tenantId } });
      if (!item) throw new NotFoundException('Item de cardápio não encontrado');
      unitPrice = Number(item.price);
    } else if (dto.productId) {
      const product = await this.prisma.product.findFirst({ where: { id: dto.productId, tenantId, deletedAt: null } });
      if (!product) throw new NotFoundException('Produto não encontrado');
      unitPrice = Number(product.salePrice);
    }

    return this.prisma.orderItem.create({
      data: { orderId, cafeItemId: dto.cafeItemId, productId: dto.productId, quantity: dto.quantity, unitPrice, notes: dto.notes },
    });
  }

  async closeOrder(orderId: string, tenantId: string, paymentMethod: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, status: OrderStatus.OPEN },
      include: { items: { include: { cafeItem: true } } },
    });
    if (!order) throw new NotFoundException('Comanda não encontrada');

    const total = order.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED, closedAt: new Date() },
      }),
      this.prisma.payment.create({
        data: {
          tenantId,
          orderId,
          amount: total,
          method: paymentMethod as never,
          status: 'PAID',
          paidAt: new Date(),
        },
      }),
      this.prisma.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.FREE },
      }),
      this.prisma.cashFlow.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: total,
          category: 'Cafeteria',
          description: `Comanda ${orderId.slice(0, 8)}`,
          source: 'cafe',
        },
      }),
      ...order.items
        .filter((i) => i.cafeItemId)
        .map((i) =>
          this.prisma.cafeItem.update({
            where: { id: i.cafeItemId! },
            data: { stock: { decrement: i.quantity } },
          }),
        ),
    ]);

    return { message: 'Comanda fechada com sucesso', total };
  }
}
