import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, Req, UseInterceptors, UploadedFile, HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import { PortfolioService, CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';

interface AuthRequest extends Request {
  tenantId: string;
  user: { id: string; role: UserRole };
}

// VULN-006: extensões e MIME types permitidos
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/portfolio';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // VULN-006: sanitizar extensão — usar basename() previne path traversal
    const rawExt = extname(basename(file.originalname)).toLowerCase().replace(/[^.a-z]/g, '');
    const safeExt = ALLOWED_EXTS.has(rawExt) ? rawExt : '.bin';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

// VULN-006: fileFilter verifica MIME type declarado (dupla validação com fileType no service)
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) => {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new BadRequestException('Apenas imagens JPEG, PNG, WebP ou GIF são aceitas'), false);
  }
  cb(null, true);
};

@Controller()
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  // ─── PUBLIC ──────────────────────────────────────────────────────────────────

  @Get('public/:slug/portfolio')
  @Public()
  @SkipTenant()
  findPublic(
    @Param('slug') slug: string,
    @Query('style') style?: string,
    @Query('artistId') artistId?: string,
    @Query('page') page?: string,
  ) {
    return this.service.findPublic(slug, style, artistId, page ? +page : 1);
  }

  @Get('public/:slug/portfolio/:itemSlug')
  @Public()
  @SkipTenant()
  findPublicItem(
    @Param('slug') slug: string,
    @Param('itemSlug') itemSlug: string,
  ) {
    return this.service.findPublicItem(slug, itemSlug);
  }

  @Get('public/:slug/portfolio-styles')
  @Public()
  @SkipTenant()
  async getPublicStyles(@Param('slug') slug: string) {
    const tenant = (this.service as any).prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return [];
    return this.service.getStyles((await tenant)?.id);
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  @Get('portfolio')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  findAll(
    @Req() req: AuthRequest,
    @Query('style') style?: string,
    @Query('artistId') artistId?: string,
  ) {
    return this.service.findAll(req.tenantId, style, artistId);
  }

  @Post('portfolio')
  @HttpCode(201)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  @UseInterceptors(FileInterceptor('image', { storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest & { protocol: string },
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = file
      ? `${baseUrl}/uploads/portfolio/${file.filename}`
      : body.imageUrl;

    const dto: CreatePortfolioDto = {
      artistId: body.artistId,
      imageUrl,
      style: body.style,
      placement: body.placement,
      description: body.description,
      tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
      featured: body.featured === 'true' || body.featured === true,
      public: body.public !== 'false' && body.public !== false,
    };
    return this.service.create(req.tenantId, dto);
  }

  @Patch('portfolio/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.update(id, req.tenantId, dto);
  }

  @Patch('portfolio/:id/toggle-public')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  togglePublic(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.togglePublic(id, req.tenantId);
  }

  @Patch('portfolio/:id/toggle-featured')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  toggleFeatured(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.toggleFeatured(id, req.tenantId);
  }

  @Delete('portfolio/:id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.remove(id, req.tenantId);
  }

  @Get('portfolio/styles')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  styles(@Req() req: AuthRequest) {
    return this.service.getStyles(req.tenantId);
  }
}
