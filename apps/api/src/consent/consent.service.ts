import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import { join } from 'path';
import { createWriteStream, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const CONSENT_TEXT = `
TERMO DE CONSENTIMENTO INFORMADO PARA TATUAGEM

Eu, abaixo identificado(a), declaro estar ciente e de acordo com as seguintes condições:

1. PROCEDIMENTO
O procedimento de tatuagem é realizado com agulhas estéreis descartáveis e tintas homologadas. Compreendo que a tatuagem é permanente e que sua remoção é dispendiosa e pode ser incompleta.

2. RISCOS
Estou ciente dos riscos envolvidos, incluindo: reações alérgicas às tintas, infecções caso os cuidados pós-procedimento não sejam seguidos, queloides em peles predispostas, e variações na cicatrização conforme cada organismo.

3. CUIDADOS PÓS-PROCEDIMENTO
Comprometo-me a seguir todas as orientações de cuidado fornecidas pelo tatuador, incluindo: manter a área limpa e hidratada, evitar exposição solar direta, não mergulhar em piscinas ou mar durante a cicatrização, e não coçar ou arranhar a área.

4. CONDIÇÕES DE SAÚDE
Declaro não possuir condições de saúde que contraindiquem o procedimento (diabetes descompensada, distúrbios de coagulação, doenças de pele na área a ser tatuada, gravidez ou amamentação) sem ter informado previamente ao tatuador.

5. MAIORIDADE E RESPONSABILIDADE
Declaro ser maior de 18 anos ou estar acompanhado(a) de responsável legal. Assumo total responsabilidade pelas informações fornecidas neste documento.

6. FOTOGRAFIA E PORTFÓLIO
Autorizo o uso de fotos do trabalho realizado para fins de portfólio e divulgação em redes sociais, sem identificação pessoal, salvo com meu consentimento expresso.

Ao assinar este documento (digitalmente, via checkbox + registro de IP e timestamp), confirmo que li, compreendi e concordo com todos os termos acima.
`;

@Injectable()
export class ConsentService {
  constructor(private prisma: PrismaService) {}

  async sign(
    clientId: string,
    tenantId: string,
    ipAddress: string,
    userAgent?: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      include: { tenant: { select: { name: true } } },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const uploadDir = join(process.cwd(), process.env['UPLOAD_DEST'] ?? 'uploads', 'consents');
    mkdirSync(uploadDir, { recursive: true });

    const filename = `consent-${uuidv4()}.pdf`;
    const filepath = join(uploadDir, filename);
    const pdfUrl = `/uploads/consents/${filename}`;

    await this.generatePdf(filepath, {
      clientName: client.name,
      cpf: client.cpf ?? 'Não informado',
      signedAt: new Date(),
      ipAddress,
      studioName: client.tenant.name,
    });

    return this.prisma.consent.create({
      data: {
        tenantId,
        clientId,
        ipAddress,
        userAgent: userAgent ?? '',
        content: CONSENT_TEXT,
        pdfUrl,
      },
    });
  }

  async getConsents(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, tenantId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return this.prisma.consent.findMany({
      where: { clientId, tenantId },
      orderBy: { signedAt: 'desc' },
    });
  }

  private generatePdf(
    filepath: string,
    data: { clientName: string; cpf: string; signedAt: Date; ipAddress: string; studioName: string },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).fillColor('#f59e0b').text('InkHub', { align: 'center' });
      doc.fontSize(14).fillColor('#333').text(data.studioName, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor('#000').text('Termo de Consentimento Informado', { align: 'center', underline: true });
      doc.moveDown();

      // Dados do cliente
      doc.fontSize(11).fillColor('#000');
      doc.text(`Cliente: ${data.clientName}`);
      doc.text(`CPF: ${data.cpf}`);
      doc.text(`Data de assinatura: ${data.signedAt.toLocaleString('pt-BR')}`);
      doc.moveDown();

      // Corpo do termo
      doc.fontSize(10).fillColor('#333').text(CONSENT_TEXT.trim(), { align: 'justify', lineGap: 3 });
      doc.moveDown();

      // Rodapé de assinatura digital
      doc.fontSize(9).fillColor('#666');
      doc.text('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      doc.text(`Assinado digitalmente por: ${data.clientName}`);
      doc.text(`IP do dispositivo: ${data.ipAddress}`);
      doc.text(`Timestamp: ${data.signedAt.toISOString()}`);
      doc.text('Gerado pelo sistema InkHub · inkhub.app');

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }
}
