import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('Financial (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const plan = await prisma.plan.findFirst();
    const tenant = await prisma.tenant.create({
      data: { name: 'Fin E2E', slug: `fin-e2e-${Date.now()}`, planId: plan!.id },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        email: 'fin@test.com',
        name: 'Financeiro',
        passwordHash: await bcrypt.hash('fin123456', 10),
        role: 'ADMIN',
      },
    });

    // Seed de entradas no fluxo de caixa
    await prisma.cashFlow.createMany({
      data: [
        { tenantId, type: 'INCOME', amount: 1500, category: 'Tatuagem', description: 'Sessão 1', source: 'tattoo' },
        { tenantId, type: 'INCOME', amount: 80, category: 'Cafeteria', description: 'Café', source: 'cafe' },
        { tenantId, type: 'EXPENSE', amount: 200, category: 'Materiais', description: 'Tintas' },
      ],
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-ID', tenantId)
      .send({ email: 'fin@test.com', password: 'fin123456' });
    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.cashFlow.deleteMany({ where: { tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  describe('GET /financial/cash-flow', () => {
    it('deve retornar fluxo com totais corretos', async () => {
      const res = await request(app.getHttpServer())
        .get('/financial/cash-flow')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .query({ startDate: '2020-01-01', endDate: '2099-12-31' })
        .expect(200);

      expect(res.body.data.totalIncome).toBe(1580);
      expect(res.body.data.totalExpense).toBe(200);
      expect(res.body.data.balance).toBe(1380);
    });
  });

  describe('POST /financial/cash-flow', () => {
    it('deve criar nova entrada', async () => {
      const res = await request(app.getHttpServer())
        .post('/financial/cash-flow')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .send({ type: 'INCOME', amount: 300, category: 'Loja', description: 'Venda de tinta' })
        .expect(201);

      expect(res.body.data.amount).toBe('300');
      expect(res.body.data.type).toBe('INCOME');
    });
  });

  describe('POST /financial/invoices', () => {
    let invoiceId: string;

    it('deve criar conta a receber', async () => {
      const res = await request(app.getHttpServer())
        .post('/financial/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .send({
          type: 'RECEIVABLE',
          description: 'Sessão parcelada',
          amount: 800,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          category: 'Tatuagem',
        })
        .expect(201);

      expect(res.body.data.status).toBe('PENDING');
      invoiceId = res.body.data.id;
    });

    it('deve marcar invoice como pago', async () => {
      const res = await request(app.getHttpServer())
        .post(`/financial/invoices/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .send({ paidAmount: 800 })
        .expect(201);

      expect(res.body.data.status).toBe('PAID');
    });
  });

  describe('GET /financial/dre', () => {
    it('deve retornar DRE do mês atual', async () => {
      const now = new Date();
      const res = await request(app.getHttpServer())
        .get('/financial/dre')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .query({ month: now.getMonth() + 1, year: now.getFullYear() })
        .expect(200);

      expect(res.body.data).toHaveProperty('grossRevenue');
      expect(res.body.data).toHaveProperty('netProfit');
      expect(res.body.data).toHaveProperty('margin');
    });
  });

  describe('GET /financial/export/csv', () => {
    it('deve retornar arquivo CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/financial/export/csv')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Tenant-ID', tenantId)
        .query({ startDate: '2020-01-01', endDate: '2099-12-31' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Data,Tipo,Categoria');
    });
  });
});
