import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePortfolioDto {
  artistId: string;
  imageUrl: string;
  thumbUrl?: string;
  style: string;
  placement?: string;
  description?: string;
  tags?: string[];
  featured?: boolean;
  public?: boolean;
}

export interface UpdatePortfolioDto {
  style?: string;
  placement?: string;
  description?: string;
  tags?: string[];
  featured?: boolean;
  public?: boolean;
}

function generateSlug(style: string, placement?: string): string {
  const base = [style, placement, Date.now().toString(36)]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base;
}

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async findPublic(slug: string, style?: string, artistId?: string, page = 1, limit = 20) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Estúdio não encontrado');

    const skip = (page - 1) * limit;
    const where: any = { tenantId: tenant.id, public: true };
    if (style) where.style = style;
    if (artistId) where.artistId = artistId;

    const [items, total] = await Promise.all([
      this.prisma.portfolioItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: {
          artist: { include: { user: { select: { name: true, avatarUrl: true } } } },
        },
      }),
      this.prisma.portfolioItem.count({ where }),
    ]);

    return { items, total, page, limit, studio: { name: tenant.name, primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl } };
  }

  async findPublicItem(tenantSlug: string, itemSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Estúdio não encontrado');

    const item = await this.prisma.portfolioItem.findFirst({
      where: { tenantId: tenant.id, slug: itemSlug, public: true },
      include: {
        artist: { include: { user: { select: { name: true, avatarUrl: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    // Increment view count (fire and forget)
    this.prisma.portfolioItem.update({
      where: { id: item.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => null);

    return { item, studio: { name: tenant.name, slug: tenant.slug, primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl } };
  }

  async findAll(tenantId: string, style?: string, artistId?: string) {
    const where: any = { tenantId };
    if (style) where.style = style;
    if (artistId) where.artistId = artistId;

    return this.prisma.portfolioItem.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      include: {
        artist: { include: { user: { select: { name: true } } } },
      },
    });
  }

  async create(tenantId: string, dto: CreatePortfolioDto) {
    const slug = generateSlug(dto.style, dto.placement);
    return this.prisma.portfolioItem.create({
      data: {
        tenantId,
        artistId: dto.artistId,
        imageUrl: dto.imageUrl,
        thumbUrl: dto.thumbUrl ?? null,
        style: dto.style,
        placement: dto.placement ?? null,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        featured: dto.featured ?? false,
        public: dto.public ?? true,
        slug,
      },
      include: {
        artist: { include: { user: { select: { name: true } } } },
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdatePortfolioDto) {
    await this.findOneOrFail(id, tenantId);
    return this.prisma.portfolioItem.update({
      where: { id },
      data: dto,
    });
  }

  async togglePublic(id: string, tenantId: string) {
    const item = await this.findOneOrFail(id, tenantId);
    return this.prisma.portfolioItem.update({
      where: { id },
      data: { public: !item.public },
    });
  }

  async toggleFeatured(id: string, tenantId: string) {
    const item = await this.findOneOrFail(id, tenantId);
    return this.prisma.portfolioItem.update({
      where: { id },
      data: { featured: !item.featured },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOneOrFail(id, tenantId);
    return this.prisma.portfolioItem.delete({ where: { id } });
  }

  private async findOneOrFail(id: string, tenantId: string) {
    const item = await this.prisma.portfolioItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    return item;
  }

  async getStyles(tenantId: string) {
    const items = await this.prisma.portfolioItem.findMany({
      where: { tenantId, public: true },
      select: { style: true },
      distinct: ['style'],
    });
    return items.map((i) => i.style);
  }
}
