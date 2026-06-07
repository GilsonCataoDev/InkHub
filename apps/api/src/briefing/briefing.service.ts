import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BriefingStatus } from '@prisma/client';

export interface CreateBriefingDto {
  name: string;
  email: string;
  phone?: string;
  instagram?: string;
  idea: string;
  style?: string;
  placement?: string;
  size?: string;
  budget?: string;
  colorOrBlack?: string;
  isFirstTattoo?: boolean;
  referenceImages?: string[];
}

export interface UpdateBriefingDto {
  status?: BriefingStatus;
  notes?: string;
  assignedTo?: string;
}

@Injectable()
export class BriefingService {
  constructor(private prisma: PrismaService) {}

  // ─── Público: receber formulário ─────────────────────────────────────────────
  async create(tenantId: string, dto: CreateBriefingDto, imageUrls: string[]) {
    return this.prisma.briefing.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        instagram: dto.instagram,
        idea: dto.idea,
        style: dto.style,
        placement: dto.placement,
        size: dto.size,
        budget: dto.budget,
        colorOrBlack: dto.colorOrBlack,
        isFirstTattoo: dto.isFirstTattoo === true || (dto.isFirstTattoo as unknown as string) === 'true',
        referenceImages: imageUrls,
      },
    });
  }

  // ─── Admin: listar briefings ─────────────────────────────────────────────────
  async findAll(tenantId: string, status?: BriefingStatus) {
    return this.prisma.briefing.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: ver briefing ─────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const briefing = await this.prisma.briefing.findFirst({
      where: { id, tenantId },
    });
    if (!briefing) throw new NotFoundException('Briefing não encontrado');
    return briefing;
  }

  // ─── Admin: atualizar status / notas ─────────────────────────────────────────
  async update(id: string, tenantId: string, dto: UpdateBriefingDto) {
    await this.findOne(id, tenantId);
    return this.prisma.briefing.update({
      where: { id },
      data: dto,
    });
  }

  // ─── Admin: contagem por status ──────────────────────────────────────────────
  async countByStatus(tenantId: string) {
    const counts = await this.prisma.briefing.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });
    return counts.reduce((acc, c) => ({ ...acc, [c.status]: c._count.id }), {} as Record<string, number>);
  }
}
