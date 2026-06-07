import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  async getBirthdaysThisMonth(tenantId: string) {
    const month = new Date().getMonth() + 1;
    return this.prisma.client.findMany({
      where: {
        tenantId,
        deletedAt: null,
        birthDate: { not: null },
      },
      select: { id: true, name: true, email: true, phone: true, birthDate: true },
    }).then((clients) =>
      clients.filter((c) => c.birthDate && new Date(c.birthDate).getMonth() + 1 === month),
    );
  }

  async getInactiveClients(tenantId: string, inactiveDays = 60) {
    const cutoff = new Date(Date.now() - inactiveDays * 86400000);
    const activeClientIds = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: { tenantId, date: { gte: cutoff } },
    });
    const activeIds = new Set(activeClientIds.map((a) => a.clientId));

    return this.prisma.client.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: { select: { appointments: true } },
        loyaltyPoints: { select: { points: true } },
      },
    }).then((clients) => clients.filter((c) => !activeIds.has(c.id)));
  }

  async getTopSpenders(tenantId: string, limit = 10) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId, status: 'PAID', appointment: { tenantId } },
      include: { appointment: { include: { client: { select: { id: true, name: true, email: true } } } } },
    });

    const byClient: Record<string, { client: { id: string; name: string; email: string | null }; total: number }> = {};
    for (const p of payments) {
      const client = p.appointment?.client;
      if (!client) continue;
      if (!byClient[client.id]) byClient[client.id] = { client, total: 0 };
      byClient[client.id].total += Number(p.amount);
    }

    return Object.values(byClient)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  async getClientTimeline(clientId: string, tenantId: string) {
    const [appointments, interactions, payments] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { clientId, tenantId, deletedAt: null },
        orderBy: { date: 'desc' },
        take: 20,
        include: { artist: { include: { user: { select: { name: true } } } } },
      }),
      this.prisma.interaction.findMany({
        where: { clientId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.payment.findMany({
        where: { appointment: { clientId, tenantId }, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ]);

    const timeline = [
      ...appointments.map((a) => ({ type: 'appointment', date: a.date, data: a })),
      ...interactions.map((i) => ({ type: 'interaction', date: i.createdAt, data: i })),
      ...payments.map((p) => ({ type: 'payment', date: p.paidAt ?? p.createdAt, data: p })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }

  async createInteraction(
    clientId: string,
    tenantId: string,
    type: string,
    description: string,
    createdBy?: string,
  ) {
    return this.prisma.interaction.create({
      data: { clientId, tenantId, type, description, createdBy },
    });
  }

  async getCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(tenantId: string, dto: {
    name: string; subject: string; body: string; segment: string;
  }) {
    return this.prisma.campaign.create({ data: { tenantId, ...dto } });
  }
}
