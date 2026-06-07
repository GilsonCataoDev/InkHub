import { Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CashFlowType, InvoiceType, InvoiceStatus } from '@prisma/client';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  async getCashFlow(tenantId: string, startDate: string, endDate: string) {
    const entries = await this.prisma.cashFlow.findMany({
      where: {
        tenantId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { date: 'desc' },
    });

    const totalIncome = entries
      .filter((e) => e.type === CashFlowType.INCOME)
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalExpense = entries
      .filter((e) => e.type === CashFlowType.EXPENSE)
      .reduce((s, e) => s + Number(e.amount), 0);

    return { entries, totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }

  async createCashFlowEntry(tenantId: string, dto: {
    type: CashFlowType; amount: number; category: string;
    description: string; date?: string; source?: string;
  }) {
    return this.prisma.cashFlow.create({
      data: {
        tenantId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
        source: dto.source,
      },
    });
  }

  async getInvoices(tenantId: string, type?: InvoiceType, status?: InvoiceStatus) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(type && { type }),
        ...(status && { status }),
      },
      include: { items: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createInvoice(tenantId: string, dto: {
    type: InvoiceType; description: string; amount: number;
    dueDate: string; category?: string; notes?: string;
  }) {
    return this.prisma.invoice.create({
      data: {
        tenantId,
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        category: dto.category,
        notes: dto.notes,
      },
    });
  }

  async payInvoice(id: string, tenantId: string, paidAmount: number) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        paidAmount,
      },
    });

    await this.prisma.cashFlow.create({
      data: {
        tenantId,
        type: invoice.type === InvoiceType.RECEIVABLE ? CashFlowType.INCOME : CashFlowType.EXPENSE,
        amount: paidAmount,
        category: invoice.category ?? 'Geral',
        description: `Pagamento: ${invoice.description}`,
        date: new Date(),
      },
    });

    return updated;
  }

  async getDRE(tenantId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const cashFlows = await this.prisma.cashFlow.findMany({
      where: { tenantId, date: { gte: start, lt: end } },
    });

    const bySource: Record<string, number> = {};
    let grossRevenue = 0;
    let totalCosts = 0;

    for (const entry of cashFlows) {
      const amount = Number(entry.amount);
      if (entry.type === CashFlowType.INCOME) {
        grossRevenue += amount;
        const src = entry.source ?? entry.category;
        bySource[src] = (bySource[src] ?? 0) + amount;
      } else {
        totalCosts += amount;
      }
    }

    return {
      month,
      year,
      grossRevenue,
      totalCosts,
      netProfit: grossRevenue - totalCosts,
      margin: grossRevenue > 0 ? ((grossRevenue - totalCosts) / grossRevenue) * 100 : 0,
      revenueBySource: bySource,
    };
  }

  async getDashboardSummary(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, appointmentsToday, lowStock] = await Promise.all([
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: todayStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: weekStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.cashFlow.aggregate({
        where: { tenantId, type: CashFlowType.INCOME, date: { gte: monthStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.appointment.count({
        where: { tenantId, deletedAt: null, date: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.product.count({
        where: { tenantId, deletedAt: null, active: true, stock: { lte: 5 } },
      }),
    ]);

    return {
      revenue: {
        today: Number(today._sum.amount ?? 0),
        week: Number(week._sum.amount ?? 0),
        month: Number(month._sum.amount ?? 0),
      },
      appointmentsToday,
      lowStockAlerts: lowStock,
    };
  }

  async exportCsv(tenantId: string, startDate: string, endDate: string, res: Response) {
    const { entries } = await this.getCashFlow(tenantId, startDate, endDate);
    const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
    const rows = entries.map((e) =>
      [
        new Date(e.date).toLocaleDateString('pt-BR'),
        e.type === 'INCOME' ? 'Entrada' : 'Saída',
        e.category,
        `"${e.description.replace(/"/g, '""')}"`,
        Number(e.amount).toFixed(2).replace('.', ','),
      ].join(','),
    );
    const csv = '﻿' + header + rows.join('\n'); // BOM para Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fluxo-caixa-${startDate}-${endDate}.csv"`);
    res.send(csv);
  }

  async exportPdf(tenantId: string, month: number, year: number, res: Response) {
    const dre = await this.getDRE(tenantId, month, year);
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
    const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dre-${year}-${String(month).padStart(2, '0')}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#f59e0b').text('InkHub', { align: 'center' });
    doc.fontSize(13).fillColor('#333').text(tenant?.name ?? 'Studio', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#000').text(`DRE — ${monthName}`, { align: 'center', underline: true });
    doc.moveDown();

    const fmt = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const line = (label: string, value: string, bold = false) => {
      doc.fontSize(11).fillColor(bold ? '#000' : '#333');
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(label, 50, doc.y, { continued: true });
      doc.text(value, { align: 'right' });
    };

    line('Receita Bruta', fmt(dre.grossRevenue), true);
    doc.moveDown(0.3);
    line('Custos e Despesas', `(${fmt(dre.totalCosts)})`);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e5e5').stroke();
    doc.moveDown(0.3);
    line('Lucro Líquido', fmt(dre.netProfit), true);
    doc.fontSize(10).fillColor('#666').text(`Margem: ${dre.margin.toFixed(1)}%`);
    doc.moveDown();

    if (Object.keys(dre.revenueBySource).length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#000').font('Helvetica-Bold').text('Receita por Fonte');
      doc.font('Helvetica');
      for (const [src, val] of Object.entries(dre.revenueBySource)) {
        doc.moveDown(0.2);
        line(src.charAt(0).toUpperCase() + src.slice(1), fmt(val as number));
      }
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#aaa').text(`Gerado em ${new Date().toLocaleString('pt-BR')} · InkHub`, { align: 'center' });
    doc.end();
  }
}
