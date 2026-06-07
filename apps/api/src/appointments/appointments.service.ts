import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/create-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}

const VALID_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  [AppointmentStatus.PENDING]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [AppointmentStatus.IN_SESSION, AppointmentStatus.CANCELLED],
  [AppointmentStatus.IN_SESSION]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
};

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(
    tenantId: string,
    artistId?: string,
    date?: string,
    status?: AppointmentStatus,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      deletedAt: null,
      ...(artistId && { artistId }),
      ...(status && { status }),
      ...(date && {
        date: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lte: new Date(date + 'T23:59:59.999Z'),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
        include: {
          client: { select: { id: true, name: true, phone: true, avatarUrl: true } },
          artist: { include: { user: { select: { name: true, avatarUrl: true } } } },
          payments: true,
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const apt = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        artist: { include: { user: { select: { name: true, avatarUrl: true } } } },
        sessions: true,
        payments: true,
      },
    });
    if (!apt) throw new NotFoundException('Agendamento não encontrado');
    return apt;
  }

  async create(dto: CreateAppointmentDto, tenantId: string) {
    const [client, artist] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: dto.clientId, tenantId, deletedAt: null } }),
      this.prisma.tattooArtist.findFirst({ where: { id: dto.artistId, tenantId, deletedAt: null } }),
    ]);

    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (!artist) throw new NotFoundException('Tatuador não encontrado');

    return this.prisma.appointment.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        artistId: dto.artistId,
        date: new Date(dto.date),
        durationMinutes: dto.durationMinutes ?? 60,
        description: dto.description,
        bodyPart: dto.bodyPart,
        estimatedValue: dto.estimatedValue,
        deposit: dto.deposit ?? 0,
        notes: dto.notes,
      },
      include: {
        client: { select: { name: true, phone: true } },
        artist: { include: { user: { select: { name: true } } } },
      },
    });
  }

  async update(id: string, dto: UpdateAppointmentDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.durationMinutes && { durationMinutes: dto.durationMinutes }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bodyPart !== undefined && { bodyPart: dto.bodyPart }),
        ...(dto.estimatedValue !== undefined && { estimatedValue: dto.estimatedValue }),
        ...(dto.deposit !== undefined && { deposit: dto.deposit }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto, tenantId: string) {
    const apt = await this.findOne(id, tenantId);
    const allowed = VALID_TRANSITIONS[apt.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${apt.status} → ${dto.status}. Permitidos: ${allowed.join(', ')}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: dto.status },
    });

    // Disparo de e-mail ao confirmar agendamento
    if (dto.status === AppointmentStatus.CONFIRMED && apt.client.email) {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: apt.tenantId }, select: { name: true } });
      this.notifications.sendAppointmentConfirmation({
        clientName: apt.client.name,
        clientEmail: apt.client.email,
        artistName: apt.artist.user.name,
        date: apt.date,
        description: apt.description ?? undefined,
        studioName: tenant?.name ?? 'InkHub Studio',
      }).catch(() => {}); // Fire-and-forget — não bloqueia a resposta
    }

    if (dto.status === AppointmentStatus.IN_SESSION) {
      await this.prisma.session.create({
        data: { tenantId, appointmentId: id },
      });
    }

    if (dto.status === AppointmentStatus.COMPLETED) {
      await this.prisma.session.updateMany({
        where: { appointmentId: id, endedAt: null },
        data: { endedAt: new Date() },
      });
    }

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getByWeek(tenantId: string, artistId?: string, weekStart?: string) {
    const start = weekStart ? new Date(weekStart) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        date: { gte: start, lt: end },
        ...(artistId && { artistId }),
        status: { not: AppointmentStatus.CANCELLED },
      },
      orderBy: { date: 'asc' },
      include: {
        client: { select: { name: true, phone: true } },
        artist: { include: { user: { select: { name: true } } } },
      },
    });
  }
}
