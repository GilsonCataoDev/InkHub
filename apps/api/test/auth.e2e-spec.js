"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const bcrypt = require("bcryptjs");
describe('Auth (e2e)', () => {
    let app;
    let prisma;
    let tenantId;
    let userId;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        prisma = app.get(prisma_service_1.PrismaService);
        const plan = await prisma.plan.findFirst();
        const tenant = await prisma.tenant.create({
            data: {
                name: 'E2E Studio',
                slug: `e2e-studio-${Date.now()}`,
                planId: plan.id,
            },
        });
        tenantId = tenant.id;
        const user = await prisma.user.create({
            data: {
                tenantId,
                email: 'e2e@test.com',
                name: 'E2E User',
                passwordHash: await bcrypt.hash('e2ePassword123', 10),
                role: 'ADMIN',
            },
        });
        userId = user.id;
    });
    afterAll(async () => {
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
        await app.close();
    });
    describe('POST /auth/login', () => {
        it('deve retornar tokens com credenciais válidas', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ email: 'e2e@test.com', password: 'e2ePassword123' })
                .expect(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('refreshToken');
        });
        it('deve retornar 401 com senha incorreta', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ email: 'e2e@test.com', password: 'wrong' })
                .expect(401);
        });
        it('deve retornar 401 com e-mail não cadastrado', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ email: 'naoexiste@test.com', password: 'any123' })
                .expect(401);
        });
        it('deve retornar 400 com dados inválidos (sem e-mail)', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ password: 'any123' })
                .expect(400);
        });
    });
    describe('GET /auth/me', () => {
        let accessToken;
        beforeAll(async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ email: 'e2e@test.com', password: 'e2ePassword123' });
            accessToken = res.body.data.accessToken;
        });
        it('deve retornar dados do usuário autenticado', async () => {
            const res = await request(app.getHttpServer())
                .get('/auth/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .expect(200);
            expect(res.body.data.email).toBe('e2e@test.com');
            expect(res.body.data.role).toBe('ADMIN');
        });
        it('deve retornar 401 sem token', async () => {
            await request(app.getHttpServer())
                .get('/auth/me')
                .set('X-Tenant-ID', tenantId)
                .expect(401);
        });
    });
    describe('POST /auth/refresh', () => {
        it('deve renovar tokens com refresh token válido', async () => {
            const loginRes = await request(app.getHttpServer())
                .post('/auth/login')
                .set('X-Tenant-ID', tenantId)
                .send({ email: 'e2e@test.com', password: 'e2ePassword123' });
            const { refreshToken } = loginRes.body.data;
            const res = await request(app.getHttpServer())
                .post('/auth/refresh')
                .set('X-Tenant-ID', tenantId)
                .send({ refreshToken })
                .expect(201);
            expect(res.body.data).toHaveProperty('accessToken');
        });
        it('deve retornar 401 com refresh token inválido', async () => {
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .set('X-Tenant-ID', tenantId)
                .send({ refreshToken: 'invalid.token.here' })
                .expect(401);
        });
    });
});
//# sourceMappingURL=auth.e2e-spec.js.map