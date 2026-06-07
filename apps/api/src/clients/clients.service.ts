import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { cpf: { contains: search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          loyaltyPoints: { select: { points: true } },
          _count: { select: { appointments: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        loyaltyPoints: true,
        photos: { where: { deletedAt: null }, orderBy: { takenAt: 'desc' } },
        appointments: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          take: 10,
          include: { artist: { include: { user: { select: { name: true } } } } },
        },
        consents: { orderBy: { signedAt: 'desc' }, take: 1 },
        anamnesis: { orderBy: { updatedAt: 'desc' }, take: 1 },
        interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  async create(dto: CreateClientDto, tenantId: string) {
    const client = await this.prisma.client.create({
      data: { ...dto, tenantId },
    });

    await this.prisma.loyaltyPoints.create({
      data: { tenantId, clientId: client.id, points: 0 },
    });

    return client;
  }

  async update(id: string, dto: UpdateClientDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addPoints(clientId: string, tenantId: string, points: number, reason: string) {
    const loyalty = await this.prisma.loyaltyPoints.findFirst({
      where: { clientId, tenantId },
    });
    if (!loyalty) throw new NotFoundException('Programa de fidelidade não encontrado');

    const [updated] = await this.prisma.$transaction([
      this.prisma.loyaltyPoints.update({
        where: { id: loyalty.id },
        data: { points: { increment: points } },
      }),
      this.prisma.loyaltyTransaction.create({
        data: { loyaltyPointsId: loyalty.id, points, reason },
      }),
    ]);
    return updated;
  }

  async uploadPhoto(clientId: string, tenantId: string, url: string, caption?: string) {
    await this.findOne(clientId, tenantId);
    return this.prisma.photo.create({
      data: { tenantId, clientId, url, caption },
    });
  }
}
