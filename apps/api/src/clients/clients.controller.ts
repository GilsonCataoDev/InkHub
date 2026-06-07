import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes com paginação e busca' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @TenantId() tenantId: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.findAll(tenantId, search, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do cliente' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar cliente' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  create(@Body() dto: CreateClientDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar cliente' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @TenantId() tenantId: string) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover cliente (soft delete)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.remove(id, tenantId);
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Upload de foto do cliente' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env['UPLOAD_DEST'] ?? './uploads',
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
    }),
  )
  uploadPhoto(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    const url = `/uploads/${file.filename}`;
    return this.service.uploadPhoto(id, tenantId, url, caption);
  }

  @Post(':id/loyalty/add')
  @ApiOperation({ summary: 'Adicionar pontos de fidelidade' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  addPoints(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body('points') points: number,
    @Body('reason') reason: string,
  ) {
    return this.service.addPoints(id, tenantId, points, reason);
  }
}
