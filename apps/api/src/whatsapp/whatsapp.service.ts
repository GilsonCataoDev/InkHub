import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BaileysService } from './baileys.service';

export interface WhatsappConfigDto {
  provider?: string;
  instanceUrl: string;
  apiKey: string;
  phoneNumber: string;
  active?: boolean;
  template48h?: string;
  template2h?: string;
}

@Injectable()
export class WhatsappService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => BaileysService)) private baileys: BaileysService,
  ) {}

  // ─── SSRF Guard — validar instanceUrl antes de salvar (VULN-002) ─────────────

  private validateInstanceUrl(rawUrl: string): void {
    // Baileys usa 'local' como placeholder — permitido
    if (rawUrl === 'local') return;

    let url: URL;
    try { url = new URL(rawUrl); } catch {
      throw new BadRequestException('instanceUrl inválida');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('instanceUrl deve usar http ou https');
    }

    // Bloquear IPs privados, loopback e link-local (SSRF)
    const h = url.hostname.toLowerCase();
    const blocklist = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^169\.254\./,         // link-local / AWS metadata
      /^::1$/,               // IPv6 loopback
      /^fc00:/,              // IPv6 ULA
      /^fd/,                 // IPv6 ULA
      /^0\./,                // 0.x.x.x
      /^metadata\.google/,   // GCP metadata
    ];
    if (blocklist.some((re) => re.test(h))) {
      throw new BadRequestException('instanceUrl aponta para endereço interno não permitido');
    }
  }

  // ─── Config CRUD ─────────────────────────────────────────────────────────────

  async getConfig(tenantId: string) {
    return this.prisma.whatsappConfig.findUnique({ where: { tenantId } });
  }

  async saveConfig(tenantId: string, dto: WhatsappConfigDto) {
    // VULN-002: validar URL antes de persistir
    if (dto.instanceUrl) this.validateInstanceUrl(dto.instanceUrl);

    return this.prisma.whatsappConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async deleteConfig(tenantId: string) {
    return this.prisma.whatsappConfig.delete({ where: { tenantId } });
  }

  async testMessage(tenantId: string, phone: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { tenantId } });
    if (!config || !config.active) throw new NotFoundException('WhatsApp não configurado ou inativo');
    await this.sendMessage(config, phone, '✅ Mensagem de teste do InkHub. Tudo funcionando!');
    return { sent: true };
  }

  // ─── Send via Evolution API ───────────────────────────────────────────────────

  private async sendMessage(config: any, phone: string, text: string): Promise<string | null> {
    try {
      // ── Baileys (QR nativo, sem API externa) ─────────────────────────────────
      if (config.provider === 'baileys') {
        const ok = await this.baileys.sendMessage(config.tenantId, phone, text);
        return ok ? `baileys-${Date.now()}` : null;
      }

      // ── Evolution API ─────────────────────────────────────────────────────────
      const normalized = phone.replace(/\D/g, '');
      const fullPhone = normalized.startsWith('55') ? normalized : `55${normalized}`;

      if (config.provider === 'evolution' || !config.provider) {
        const res = await axios.post(
          `${config.instanceUrl}/message/sendText/inkhub`,
          {
            number: `${fullPhone}@s.whatsapp.net`,
            textMessage: { text },
          },
          {
            headers: { apikey: config.apiKey },
            timeout: 10000,
          },
        );
        return res.data?.key?.id ?? null;
      }

      return null;
    } catch (err) {
      console.error('[WhatsApp] send error:', err?.message);
      return null;
    }
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }

  // ─── Scheduled: 48h reminders at 09:00 ───────────────────────────────────────

  @Cron('0 9 * * *')
  async send48hReminders() {
    const configs = await this.prisma.whatsappConfig.findMany({ where: { active: true } });

    for (const config of configs) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tStart = new Date(tomorrow);
      tStart.setHours(0, 0, 0, 0);
      const tEnd = new Date(tomorrow);
      tEnd.setHours(23, 59, 59, 999);

      const appointments = await this.prisma.appointment.findMany({
        where: {
          tenantId: config.tenantId,
          date: { gte: tStart, lte: tEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
          deletedAt: null,
        },
        include: {
          client: { select: { name: true, phone: true } },
          artist: { include: { user: { select: { name: true } } } },
        },
      });

      for (const apt of appointments) {
        if (!apt.client.phone) continue;

        // Check if already sent
        const already = await this.prisma.whatsappMessage.findFirst({
          where: { tenantId: config.tenantId, appointmentId: apt.id, type: 'reminder_48h' },
        });
        if (already) continue;

        const text = this.interpolate(config.template48h, {
          nome: apt.client.name,
          hora: format(apt.date, 'HH:mm', { locale: ptBR }),
          estudio: (await this.prisma.tenant.findUnique({ where: { id: config.tenantId }, select: { name: true } }))?.name ?? 'estúdio',
          tatuador: apt.artist.user.name,
        });

        const externalId = await this.sendMessage(config, apt.client.phone, text);

        await this.prisma.whatsappMessage.create({
          data: {
            tenantId: config.tenantId,
            appointmentId: apt.id,
            clientPhone: apt.client.phone,
            direction: 'outbound',
            body: text,
            type: 'reminder_48h',
            status: externalId ? 'sent' : 'failed',
            externalId,
            sentAt: new Date(),
          },
        });
      }
    }
  }

  // ─── Scheduled: 2h reminders every 30min ─────────────────────────────────────

  @Cron('*/30 * * * *')
  async send2hReminders() {
    const configs = await this.prisma.whatsappConfig.findMany({ where: { active: true } });

    for (const config of configs) {
      const now = new Date();
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const windowStart = new Date(in2h.getTime() - 15 * 60 * 1000);
      const windowEnd = new Date(in2h.getTime() + 15 * 60 * 1000);

      const appointments = await this.prisma.appointment.findMany({
        where: {
          tenantId: config.tenantId,
          date: { gte: windowStart, lte: windowEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
          deletedAt: null,
        },
        include: {
          client: { select: { name: true, phone: true } },
          artist: { include: { user: { select: { name: true } } } },
        },
      });

      for (const apt of appointments) {
        if (!apt.client.phone) continue;

        const already = await this.prisma.whatsappMessage.findFirst({
          where: { tenantId: config.tenantId, appointmentId: apt.id, type: 'reminder_2h' },
        });
        if (already) continue;

        const tenant = await this.prisma.tenant.findUnique({ where: { id: config.tenantId }, select: { name: true } });
        const text = this.interpolate(config.template2h, {
          nome: apt.client.name,
          hora: format(apt.date, 'HH:mm', { locale: ptBR }),
          estudio: tenant?.name ?? 'estúdio',
          tatuador: apt.artist.user.name,
        });

        const externalId = await this.sendMessage(config, apt.client.phone, text);

        await this.prisma.whatsappMessage.create({
          data: {
            tenantId: config.tenantId,
            appointmentId: apt.id,
            clientPhone: apt.client.phone,
            direction: 'outbound',
            body: text,
            type: 'reminder_2h',
            status: externalId ? 'sent' : 'failed',
            externalId,
            sentAt: new Date(),
          },
        });
      }
    }
  }

  // ─── Webhook: receive client replies ─────────────────────────────────────────

  async handleWebhook(payload: any) {
    try {
      const data = payload?.data;
      if (!data) return { ok: true };

      const phone = data.key?.remoteJid?.replace('@s.whatsapp.net', '') ?? '';
      const body = (data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? '').trim().toUpperCase();

      if (!phone || !body) return { ok: true };

      // Find pending appointment for this phone
      const msg = await this.prisma.whatsappMessage.findFirst({
        where: { clientPhone: { contains: phone.slice(-9) }, type: 'reminder_48h', status: 'sent' },
        orderBy: { createdAt: 'desc' },
      });

      if (!msg?.appointmentId) return { ok: true };

      if (body === 'SIM' || body === 'S') {
        await this.prisma.appointment.update({
          where: { id: msg.appointmentId },
          data: { status: 'CONFIRMED' },
        });
      } else if (body === 'NÃO' || body === 'NAO' || body === 'N') {
        await this.prisma.appointment.update({
          where: { id: msg.appointmentId },
          data: { status: 'CANCELLED' },
        });
      }

      await this.prisma.whatsappMessage.create({
        data: {
          tenantId: msg.tenantId,
          appointmentId: msg.appointmentId,
          clientPhone: phone,
          direction: 'inbound',
          body,
          type: 'reply',
          status: 'received',
          sentAt: new Date(),
        },
      });

      return { ok: true };
    } catch (err) {
      console.error('[WhatsApp webhook]', err);
      return { ok: true };
    }
  }

  async getMessages(tenantId: string, appointmentId?: string) {
    return this.prisma.whatsappMessage.findMany({
      where: {
        tenantId,
        ...(appointmentId && { appointmentId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async sendManual(tenantId: string, phone: string, body: string, appointmentId?: string) {
    const config = await this.prisma.whatsappConfig.findUnique({ where: { tenantId } });
    if (!config || !config.active) throw new NotFoundException('WhatsApp não configurado');

    const externalId = await this.sendMessage(config, phone, body);
    return this.prisma.whatsappMessage.create({
      data: {
        tenantId,
        appointmentId: appointmentId ?? null,
        clientPhone: phone,
        direction: 'outbound',
        body,
        type: 'manual',
        status: externalId ? 'sent' : 'failed',
        externalId,
        sentAt: new Date(),
      },
    });
  }
}
