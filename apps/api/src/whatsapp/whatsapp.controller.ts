import {
  Controller, Get, Post, Delete, Body, Query, Req, HttpCode, Res,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappService, WhatsappConfigDto } from './whatsapp.service';
import { BaileysService } from './baileys.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

interface AuthRequest extends Request {
  tenantId: string;
}

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly service: WhatsappService,
    private readonly baileys: BaileysService,
  ) {}

  // ─── Legacy (Evolution API) config ───────────────────────────────────────────

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getConfig(@Req() req: AuthRequest) {
    return this.service.getConfig(req.tenantId);
  }

  @Post('config')
  @Roles(UserRole.ADMIN)
  saveConfig(@Req() req: AuthRequest, @Body() dto: WhatsappConfigDto) {
    return this.service.saveConfig(req.tenantId, dto);
  }

  @Delete('config')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  deleteConfig(@Req() req: AuthRequest) {
    return this.service.deleteConfig(req.tenantId);
  }

  @Post('test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  test(@Req() req: AuthRequest, @Body() body: { phone: string }) {
    return this.service.testMessage(req.tenantId, body.phone);
  }

  // ─── Baileys (QR Code) ────────────────────────────────────────────────────────

  @Post('qr/connect')
  @Roles(UserRole.ADMIN)
  async startQr(@Req() req: AuthRequest) {
    const session = await this.baileys.connect(req.tenantId);
    return session;
  }

  @Get('qr/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getQrStatus(@Req() req: AuthRequest) {
    return this.baileys.getSession(req.tenantId);
  }

  /**
   * SSE endpoint — autentica apenas via Authorization header (não query param).
   * VULN-003: JWT em query param removido; agora o frontend usa fetch() com header.
   */
  @Get('qr/stream')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async streamQr(@Req() req: AuthRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: desabilitar buffer
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send(this.baileys.getSession(req.tenantId));

    let ticks = 0;
    const interval = setInterval(() => {
      const session = this.baileys.getSession(req.tenantId);
      send(session);
      ticks++;
      if (ticks > 90 || session.status === 'connected' || session.status === 'disconnected') {
        clearInterval(interval);
        if (!res.writableEnded) res.end();
      }
    }, 2000);

    req.on('close', () => {
      clearInterval(interval);
      if (!res.writableEnded) res.end();
    });
  }

  @Delete('qr/disconnect')
  @Roles(UserRole.ADMIN)
  async disconnectQr(@Req() req: AuthRequest) {
    await this.baileys.disconnect(req.tenantId);
    return { disconnected: true };
  }

  // ─── Messages ─────────────────────────────────────────────────────────────────

  @Get('messages')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  getMessages(@Req() req: AuthRequest, @Query('appointmentId') appointmentId?: string) {
    return this.service.getMessages(req.tenantId, appointmentId);
  }

  @Post('messages')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST)
  sendManual(
    @Req() req: AuthRequest,
    @Body() body: { phone: string; body: string; appointmentId?: string },
  ) {
    return this.service.sendManual(req.tenantId, body.phone, body.body, body.appointmentId);
  }

  // ─── Webhook (Evolution API) — VULN-005: verificação HMAC ────────────────────

  @Post('webhook')
  @Public()
  @SkipTenant()
  @HttpCode(200)
  webhook(@Req() req: Request, @Body() payload: any) {
    // Verificar assinatura HMAC quando secret estiver configurado
    const secret = process.env['EVOLUTION_WEBHOOK_SECRET'];
    if (secret) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      if (!signature) {
        this.logger.warn('[Webhook] Requisição sem assinatura rejeitada');
        throw new UnauthorizedException('Assinatura ausente');
      }

      const expected = `sha256=${createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex')}`;

      // timingSafeEqual previne timing attacks na comparação
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      const valid =
        sigBuf.length === expBuf.length &&
        timingSafeEqual(sigBuf, expBuf);

      if (!valid) {
        this.logger.warn('[Webhook] Assinatura HMAC inválida');
        throw new UnauthorizedException('Assinatura inválida');
      }
    }

    return this.service.handleWebhook(payload);
  }
}
