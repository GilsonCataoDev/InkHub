import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
}

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar tenant por slug (público)' })
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, deletedAt: null, active: true },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
    });
    if (!tenant) throw new NotFoundException('Estúdio não encontrado');
    return tenant;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configurações do tenant atual' })
  async getMe(@TenantId() tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      include: { plan: { select: { name: true, type: true, maxUsers: true, maxClients: true, features: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar configurações do tenant' })
  @Roles(UserRole.ADMIN)
  async updateMe(@TenantId() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
    });
  }
}
