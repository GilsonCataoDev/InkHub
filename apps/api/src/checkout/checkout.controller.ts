import {
  Controller, Get, Post, Body, Param, Req, HttpCode,
} from '@nestjs/common';
import { CheckoutService, CheckoutDto, CheckoutPreviewDto } from './checkout.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Audit } from '../audit/audit.interceptor';

interface AuthRequest extends Request {
  tenantId: string;
  user: { id: string; role: UserRole };
}

@Controller()
export class CheckoutController {
  constructor(private readonly service: CheckoutService) {}

  @Get('appointments/:id/checkout-preview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  preview(
    @Param('id') id: string,
    @Body() dto: CheckoutPreviewDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.preview(id, req.tenantId, dto);
  }

  @Post('appointments/:id/checkout')
  @HttpCode(201)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  @Audit('checkout.create', 'Appointment')
  checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.checkout(id, req.tenantId, dto, req.user.id);
  }

  @Get('appointments/:id/checkout')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.TATTOO_ARTIST)
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.service.findByAppointment(id, req.tenantId);
  }

  @Get('checkout/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  summary(@Req() req: AuthRequest) {
    return this.service.summary(req.tenantId);
  }
}
