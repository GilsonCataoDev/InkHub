import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateArtistDto {
  userId: string;
  bio?: string;
  specialties?: string[];
  portfolioUrl?: string;
}

interface UpdateArtistDto {
  bio?: string;
  specialties?: string[];
  portfolioUrl?: string;
  active?: boolean;
}

@Injectable()
export class TattooArtistsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tattooArtist.findMany({
      where: { tenantId, deletedAt: null, active: true },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        commissions: { where: { active: true } },
        goals: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 },
        _count: { select: { appointments: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const artist = await this.prisma.tattooArtist.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        commissions: true,
        schedules: { where: { active: true } },
        goals: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 3 },
        _count: { select: { appointments: true } },
      },
    });
    if (!artist) throw new NotFoundException('Tatuador não encontrado');
    return artist;
  }

  async create(dto: CreateArtistDto, tenantId: string) {
    return this.prisma.tattooArtist.create({
      data: { tenantId, ...dto },
    });
  }

  async update(id: string, dto: UpdateArtistDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.tattooArtist.update({ where: { id }, data: dto });
  }

  async getPerformance(id: string, tenantId: string, month: number, year: number) {
    await this.findOne(id, tenantId);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [appointments, goal] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          artistId: id,
          tenantId,
          date: { gte: start, lt: end },
          status: 'COMPLETED',
        },
        include: { payments: true },
      }),
      this.prisma.goal.findFirst({ where: { artistId: id, month, year } }),
    ]);

    const totalRevenue = appointments.reduce((sum, apt) => {
      const paid = apt.payments
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s + Number(p.amount), 0);
      return sum + paid;
    }, 0);

    return {
      month,
      year,
      totalAppointments: appointments.length,
      totalRevenue,
      goal: goal?.target ? Number(goal.target) : null,
      goalAchieved: goal?.achieved ? Number(goal.achieved) : null,
      goalPercentage: goal?.target ? (totalRevenue / Number(goal.target)) * 100 : null,
    };
  }

  async setGoal(
    artistId: string,
    tenantId: string,
    month: number,
    year: number,
    target: number,
  ) {
    return this.prisma.goal.upsert({
      where: { artistId_month_year: { artistId, month, year } },
      update: { target },
      create: { tenantId, artistId, month, year, target },
    });
  }

  async upsertCommission(
    artistId: string,
    tenantId: string,
    type: 'PERCENTAGE' | 'FIXED',
    value: number,
    serviceType = 'DEFAULT',
  ) {
    return this.prisma.commission.upsert({
      where: { artistId_serviceType: { artistId, serviceType } },
      update: { type, value },
      create: { tenantId, artistId, type, value, serviceType },
    });
  }
}
