import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param,
  Query, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/create-appointment.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar agendamentos' })
  @ApiQuery({ name: 'artistId', required: false })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  findAll(
    @TenantId() tenantId: string,
    @Query('artistId') artistId?: string,
    @Query('date') date?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.service.findAll(tenantId, artistId, date, status, page, limit);
  }

  @Get('week')
  @ApiOperation({ summary: 'Agendamentos da semana por tatuador' })
  @ApiQuery({ name: 'artistId', required: false })
  @ApiQuery({ name: 'weekStart', required: false, description: 'YYYY-MM-DD' })
  getByWeek(
    @TenantId() tenantId: string,
    @Query('artistId') artistId?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.service.getByWeek(tenantId, artistId, weekStart);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do agendamento' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar agendamento' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TATTOO_ARTIST)
  create(@Body() dto: CreateAppointmentDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar agendamento' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  update(
    @Param('id') id: string,
    @Body() dto: CreateAppointmentDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status do agendamento' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TATTOO_ARTIST)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.updateStatus(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar/remover agendamento (soft delete)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
