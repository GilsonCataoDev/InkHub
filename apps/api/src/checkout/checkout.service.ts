import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';

export interface CheckoutPreviewDto {
  grossAmount: number;
  discount?: number;
  tip?: number;
  paymentMethod: PaymentMethod;
}

export interface CheckoutDto extends CheckoutPreviewDto {
  notes?: string;
  touchUpDate?: string; // ISO date string
  productsUsed?: { productId: string; qty: number }[]; // deduz do estoque automaticamente
}

@Injectable()
export class CheckoutService {
  constructor(private prisma: PrismaService) {}

  private async getAppointmentOrFail(appointmentId: string, tenantId: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null },
      include: {
        client: { include: { loyaltyPoints: true } },
        artist: {
          include: {
            commissions: { where: { active: true } },
            user: { select: { name: true } },
          },
        },
      },
    });
    if (!apt) throw new NotFoundException('Agendamento não encontrado');
    return apt;
  }

  private calcValues(apt: any, dto: CheckoutPreviewDto) {
    const gross = Number(dto.grossAmount);
    const discount = Number(dto.discount ?? 0);
    const tip = Number(dto.tip ?? 0);
    const finalAmount = gross - discount + tip;
    const depositDeducted = Number(apt.deposit ?? 0);
    const amountDue = Math.max(0, finalAmount - depositDeducted);

    const defaultComm = apt.artist.commissions.find(
      (c: any) => c.serviceType === 'DEFAULT',
    );
    const commissionRate = defaultComm
      ? Number(defaultComm.value) / 100
      : 0.4;
    const commissionAmount = finalAmount * commissionRate;
    const pointsAwarded = Math.floor(finalAmount / 10);

    return {
      gross, discount, tip, finalAmount, depositDeducted,
      amountDue, commissionRate, commissionAmount, pointsAwarded,
    };
  }

  async preview(appointmentId: string, tenantId: string, dto: CheckoutPreviewDto) {
    const apt = await this.getAppointmentOrFail(appointmentId, tenantId);
    const v = this.calcValues(apt, dto);
    return {
      grossAmount: v.gross,
      discount: v.discount,
      tip: v.tip,
      finalAmount: v.finalAmount,
      depositDeducted: v.depositDeducted,
      amountDue: v.amountDue,
      commissionRate: v.commissionRate,
      commissionAmount: v.commissionAmount,
      pointsAwarded: v.pointsAwarded,
      currentPoints: apt.client.loyaltyPoints?.points ?? 0,
      artistName: apt.artist.user.name,
      clientName: apt.client.name,
    };
  }

  async checkout(appointmentId: string, tenantId: string, dto: CheckoutDto, userId: string) {
    const apt = await this.getAppointmentOrFail(appointmentId, tenantId);

    const existing = await this.prisma.sessionCheckout.findUnique({
      where: { appointmentId },
    });
    if (existing) throw new ConflictException('Agendamento já foi finalizado');

    const v = this.calcValues(apt, dto);

    return this.prisma.$transaction(async (tx) => {
      // 1. Checkout record
      const checkout = await tx.sessionCheckout.create({
        data: {
          tenantId,
          appointmentId,
          grossAmount: v.gross,
          discount: v.discount,
          tip: v.tip,
          finalAmount: v.finalAmount,
          depositDeducted: v.depositDeducted,
          amountDue: v.amountDue,
          paymentMethod: dto.paymentMethod,
          commissionRate: v.commissionRate,
          commissionAmount: v.commissionAmount,
          pointsAwarded: v.pointsAwarded,
          touchUpDate: dto.touchUpDate ? new Date(dto.touchUpDate) : null,
          notes: dto.notes ?? null,
          checkedOutBy: userId,
        },
      });

      // 2. Appointment → COMPLETED
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });

      // 3. CashFlow entry
      await tx.cashFlow.create({
        data: {
          tenantId,
          type: 'INCOME',
          amount: v.finalAmount,
          category: 'Tatuagem',
          description: `Sessão finalizada — ${apt.client.name}`,
          source: 'checkout',
          date: new Date(),
        },
      });

      // 4. Payment record
      await tx.payment.create({
        data: {
          tenantId,
          appointmentId,
          amount: v.amountDue,
          method: dto.paymentMethod,
          status: 'PAID',
          paidAt: new Date(),
          notes: dto.notes ?? null,
        },
      });

      // 5. Loyalty points
      if (v.pointsAwarded > 0) {
        const reason = `Sessão em ${new Date().toLocaleDateString('pt-BR')}`;
        if (apt.client.loyaltyPoints) {
          await tx.loyaltyPoints.update({
            where: { id: apt.client.loyaltyPoints.id },
            data: { points: { increment: v.pointsAwarded } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              loyaltyPointsId: apt.client.loyaltyPoints.id,
              points: v.pointsAwarded,
              reason,
            },
          });
        } else {
          const lp = await tx.loyaltyPoints.create({
            data: { tenantId, clientId: apt.clientId, points: v.pointsAwarded },
          });
          await tx.loyaltyTransaction.create({
            data: { loyaltyPointsId: lp.id, points: v.pointsAwarded, reason },
          });
        }
      }

      // 6. Schedule touch-up appointment
      if (dto.touchUpDate) {
        await tx.appointment.create({
          data: {
            tenantId,
            clientId: apt.clientId,
            artistId: apt.artistId,
            date: new Date(dto.touchUpDate),
            durationMinutes: 60,
            status: 'PENDING',
            description: `Retoque — sessão de ${new Date().toLocaleDateString('pt-BR')}`,
            bodyPart: apt.bodyPart ?? null,
          },
        });
        await tx.sessionCheckout.update({
          where: { id: checkout.id },
          data: { touchUpBooked: true },
        });
      }

      // 7. Stock deduction (produtos usados na sessão)
      if (dto.productsUsed?.length) {
        for (const { productId, qty } of dto.productsUsed) {
          if (!productId || qty <= 0) continue;
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId,
              type: 'INTERNAL_USE',
              quantity: -qty,
              reason: `Sessão — ${apt.client.name} (${new Date().toLocaleDateString('pt-BR')})`,
            },
          });
          await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: qty } },
          });
        }
      }

      return tx.sessionCheckout.findUnique({ where: { id: checkout.id } });
    });
  }

  async findByAppointment(appointmentId: string, tenantId: string) {
    const c = await this.prisma.sessionCheckout.findFirst({
      where: { appointmentId, tenantId },
    });
    if (!c) throw new NotFoundException('Checkout não encontrado');
    return c;
  }

  async summary(tenantId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const checkouts = await this.prisma.sessionCheckout.findMany({
      where: { tenantId, createdAt: { gte: start, lte: end } },
    });

    const totalRevenue = checkouts.reduce((s, c) => s + Number(c.finalAmount), 0);
    const totalCommissions = checkouts.reduce((s, c) => s + Number(c.commissionAmount), 0);
    const totalPoints = checkouts.reduce((s, c) => s + c.pointsAwarded, 0);

    return {
      count: checkouts.length,
      totalRevenue,
      totalCommissions,
      netRevenue: totalRevenue - totalCommissions,
      totalPoints,
    };
  }
}
