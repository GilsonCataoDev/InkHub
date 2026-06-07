import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TattooArtistsService } from './tattoo-artists.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Tattoo Artists')
@ApiBearerAuth()
@Controller('tattoo-artists')
export class TattooArtistsController {
  constructor(private service: TattooArtistsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tatuadores' })
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Perfil do tatuador' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Performance mensal do tatuador' })
  getPerformance(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const now = new Date();
    return this.service.getPerformance(id, tenantId, month ?? now.getMonth() + 1, year ?? now.getFullYear());
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar tatuador' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: { userId: string; bio?: string; specialties?: string[] }, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar perfil do tatuador' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TATTOO_ARTIST)
  update(
    @Param('id') id: string,
    @Body() dto: { bio?: string; specialties?: string[]; portfolioUrl?: string },
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Post(':id/goal')
  @ApiOperation({ summary: 'Definir meta mensal' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setGoal(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { month: number; year: number; target: number },
  ) {
    return this.service.setGoal(id, tenantId, dto.month, dto.year, dto.target);
  }

  @Post(':id/commission')
  @ApiOperation({ summary: 'Configurar comissão' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  upsertCommission(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { type: 'PERCENTAGE' | 'FIXED'; value: number; serviceType?: string },
  ) {
    return this.service.upsertCommission(id, tenantId, dto.type, dto.value, dto.serviceType);
  }
}
