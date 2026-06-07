import { Test, TestingModule } from '@nestjs/testing';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashFlowType, InvoiceType, InvoiceStatus } from '@prisma/client';

const TENANT_ID = 'tenant-test';

const mockPrisma = {
  cashFlow: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  invoice: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('FinancialService', () => {
  let service: FinancialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FinancialService>(FinancialService);
    jest.clearAllMocks();
  });

  describe('getCashFlow', () => {
    it('deve calcular totais corretamente', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([
        { id: '1', type: CashFlowType.INCOME, amount: 1000, category: 'Tatuagem', description: 'Sessão', date: new Date() },
        { id: '2', type: CashFlowType.INCOME, amount: 500, category: 'Cafeteria', description: 'Café', date: new Date() },
        { id: '3', type: CashFlowType.EXPENSE, amount: 300, category: 'Aluguel', description: 'Aluguel', date: new Date() },
      ]);

      const result = await service.getCashFlow(TENANT_ID, '2025-01-01', '2025-01-31');

      expect(result.totalIncome).toBe(1500);
      expect(result.totalExpense).toBe(300);
      expect(result.balance).toBe(1200);
      expect(result.entries).toHaveLength(3);
    });

    it('deve retornar saldo zero quando sem entradas', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([]);
      const result = await service.getCashFlow(TENANT_ID, '2025-01-01', '2025-01-31');
      expect(result.balance).toBe(0);
    });
  });

  describe('createCashFlowEntry', () => {
    it('deve criar entrada de fluxo de caixa', async () => {
      const entry = { id: 'cf-1', type: CashFlowType.INCOME, amount: 500, category: 'Tatuagem', description: 'Sessão', date: new Date() };
      mockPrisma.cashFlow.create.mockResolvedValue(entry);

      const result = await service.createCashFlowEntry(TENANT_ID, {
        type: CashFlowType.INCOME,
        amount: 500,
        category: 'Tatuagem',
        description: 'Sessão completa',
      });

      expect(result).toEqual(entry);
      expect(mockPrisma.cashFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT_ID, type: CashFlowType.INCOME, amount: 500 }),
        }),
      );
    });
  });

  describe('payInvoice', () => {
    it('deve marcar invoice como pago e criar fluxo de caixa', async () => {
      const invoice = {
        id: 'inv-1',
        type: InvoiceType.RECEIVABLE,
        description: 'Sessão',
        amount: 800,
        category: 'Tatuagem',
        status: InvoiceStatus.PENDING,
        dueDate: new Date(),
      };
      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: InvoiceStatus.PAID });
      mockPrisma.cashFlow.create.mockResolvedValue({});

      const result = await service.payInvoice('inv-1', TENANT_ID, 800);

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(mockPrisma.cashFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: CashFlowType.INCOME, amount: 800 }),
        }),
      );
    });

    it('deve criar despesa ao pagar invoice do tipo PAYABLE', async () => {
      const invoice = {
        id: 'inv-2',
        type: InvoiceType.PAYABLE,
        description: 'Aluguel',
        amount: 4500,
        category: 'Aluguel',
        status: InvoiceStatus.PENDING,
      };
      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: InvoiceStatus.PAID });
      mockPrisma.cashFlow.create.mockResolvedValue({});

      await service.payInvoice('inv-2', TENANT_ID, 4500);

      expect(mockPrisma.cashFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: CashFlowType.EXPENSE }),
        }),
      );
    });
  });

  describe('getDRE', () => {
    it('deve calcular DRE corretamente', async () => {
      mockPrisma.cashFlow.findMany.mockResolvedValue([
        { type: CashFlowType.INCOME, amount: 10000, source: 'tattoo', category: 'Tatuagem' },
        { type: CashFlowType.INCOME, amount: 3000, source: 'cafe', category: 'Cafeteria' },
        { type: CashFlowType.EXPENSE, amount: 5000, source: null, category: 'Aluguel' },
      ]);

      const result = await service.getDRE(TENANT_ID, 1, 2025);

      expect(result.grossRevenue).toBe(13000);
      expect(result.totalCosts).toBe(5000);
      expect(result.netProfit).toBe(8000);
      expect(result.margin).toBeCloseTo(61.54, 1);
    });
  });
});
