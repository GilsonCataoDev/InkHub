"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const bcrypt = require("bcryptjs");
describe('Appointments (e2e)', () => {
    let app;
    let prisma;
    let tenantId;
    let accessToken;
    let clientId;
    let artistId;
    let appointmentId;
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
            data: { name: 'Apts E2E', slug: `apts-e2e-${Date.now()}`, planId: plan.id },
        });
        tenantId = tenant.id;
        const adminUser = await prisma.user.create({
            data: {
                tenantId,
                email: 'admin-apts@test.com',
                name: 'Admin',
                passwordHash: await bcrypt.hash('admin123e2e', 10),
                role: 'ADMIN',
            },
        });
        const artistUser = await prisma.user.create({
            data: {
                tenantId,
                email: 'artist-apts@test.com',
                name: 'Artist',
                passwordHash: await bcrypt.hash('artist123e2e', 10),
                role: 'TATTOO_ARTIST',
            },
        });
        const artist = await prisma.tattooArtist.create({
            data: { tenantId, userId: artistUser.id, specialties: ['Blackwork'] },
        });
        artistId = artist.id;
        const client = await prisma.client.create({
            data: { tenantId, name: 'Test Client', email: 'client@test.com', phone: '11999999999' },
        });
        clientId = client.id;
        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .set('X-Tenant-ID', tenantId)
            .send({ email: 'admin-apts@test.com', password: 'admin123e2e' });
        accessToken = loginRes.body.data.accessToken;
    });
    afterAll(async () => {
        await prisma.appointment.deleteMany({ where: { tenantId } });
        await prisma.tattooArtist.deleteMany({ where: { tenantId } });
        await prisma.client.deleteMany({ where: { tenantId } });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
        await app.close();
    });
    describe('POST /appointments', () => {
        it('deve criar agendamento', async () => {
            const res = await request(app.getHttpServer())
                .post('/appointments')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({
                clientId,
                artistId,
                date: new Date(Date.now() + 86400000).toISOString(),
                durationMinutes: 90,
                estimatedValue: 500,
                deposit: 100,
                description: 'Blackwork no antebraço',
            })
                .expect(201);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.status).toBe('PENDING');
            appointmentId = res.body.data.id;
        });
        it('deve retornar 404 com clientId inválido', async () => {
            await request(app.getHttpServer())
                .post('/appointments')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({
                clientId: '00000000-0000-0000-0000-000000000000',
                artistId,
                date: new Date(Date.now() + 86400000).toISOString(),
            })
                .expect(404);
        });
    });
    describe('GET /appointments', () => {
        it('deve listar agendamentos do tenant', async () => {
            const res = await request(app.getHttpServer())
                .get('/appointments')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .expect(200);
            expect(Array.isArray(res.body.data.data)).toBe(true);
            expect(res.body.data.data.length).toBeGreaterThan(0);
        });
    });
    describe('PATCH /appointments/:id/status', () => {
        it('deve avançar status PENDING → CONFIRMED', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/appointments/${appointmentId}/status`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({ status: 'CONFIRMED' })
                .expect(200);
            expect(res.body.data.status).toBe('CONFIRMED');
        });
        it('deve avançar CONFIRMED → IN_SESSION', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/appointments/${appointmentId}/status`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({ status: 'IN_SESSION' })
                .expect(200);
            expect(res.body.data.status).toBe('IN_SESSION');
        });
        it('deve rejeitar transição inválida IN_SESSION → PENDING', async () => {
            await request(app.getHttpServer())
                .patch(`/appointments/${appointmentId}/status`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({ status: 'PENDING' })
                .expect(400);
        });
        it('deve avançar IN_SESSION → COMPLETED', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/appointments/${appointmentId}/status`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Tenant-ID', tenantId)
                .send({ status: 'COMPLETED' })
                .expect(200);
            expect(res.body.data.status).toBe('COMPLETED');
        });
    });
});
//# sourceMappingURL=appointments.e2e-spec.js.map