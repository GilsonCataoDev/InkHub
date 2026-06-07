import 'dotenv/config';
import {
  PrismaClient,
  AppointmentStatus,
  CashFlowType,
  CommissionType,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
  PlanType,
  StockMovementType,
  TableStatus,
  UserRole,
} from '@prisma/client';
import { faker } from '@faker-js/faker/locale/pt_BR';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ─── Plans ──────────────────────────────────────────────────────────────────
  const freePlan = await prisma.plan.upsert({
    where: { id: 'plan-free' },
    update: {},
    create: {
      id: 'plan-free',
      name: 'Free',
      type: PlanType.FREE,
      maxUsers: 3,
      maxClients: 100,
      price: 0,
      features: { dashboard: true, appointments: true, clients: 100 },
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { id: 'plan-pro' },
    update: {},
    create: {
      id: 'plan-pro',
      name: 'Pro',
      type: PlanType.PRO,
      maxUsers: 15,
      maxClients: 2000,
      price: 197,
      features: { dashboard: true, appointments: true, clients: 2000, cafe: true, store: true, crm: true },
    },
  });

  // ─── Demo Tenant ────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-studio' },
    update: {},
    create: {
      id: 'tenant-demo',
      name: 'Black Needle Studio',
      slug: 'demo-studio',
      domain: 'demo-studio.inkhub.app',
      planId: proPlan.id,
      primaryColor: '#f59e0b',
    },
  });

  console.log('✅ Tenant criado:', tenant.name);

  // ─── Users ──────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const artistHash = await bcrypt.hash('artist123', 10);
  const baristaHash = await bcrypt.hash('barista123', 10);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo-studio.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo-studio.com',
      passwordHash: adminHash,
      name: 'Admin InkHub',
      role: UserRole.ADMIN,
    },
  });

  const receptionistUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'recepcao@demo-studio.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'recepcao@demo-studio.com',
      passwordHash: await bcrypt.hash('recepcao123', 10),
      name: 'Ana Recepção',
      role: UserRole.RECEPTIONIST,
    },
  });

  const baristaUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'barista@demo-studio.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'barista@demo-studio.com',
      passwordHash: baristaHash,
      name: 'Carlos Barista',
      role: UserRole.BARISTA,
    },
  });

  // ─── Tattoo Artists ─────────────────────────────────────────────────────────
  const artistUsers = await Promise.all([
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'rafael@demo-studio.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'rafael@demo-studio.com',
        passwordHash: artistHash,
        name: 'Rafael Ink',
        role: UserRole.TATTOO_ARTIST,
      },
    }),
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'julia@demo-studio.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'julia@demo-studio.com',
        passwordHash: artistHash,
        name: 'Júlia Blackwork',
        role: UserRole.TATTOO_ARTIST,
      },
    }),
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'marcos@demo-studio.com' } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'marcos@demo-studio.com',
        passwordHash: artistHash,
        name: 'Marcos Realismo',
        role: UserRole.TATTOO_ARTIST,
      },
    }),
  ]);

  const artists = await Promise.all(
    artistUsers.map((u, i) =>
      prisma.tattooArtist.upsert({
        where: { userId: u.id },
        update: {},
        create: {
          tenantId: tenant.id,
          userId: u.id,
          bio: faker.lorem.paragraph(),
          specialties: [['Blackwork', 'Fineline'], ['Realismo', 'Colorido'], ['Geométrico', 'Dotwork']][i],
        },
      }),
    ),
  );

  // Comissões
  for (const artist of artists) {
    await prisma.commission.upsert({
      where: { id: `commission-${artist.id}` },
      update: {},
      create: {
        id: `commission-${artist.id}`,
        tenantId: tenant.id,
        artistId: artist.id,
        type: CommissionType.PERCENTAGE,
        value: 50,
        serviceType: 'DEFAULT',
      },
    });
  }

  // Schedules (Seg-Sáb, 9h–18h)
  for (const artist of artists) {
    for (let day = 1; day <= 6; day++) {
      await prisma.schedule.create({
        data: {
          tenantId: tenant.id,
          artistId: artist.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
        },
      }).catch(() => {});
    }
  }

  // Metas do mês atual
  const now = new Date();
  for (const artist of artists) {
    await prisma.goal.upsert({
      where: { artistId_month_year: { artistId: artist.id, month: now.getMonth() + 1, year: now.getFullYear() } },
      update: {},
      create: {
        tenantId: tenant.id,
        artistId: artist.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        target: faker.number.int({ min: 5000, max: 15000 }),
        achieved: faker.number.int({ min: 1000, max: 8000 }),
      },
    });
  }

  console.log('✅ Tatuadores criados');

  // ─── Clients ─────────────────────────────────────────────────────────────────
  const clientNames = ['Fernanda Costa', 'Bruno Alves', 'Carla Mendes', 'Diego Santos', 'Mariana Lima'];
  const clients = await Promise.all(
    clientNames.map((name, i) =>
      prisma.client.create({
        data: {
          tenantId: tenant.id,
          name,
          email: `${name.split(' ')[0].toLowerCase()}@email.com`,
          phone: faker.phone.number('(##) #####-####'),
          cpf: `${faker.number.int({ min: 100, max: 999 })}.${faker.number.int({ min: 100, max: 999 })}.${faker.number.int({ min: 100, max: 999 })}-${faker.number.int({ min: 10, max: 99 })}`,
          birthDate: faker.date.birthdate({ min: 18, max: 45, mode: 'age' }),
          notes: i === 0 ? 'Cliente VIP, prefere sessões de manhã' : null,
        },
      }),
    ),
  );

  // LoyaltyPoints para cada cliente
  for (const client of clients) {
    await prisma.loyaltyPoints.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        points: faker.number.int({ min: 0, max: 500 }),
      },
    });
  }

  console.log('✅ Clientes criados');

  // ─── Appointments ────────────────────────────────────────────────────────────
  const statuses = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.IN_SESSION,
  ];

  const appointments: { id: string }[] = [];
  for (let i = 0; i < clients.length; i++) {
    const apt = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId: clients[i].id,
        artistId: artists[i % artists.length].id,
        date: faker.date.between({ from: new Date(Date.now() - 30 * 86400000), to: new Date(Date.now() + 14 * 86400000) }),
        durationMinutes: faker.helpers.arrayElement([60, 90, 120, 180]),
        status: statuses[i],
        description: faker.helpers.arrayElement(['Manga japonesa', 'Floral no antebraço', 'Geométrico no peito', 'Tribal nas costas']),
        bodyPart: faker.helpers.arrayElement(['braço', 'perna', 'costas', 'peito', 'antebraço']),
        estimatedValue: faker.number.int({ min: 300, max: 2000 }),
        deposit: faker.number.int({ min: 100, max: 500 }),
      },
    });
    appointments.push(apt);

    if (apt.status === AppointmentStatus.COMPLETED) {
      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          appointmentId: apt.id,
          amount: apt.estimatedValue ?? 500,
          method: faker.helpers.arrayElement([PaymentMethod.PIX, PaymentMethod.CREDIT_CARD, PaymentMethod.CASH]),
          status: PaymentStatus.PAID,
          paidAt: apt.date,
        },
      });
    }
  }

  console.log('✅ Agendamentos criados');

  // ─── Cafe Categories & Items ─────────────────────────────────────────────────
  const cafeCats = await Promise.all(
    ['Cafés Especiais', 'Chás', 'Sucos', 'Lanches', 'Doces'].map((name) =>
      prisma.cafeCategory.create({ data: { tenantId: tenant.id, name } }),
    ),
  );

  const cafeMenuItems = [
    { name: 'Espresso', price: 8, categoryIndex: 0 },
    { name: 'Cappuccino', price: 14, categoryIndex: 0 },
    { name: 'Latte Art', price: 16, categoryIndex: 0 },
    { name: 'Cold Brew', price: 18, categoryIndex: 0 },
    { name: 'Chá Verde', price: 10, categoryIndex: 1 },
    { name: 'Chá de Camomila', price: 10, categoryIndex: 1 },
    { name: 'Suco de Laranja', price: 12, categoryIndex: 2 },
    { name: 'Suco Verde Detox', price: 16, categoryIndex: 2 },
    { name: 'Tostex', price: 18, categoryIndex: 3 },
    { name: 'Croissant', price: 14, categoryIndex: 3 },
    { name: 'Brownie', price: 12, categoryIndex: 4 },
    { name: 'Cookie', price: 10, categoryIndex: 4 },
  ];

  const cafeItems = await Promise.all(
    cafeMenuItems.map((item) =>
      prisma.cafeItem.create({
        data: {
          tenantId: tenant.id,
          name: item.name,
          price: item.price,
          categoryId: cafeCats[item.categoryIndex].id,
          available: true,
          stock: faker.number.int({ min: 10, max: 50 }),
          minStock: 5,
        },
      }),
    ),
  );

  console.log('✅ Cardápio da cafeteria criado');

  // ─── Tables ──────────────────────────────────────────────────────────────────
  for (let i = 1; i <= 8; i++) {
    await prisma.table.create({
      data: {
        tenantId: tenant.id,
        number: i,
        capacity: i <= 4 ? 2 : 4,
        status: i === 1 ? TableStatus.OCCUPIED : TableStatus.FREE,
      },
    });
  }

  console.log('✅ Mesas criadas');

  // ─── Store Categories & Products ─────────────────────────────────────────────
  const storeCats = await Promise.all(
    ['Tintas', 'Agulhas', 'Equipamentos', 'Higiene', 'Acessórios'].map((name) =>
      prisma.category.create({ data: { tenantId: tenant.id, name } }),
    ),
  );

  const supplier = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'InkSupply Brasil',
      email: 'vendas@inksupply.com.br',
      phone: '(11) 3333-4444',
      cnpj: '12.345.678/0001-90',
    },
  });

  const productData = [
    { name: 'Tinta Preta 30ml', sku: 'TIN-001', cost: 25, sale: 45, stock: 50, catIdx: 0 },
    { name: 'Tinta Vermelha 30ml', sku: 'TIN-002', cost: 28, sale: 49, stock: 30, catIdx: 0 },
    { name: 'Tinta Azul 30ml', sku: 'TIN-003', cost: 28, sale: 49, stock: 25, catIdx: 0 },
    { name: 'Tinta Verde 30ml', sku: 'TIN-004', cost: 28, sale: 49, stock: 20, catIdx: 0 },
    { name: 'Agulha RL #9', sku: 'AGU-001', cost: 8, sale: 15, stock: 200, catIdx: 1 },
    { name: 'Agulha RM #7', sku: 'AGU-002', cost: 8, sale: 15, stock: 150, catIdx: 1 },
    { name: 'Agulha RS #5', sku: 'AGU-003', cost: 8, sale: 15, stock: 100, catIdx: 1 },
    { name: 'Grip 25mm', sku: 'AGU-004', cost: 5, sale: 10, stock: 80, catIdx: 1 },
    { name: 'Máquina Rotativa Pro', sku: 'EQP-001', cost: 350, sale: 650, stock: 5, catIdx: 2 },
    { name: 'Fonte Digital 2A', sku: 'EQP-002', cost: 120, sale: 220, stock: 8, catIdx: 2 },
    { name: 'Vaselina 450g', sku: 'HIG-001', cost: 12, sale: 25, stock: 40, catIdx: 3 },
    { name: 'Filme Protetor 10m', sku: 'HIG-002', cost: 30, sale: 55, stock: 15, catIdx: 3 },
    { name: 'Luva Nitrílica P (cx)', sku: 'HIG-003', cost: 35, sale: 65, stock: 20, catIdx: 3 },
    { name: 'Lençol Descartável', sku: 'HIG-004', cost: 40, sale: 75, stock: 10, catIdx: 3 },
    { name: 'Copo Dappen 100un', sku: 'ACS-001', cost: 15, sale: 28, stock: 12, catIdx: 4 },
    { name: 'Transfer Paper A4 (50 fls)', sku: 'ACS-002', cost: 45, sale: 80, stock: 8, catIdx: 4 },
    { name: 'Sabonete Antimicrobiano', sku: 'HIG-005', cost: 18, sale: 35, stock: 3, catIdx: 3 },
    { name: 'Tinta Laranja 30ml', sku: 'TIN-005', cost: 28, sale: 49, stock: 18, catIdx: 0 },
    { name: 'Agulha Magnum #11', sku: 'AGU-005', cost: 9, sale: 17, stock: 60, catIdx: 1 },
    { name: 'Dermógrafo Descartável', sku: 'ACS-003', cost: 20, sale: 38, stock: 25, catIdx: 4 },
  ];

  const products = await Promise.all(
    productData.map((p) =>
      prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId: storeCats[p.catIdx].id,
          supplierId: supplier.id,
          sku: p.sku,
          name: p.name,
          costPrice: p.cost,
          salePrice: p.sale,
          stock: p.stock,
          minStock: p.name.includes('Sabonete') ? 5 : 3,
          unit: 'un',
        },
      }),
    ),
  );

  console.log('✅ Produtos criados');

  // ─── Financial — últimos 30 dias ─────────────────────────────────────────────
  const categories = {
    income: ['Tatuagem', 'Cafeteria', 'Loja', 'Sinal', 'Outros'],
    expense: ['Aluguel', 'Materiais', 'Salários', 'Marketing', 'Utilities'],
  };

  for (let i = 30; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const incomeCount = faker.number.int({ min: 2, max: 5 });
    const expenseCount = faker.number.int({ min: 0, max: 2 });

    for (let j = 0; j < incomeCount; j++) {
      await prisma.cashFlow.create({
        data: {
          tenantId: tenant.id,
          type: CashFlowType.INCOME,
          amount: faker.number.int({ min: 150, max: 2000 }),
          category: faker.helpers.arrayElement(categories.income),
          description: `Receita - ${faker.helpers.arrayElement(['Tatuagem completa', 'Café da tarde', 'Venda de material'])}`,
          date,
          source: faker.helpers.arrayElement(['tattoo', 'cafe', 'store']),
        },
      });
    }

    for (let j = 0; j < expenseCount; j++) {
      await prisma.cashFlow.create({
        data: {
          tenantId: tenant.id,
          type: CashFlowType.EXPENSE,
          amount: faker.number.int({ min: 50, max: 800 }),
          category: faker.helpers.arrayElement(categories.expense),
          description: `Despesa - ${faker.helpers.arrayElement(['Compra de materiais', 'Conta de luz', 'Internet'])}`,
          date,
        },
      });
    }
  }

  // Invoices
  await Promise.all([
    prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        type: InvoiceType.PAYABLE,
        status: InvoiceStatus.PENDING,
        description: 'Aluguel - Julho/2025',
        amount: 4500,
        dueDate: new Date(Date.now() + 5 * 86400000),
        category: 'Aluguel',
      },
    }),
    prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        type: InvoiceType.PAYABLE,
        status: InvoiceStatus.PENDING,
        description: 'Conta de Energia Elétrica',
        amount: 380,
        dueDate: new Date(Date.now() + 3 * 86400000),
        category: 'Utilities',
      },
    }),
    prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        type: InvoiceType.RECEIVABLE,
        status: InvoiceStatus.PENDING,
        description: 'Parcela Tatuagem - Fernanda Costa',
        amount: 800,
        dueDate: new Date(Date.now() + 10 * 86400000),
        category: 'Tatuagem',
      },
    }),
  ]);

  console.log('✅ Financeiro criado');

  // ─── Stock Movements ─────────────────────────────────────────────────────────
  for (const product of products.slice(0, 10)) {
    await prisma.stockMovement.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        type: StockMovementType.PURCHASE,
        quantity: faker.number.int({ min: 10, max: 50 }),
        reason: 'Reposição de estoque',
        unitCost: product.costPrice,
      },
    });
  }

  console.log('✅ Movimentos de estoque criados');

  console.log('\n🎉 Seed concluído com sucesso!\n');
  console.log('📋 Credenciais:');
  console.log('  Admin:      admin@demo-studio.com     / admin123');
  console.log('  Tatuador:   rafael@demo-studio.com   / artist123');
  console.log('  Barista:    barista@demo-studio.com  / barista123');
  console.log('  Recepção:   recepcao@demo-studio.com / recepcao123');
  console.log('\n🌐 URLs:');
  console.log('  Frontend:  http://localhost:3000');
  console.log('  API:       http://localhost:3001');
  console.log('  Swagger:   http://localhost:3001/api/docs');
  console.log('  Adminer:   http://localhost:8080');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
