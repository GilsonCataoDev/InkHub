/**
 * BaileysService
 * Gerencia conexões WhatsApp via QR Code por tenant.
 * Usa @whiskeysockets/baileys (unofficial WA Web API).
 * Cada tenant tem sua própria sessão armazenada em ./auth_sessions/{tenantId}/
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export interface WaSession {
  status: 'connecting' | 'qr' | 'connected' | 'disconnected';
  qrBase64?: string;       // data URL para exibir no frontend
  qrString?: string;       // string bruta do QR
  phone?: string;          // número conectado
  connectedAt?: Date;
}

@Injectable()
export class BaileysService {
  private readonly logger = new Logger(BaileysService.name);
  private sessions = new Map<string, WaSession>();
  private sockets = new Map<string, any>();
  private readonly basePath = join(process.cwd(), 'auth_sessions');

  constructor(private prisma: PrismaService) {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  getSession(tenantId: string): WaSession {
    return this.sessions.get(tenantId) ?? { status: 'disconnected' };
  }

  async connect(tenantId: string): Promise<WaSession> {
    // Se já conectado, retorna status atual
    const current = this.sessions.get(tenantId);
    if (current?.status === 'connected') return current;

    // Se já está conectando (aguardando QR), retorna o QR atual
    if (current?.status === 'qr' || current?.status === 'connecting') return current;

    await this.startSession(tenantId);
    return this.sessions.get(tenantId) ?? { status: 'connecting' };
  }

  async disconnect(tenantId: string) {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      try { await sock.logout(); } catch { /* ignore */ }
      this.sockets.delete(tenantId);
    }
    this.sessions.set(tenantId, { status: 'disconnected' });

    // Remove session files
    const sessionPath = join(this.basePath, tenantId);
    if (existsSync(sessionPath)) {
      rmSync(sessionPath, { recursive: true, force: true });
    }

    // Update DB config to inactive
    await this.prisma.whatsappConfig.updateMany({
      where: { tenantId },
      data: { active: false },
    });
  }

  async sendMessage(tenantId: string, phone: string, text: string): Promise<boolean> {
    const sock = this.sockets.get(tenantId);
    const session = this.sessions.get(tenantId);
    if (!sock || session?.status !== 'connected') return false;

    try {
      const normalized = phone.replace(/\D/g, '');
      const jid = normalized.startsWith('55') ? `${normalized}@s.whatsapp.net` : `55${normalized}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text });
      return true;
    } catch (err) {
      this.logger.error(`[${tenantId}] sendMessage error: ${err?.message}`);
      return false;
    }
  }

  private async startSession(tenantId: string) {
    const sessionPath = join(this.basePath, tenantId);
    if (!existsSync(sessionPath)) {
      mkdirSync(sessionPath, { recursive: true });
    }

    this.sessions.set(tenantId, { status: 'connecting' });
    this.logger.log(`[${tenantId}] Starting Baileys session...`);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, { logger: { level: 'silent' } } as any),
        },
        printQRInTerminal: false,
        logger: { level: 'silent' } as any,
        browser: ['InkHub', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 5,
      });

      this.sockets.set(tenantId, sock);

      // QR Code
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          const qrBase64 = await QRCode.toDataURL(qr);
          this.sessions.set(tenantId, { status: 'qr', qrBase64, qrString: qr });
          this.logger.log(`[${tenantId}] QR Code gerado`);
        }

        if (connection === 'open') {
          const phone = sock.user?.id?.split(':')[0] ?? '';
          this.sessions.set(tenantId, { status: 'connected', phone, connectedAt: new Date() });
          this.logger.log(`[${tenantId}] Connected! Phone: ${phone}`);

          // Save connection info to DB
          await this.prisma.whatsappConfig.upsert({
            where: { tenantId },
            create: {
              tenantId,
              provider: 'baileys',
              instanceUrl: 'local',
              apiKey: 'local',
              phoneNumber: phone,
              active: true,
            },
            update: {
              provider: 'baileys',
              phoneNumber: phone,
              active: true,
            },
          });
        }

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;
          this.logger.log(`[${tenantId}] Connection closed. Reason: ${reason}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            // Reconnect after 3s
            setTimeout(() => this.startSession(tenantId), 3000);
          } else {
            // Logged out - clear session
            await this.disconnect(tenantId);
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      // ── Inbound: SIM/NÃO replies ─────────────────────────────────────────────
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          const phone = (msg.key.remoteJid ?? '').replace('@s.whatsapp.net', '').replace('@g.us', '');
          if (!phone || msg.key.remoteJid?.endsWith('@g.us')) continue; // ignore groups

          const body = (
            msg.message?.conversation ??
            msg.message?.extendedTextMessage?.text ?? ''
          ).trim().toUpperCase();

          if (!body) continue;

          try {
            // Find last outbound reminder to this phone for this tenant
            const waMsg = await this.prisma.whatsappMessage.findFirst({
              where: {
                tenantId,
                clientPhone: { contains: phone.slice(-9) },
                type: { in: ['reminder_48h', 'reminder_2h'] },
                status: 'sent',
              },
              orderBy: { createdAt: 'desc' },
            });

            if (!waMsg?.appointmentId) continue;

            if (['SIM', 'S', 'OK', 'CONFIRMO'].includes(body)) {
              await this.prisma.appointment.update({
                where: { id: waMsg.appointmentId },
                data: { status: 'CONFIRMED' },
              });
            } else if (['NÃO', 'NAO', 'N', 'CANCELO', 'CANCELAR'].includes(body)) {
              await this.prisma.appointment.update({
                where: { id: waMsg.appointmentId },
                data: { status: 'CANCELLED' },
              });
            } else {
              continue; // palavra-chave não reconhecida — ignora
            }

            await this.prisma.whatsappMessage.create({
              data: {
                tenantId,
                appointmentId: waMsg.appointmentId,
                clientPhone: phone,
                direction: 'inbound',
                body,
                type: 'reply',
                status: 'received',
                sentAt: new Date(),
              },
            });

            this.logger.log(`[${tenantId}] Inbound reply "${body}" from ${phone} → appointment ${waMsg.appointmentId}`);
          } catch (err) {
            this.logger.error(`[${tenantId}] inbound handler error: ${err?.message}`);
          }
        }
      });

    } catch (err) {
      this.logger.error(`[${tenantId}] Session error: ${err?.message}`);
      this.sessions.set(tenantId, { status: 'disconnected' });
    }
  }

  /** Restore sessions on app startup */
  async restoreExistingSessions() {
    try {
      const configs = await this.prisma.whatsappConfig.findMany({
        where: { provider: 'baileys', active: true },
        select: { tenantId: true },
      });
      for (const { tenantId } of configs) {
        const sessionPath = join(this.basePath, tenantId);
        if (existsSync(sessionPath)) {
          this.logger.log(`[${tenantId}] Restoring existing session...`);
          await this.startSession(tenantId);
        }
      }
    } catch (err) {
      this.logger.error('restoreExistingSessions error:', err?.message);
    }
  }
}
