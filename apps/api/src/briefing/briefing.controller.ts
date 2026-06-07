import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseInterceptors, UploadedFiles, Req, HttpCode, NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BriefingService, CreateBriefingDto, UpdateBriefingDto } from './briefing.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, BriefingStatus } from '@prisma/client';
import { Request } from 'express';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';

@Controller()
export class BriefingController {
  constructor(private readonly service: BriefingService) {}

  // ─── PÚBLICO: receber formulário via slug ────────────────────────────────────
  @Post('public/:slug/briefing')
  @Public()
  @SkipTenant()
  @HttpCode(201)
  @UseInterceptors(FilesInterceptor('images', 5))
  async createPublic(
    @Param('slug') slug: string,
    @Body() body: CreateBriefingDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const prisma = (this.service as any).prisma;
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Estúdio não encontrado');

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrls = (files ?? []).map((f) => `${baseUrl}/uploads/briefings/${f.filename}`);

    const briefing = await this.service.create(tenant.id, body, imageUrls);
    return { id: briefing.id };
  }

  // ─── PÚBLICO: info do estúdio para o formulário ──────────────────────────────
  @Get('public/:slug/info')
  @Public()
  @SkipTenant()
  async getPublicInfo(@Param('slug') slug: string) {
    const prisma = (this.service as any).prisma;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, slug: true, logoUrl: true, primaryColor: true },
    });
    if (!tenant) throw new NotFoundException('Estúdio não encontrado');
    return tenant;
  }

  // ─── ADMIN: listar briefings ─────────────────────────────────────────────────
  @Get('briefings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  async findAll(
    @Req() req: Request & { tenantId: string },
    @Query('status') status?: BriefingStatus,
  ) {
    return this.service.findAll(req.tenantId, status);
  }

  @Get('briefings/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  async stats(@Req() req: Request & { tenantId: string }) {
    return this.service.countByStatus(req.tenantId);
  }

  @Get('briefings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  async findOne(@Param('id') id: string, @Req() req: Request & { tenantId: string }) {
    return this.service.findOne(id, req.tenantId);
  }

  @Patch('briefings/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBriefingDto,
    @Req() req: Request & { tenantId: string },
  ) {
    return this.service.update(id, req.tenantId, dto);
  }
}
