import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaileysService } from '../whatsapp/baileys.service';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';

export interface CreateAutomationDto {
  name: string;
  trigger: string;
  delayDays?: number;
  channel?: string;
  subject?: string;
  template: string;
  active?: boolean;
}

export interface UpdateAutomationDto extends Partial<CreateAutomationDto> {}

const TRIGGER_LABELS: Record<string, string> = {
  birthday: 'Aniversário do cliente',
  post_session: 'Pós-sessão',
  inactive_30: 'Cliente inativo 30 dias',
  inactive_60: 'Cliente inativo 60 dias',
  touchup_due: 'Retoque pendente',
};

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);
  private mailer = nodemailer.createTransport({
    host: process.env['SMTP_HOST'] ?? 'smtp.gmail.com',
    port: Number(process.env['SMTP_PORT'] ?? 587),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: {
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS'],
    },
  });

  constructor(
    private prisma: PrismaService,
    private baileys: BaileysService,
  ) {}

  async findAll(tenantId: string) {
    const automations = await this.prisma.automation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { executions: true } } },
    });
    return automations.map((a) => ({
      ...a,
      triggerLabel: TRIGGER_LABELS[a.trigger] ?? a.trigger,
    }));
  }

  async create(tenantId: string, dto: CreateAutomationDto) {
    return this.prisma.automation.create({
      data: {
        tenantId,
        name: dto.name,
        trigger: dto.trigger,
        delayDays: dto.delayDays ?? 0,
        channel: dto.channel ?? 'whatsapp',
        subject: dto.subject ?? null,
        template: dto.template,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateAutomationDto) {
    await this.findOneOrFail(id, tenantId);
    return this.prisma.automation.update({ where: { id }, data: dto });
  }

  async toggle(id: string, tenantId: string) {
    const a = await this.findOneOrFail(id, tenantId);
    return this.prisma.automation.update({
      where: { id },
      data: { active: !a.active },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOneOrFail(id, tenantId);
    return this.prisma.automation.delete({ where: { id } });
  }

  async getLogs(id: string, tenantId: string) {
    await this.findOneOrFail(id, tenantId);
    return this.prisma.automationExecution.findMany({
      where: { automationId: id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  private async findOneOrFail(id: string, tenantId: string) {
    const a = await this.prisma.automation.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Automação não encontrada');
    return a;
  }

  getTemplates() {
    return [
      {
        trigger: 'birthday',
        name: 'Feliz aniversário',
        channel: 'whatsapp',
        template: 'Feliz aniversário, {nome}! 🎂🎉 O {estudio} te deseja um dia incrível. Que tal comemorar com uma nova tatuagem? Fale com a gente!',
        delayDays: 0,
      },
      {
        trigger: 'post_session',
        name: 'Cuidados pós-tattoo',
        channel: 'whatsapp',
        template: 'Oi {nome}! Como está a sua tatuagem? 🎨 Lembre-se: mantenha hidratada, evite sol direto e piscina por 15 dias. Qualquer dúvida, estamos aqui!',
        delayDays: 3,
      },
      {
        trigger: 'inactive_30',
        name: 'Cliente inativo — 30 dias',
        channel: 'whatsapp',
        template: 'Oi {nome}, sumiu! 😄 Faz um tempinho que não te vemos por aqui no {estudio}. Tem alguma ideia nova de tatuagem? Seria um prazer te atender novamente!',
        delayDays: 0,
      },
      {
        trigger: 'inactive_60',
        name: 'Cliente inativo — 60 dias',
        channel: 'whatsapp',
        template: 'Saudades de você, {nome}! 🖤 Já faz 2 meses desde sua última visita ao {estudio}. Passando pra saber se está tudo bem e se posso te ajudar com algo!',
        delayDays: 0,
      },
      {
        trigger: 'touchup_due',
        name: 'Lembrete de retoque',
        channel: 'whatsapp',
        template: 'Oi {nome}! Lembrando que seu retoque está chegando. 🎨 Entre em contato com a gente no {estudio} para agendar! A cicatrização foi bem?',
        delayDays: 0,
      },
    ];
  }

  // ─── Daily job at 08:00 ────────────────────────────────────────────────────

  @Cron('0 8 * * *')
  async runDailyAutomations() {
    const automations = await this.prisma.automation.findMany({
      where: { active: true },
    });

    for (const automation of automations) {
      try {
        await this.runAutomation(automation);
      } catch (err) {
        console.error(`[Automation ${automation.id}] error:`, err?.message);
      }
    }
  }

  private async runAutomation(automation: any) {
    const tenantId = automation.tenantId;
    const today = new Date();

    let clients: any[] = [];

    if (automation.trigger === 'birthday') {
      clients = await this.prisma.client.findMany({
        where: {
          tenantId,
          deletedAt: null,
          birthDate: { not: null },
        },
      });
      clients = clients.filter((c) => {
        if (!c.birthDate) return false;
        const bd = new Date(c.birthDate);
        return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
      });
    } else if (automation.trigger === 'post_session') {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - automation.delayDays);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const checkouts = await this.prisma.sessionCheckout.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        include: {
          appointment: {
            include: { client: true },
          },
        },
      });
      clients = checkouts.map((c) => c.appointment.client).filter(Boolean);
    } else if (automation.trigger === 'inactive_30' || automation.trigger === 'inactive_60') {
      const days = automation.trigger === 'inactive_30' ? 30 : 60;
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - days);

      // Clients whose last appointment was exactly `days` ago
      const appointments = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          date: {
            gte: new Date(cutoff.getTime() - 24 * 60 * 60 * 1000),
            lte: cutoff,
          },
          deletedAt: null,
        },
        include: { client: true },
        distinct: ['clientId'],
      });

      // Filter: no future appointments
      const futureAppointments = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          date: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] },
          deletedAt: null,
        },
        select: { clientId: true },
      });
      const futureClientIds = new Set(futureAppointments.map((a) => a.clientId));
      clients = appointments.map((a) => a.client).filter((c) => !futureClientIds.has(c.id));
    }

    for (const client of clients) {
      // Check if already executed today
      const already = await this.prisma.automationExecution.findFirst({
        where: {
          automationId: automation.id,
          clientId: client.id,
          sentAt: { gte: new Date(today.setHours(0, 0, 0, 0)) },
        },
      });
      if (already) continue;

      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const body = automation.template
        .replace('{nome}', client.name)
        .replace('{estudio}', tenant?.name ?? 'estúdio');

      // ── Envio real ─────────────────────────────────────────────────────────
      let status = 'sent';
      let error: string | null = null;

      const wppConfig = await this.prisma.whatsappConfig.findUnique({
        where: { tenantId },
      });

      const sendWhatsApp = async () => {
        if (!client.phone || !wppConfig?.active) return false;
        try {
          const normalized = client.phone.replace(/\D/g, '');
          const jid = normalized.startsWith('55') ? `${normalized}@s.whatsapp.net` : `55${normalized}@s.whatsapp.net`;

          if (wppConfig.provider === 'baileys') {
            return await this.baileys.sendMessage(tenantId, client.phone, body);
          }

          if (wppConfig.provider === 'evolution' && wppConfig.instanceUrl) {
            const { default: axios } = await import('axios');
            await axios.post(
              `${wppConfig.instanceUrl}/message/sendText/inkhub`,
              { number: jid, textMessage: { text: body } },
              { headers: { apikey: wppConfig.apiKey }, timeout: 10000 },
            );
            return true;
          }
        } catch (e) {
          this.logger.error(`[Automation WPP] ${e?.message}`);
        }
        return false;
      };

      const sendEmail = async () => {
        if (!client.email) return false;
        if (!process.env['SMTP_USER']) return false;
        try {
          await this.mailer.sendMail({
            from: `"${tenant?.name}" <${process.env['SMTP_USER']}>`,
            to: client.email,
            subject: automation.subject ?? automation.name,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
          });
          return true;
        } catch (e) {
          this.logger.error(`[Automation Email] ${e?.message}`);
          return false;
        }
      };

      try {
        const ch = automation.channel;
        if (ch === 'whatsapp') await sendWhatsApp();
        else if (ch === 'email') await sendEmail();
        else if (ch === 'both') { await sendWhatsApp(); await sendEmail(); }
      } catch (e) {
        status = 'failed';
        error = e?.message ?? 'unknown';
      }

      await this.prisma.automationExecution.create({
        data: {
          automationId: automation.id,
          clientId: client.id,
          channel: automation.channel,
          status,
          error,
        },
      });

      this.logger.log(`[Automation] ${automation.name} → ${client.name}: ${status}`);
    }

    await this.prisma.automation.update({
      where: { id: automation.id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
      },
    });
  }
}
