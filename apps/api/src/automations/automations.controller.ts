import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Req, HttpCode,
} from '@nestjs/common';
import { AutomationsService, CreateAutomationDto, UpdateAutomationDto } from './automations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

interface AuthRequest extends Request { tenantId: string; }

@Controller('automations')
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll(@Req() req: AuthRequest) {
    return this.service.findAll(req.tenantId);
  }

  @Get('templates')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  templates() {
    return this.service.getTemplates();
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Req() req: AuthRequest, @Body() dto: CreateAutomationDto) {
    return this.service.create(req.tenantId, dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Req() req: AuthRequest, @Body() dto: UpdateAutomationDto) {
    return this.service.update(id, req.tenantId, dto);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  toggle(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.toggle(id, req.tenantId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.remove(id, req.tenantId);
  }

  @Get(':id/logs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  logs(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.getLogs(id, req.tenantId);
  }
}
