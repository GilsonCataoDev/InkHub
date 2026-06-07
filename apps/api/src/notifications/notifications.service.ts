import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface AppointmentConfirmationData {
  clientName: string;
  clientEmail: string;
  artistName: string;
  date: Date;
  description?: string;
  studioName: string;
}

export interface NotificationProvider {
  sendAppointmentConfirmation(data: AppointmentConfirmationData): Promise<void>;
}

@Injectable()
export class NotificationsService implements NotificationProvider {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT') ?? 587,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  async sendAppointmentConfirmation(data: AppointmentConfirmationData): Promise<void> {
    if (!this.transporter || !data.clientEmail) {
      this.logger.warn(`[SMTP] Confirmação não enviada — SMTP não configurado ou e-mail ausente`);
      return;
    }

    const dateStr = data.date.toLocaleString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; padding: 32px; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #000; font-size: 18px;">I</div>
          <span style="font-size: 18px; font-weight: 700;">${data.studioName}</span>
        </div>
        <h1 style="font-size: 22px; margin-bottom: 8px; color: #f59e0b;">Agendamento confirmado! ✓</h1>
        <p style="color: #a1a1a1; margin-bottom: 24px;">Olá, <strong style="color: #f5f5f5;">${data.clientName}</strong>. Seu agendamento foi confirmado.</p>
        <div style="background: #171717; border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid #262626;">
          <div style="margin-bottom: 12px;">
            <span style="color: #737373; font-size: 12px; display: block;">Tatuador</span>
            <span style="font-weight: 600;">${data.artistName}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <span style="color: #737373; font-size: 12px; display: block;">Data e hora</span>
            <span style="font-weight: 600; color: #f59e0b;">${dateStr}</span>
          </div>
          ${data.description ? `<div>
            <span style="color: #737373; font-size: 12px; display: block;">Trabalho</span>
            <span>${data.description}</span>
          </div>` : ''}
        </div>
        <p style="color: #737373; font-size: 13px;">Qualquer dúvida, entre em contato com o estúdio.</p>
        <hr style="border: none; border-top: 1px solid #262626; margin: 24px 0;" />
        <p style="color: #525252; font-size: 12px;">Este e-mail foi enviado automaticamente pelo InkHub.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? 'noreply@inkhub.app',
        to: data.clientEmail,
        subject: `Agendamento confirmado — ${data.studioName}`,
        html,
      });
      this.logger.log(`E-mail de confirmação enviado para ${data.clientEmail}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail: ${(err as Error).message}`);
    }
  }

  async sendGenericEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? 'noreply@inkhub.app',
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail genérico: ${(err as Error).message}`);
    }
  }
}
