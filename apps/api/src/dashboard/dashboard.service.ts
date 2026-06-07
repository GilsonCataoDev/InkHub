import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CashFlowType, AppointmentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getOverview(tenantId: string) {
    const cacheKey = `dashboard:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayRevenue,
      weekRevenue,
      monthRevenue,
      todayAppointments,
      pendingAppointments,
      lowStockCount,
      activeClients,
      artistRanking,
      revenueBySource,
    ] = await Promise.all([
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: todayStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: weekAgo, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: monthStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          date: { gte: todayStart, lt: todayEnd },
        },
        include: {
          client: { select: { name: true } },
          artist: { include: { user: { select: { name: true } } } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.appointment.count({
        where: { tenantId, deletedAt: null, status: AppointmentStatus.PENDING },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count FROM "Product"
        WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
        AND "active" = true AND "stock" <= "minStock"
      `.then((r) => Number((r[0] as { count: bigint }).count)),
      this.prisma.client.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.appointment.groupBy({
        by: ['artistId'],
        where: {
          tenantId,
          deletedAt: null,
          status: AppointmentStatus.COMPLETED,
          date: { gte: monthStart },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.cashFlow.groupBy({
        by: ['source'],
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    const artistIds = artistRanking.map((a) => a.artistId);
    const artistDetails = await this.prisma.tattooArtist.findMany({
      where: { id: { in: artistIds } },
      include: { user: { select: { name: true } } },
    });

    const ranking = artistRanking.map((r) => ({
      artistId: r.artistId,
      count: r._count.id,
      name: artistDetails.find((a) => a.id === r.artistId)?.user.name ?? 'N/A',
    }));

    const result = {
      revenue: {
        today: Number(todayRevenue._sum.amount ?? 0),
        week: Number(weekRevenue._sum.amount ?? 0),
        month: Number(monthRevenue._sum.amount ?? 0),
      },
      appointments: {
        today: todayAppointments,
        pending: pendingAppointments,
      },
      lowStockAlerts: lowStockCount,
      activeClients,
      artistRanking: ranking,
      revenueBySource: revenueBySource.map((r) => ({
        source: r.source ?? 'outros',
        total: Number(r._sum.amount ?? 0),
      })),
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  async getRevenueChart(tenantId: string, days = 30) {
    const cacheKey = `dashboard:chart:${tenantId}:${days}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const result: { date: string; receita: number; sessoes: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const [revenue, sessions] = await Promise.all([
        this.prisma.cashFlow.aggregate({
          where: { tenantId, type: CashFlowType.INCOME, date: { gte: d, lte: dayEnd } },
          _sum: { amount: true },
        }),
        this.prisma.appointment.count({
          where: { tenantId, status: AppointmentStatus.COMPLETED, date: { gte: d, lte: dayEnd }, deletedAt: null },
        }),
      ]);

      result.push({
        date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        receita: Number(revenue._sum.amount ?? 0),
        sessoes: sessions,
      });
    }

    await this.cache.set(cacheKey, result, 60);
    return result;
  }
}
