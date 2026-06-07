import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LgpdService {
  constructor(private prisma: PrismaService) {}

  /**
   * VULN-013 / LGPD Art. 18, VII — Direito ao esquecimento
   * Anonimiza todos os dados pessoais do cliente sem destruir o histórico financeiro.
   */
  async forgetMe(clientId: string, tenantId: string): Promise<{ message: string }> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const anon = `[REMOVIDO-${Date.now()}]`;

    await this.prisma.$transaction([
      // Anonimiza o registro principal
      this.prisma.client.update({
        where: { id: clientId },
        data: {
          name: anon,
          email: null,
          phone: null,
          cpf: null,
          birthDate: null,
          notes: null,
          avatarUrl: null,
          deletedAt: new Date(),
        },
      }),
      // Remove consentimentos (dados assinados digitalmente — podem ser purged)
      this.prisma.consent.deleteMany({ where: { clientId } }),
      // Anonimiza anamneses
      this.prisma.anamnesis.updateMany({
        where: { clientId },
        data: { fields: {} },
      }),
      // Remove fotos
      this.prisma.photo.updateMany({
        where: { clientId },
        data: { url: anon, deletedAt: new Date() },
      }),
      // Remove interações CRM
      this.prisma.interaction.deleteMany({ where: { clientId } }),
    ]);

    return { message: 'Dados pessoais removidos conforme LGPD Art. 18' };
  }

  /**
   * VULN-013 / LGPD Art. 18, V — Direito de acesso / portabilidade
   * Exporta todos os dados pessoais do cliente em formato estruturado (JSON).
   */
  async exportData(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    // Busca relações em paralelo para evitar query gigante
    const [consents, anamnesis, loyaltyPoints, appointments, interactions] = await Promise.all([
      this.prisma.consent.findMany({
        where: { clientId },
        select: { signedAt: true, ipAddress: true, content: true },
      }),
      this.prisma.anamnesis.findMany({
        where: { clientId },
        select: { fields: true, updatedAt: true },
      }),
      this.prisma.loyaltyPoints.findFirst({
        where: { clientId },
        select: { points: true },
      }),
      this.prisma.appointment.findMany({
        where: { clientId, deletedAt: null },
        select: {
          date: true,
          status: true,
          notes: true,
          payments: { select: { amount: true, method: true, status: true, paidAt: true } },
        },
      }),
      this.prisma.interaction.findMany({
        where: { clientId },
        select: { type: true, description: true, createdAt: true },
      }),
    ]);

    // Estrutura de exportação padronizada (LGPD Art. 18 §1º)
    return {
      exportedAt: new Date().toISOString(),
      dataController: { tenantId },
      subject: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        birthDate: client.birthDate,
        createdAt: client.createdAt,
      },
      consents,
      anamnesis,
      loyaltyPoints: loyaltyPoints?.points ?? 0,
      appointments,
      interactions,
    };
  }
}
