import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { CacheModule } from '@nestjs/cache-manager';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TattooArtistsModule } from './tattoo-artists/tattoo-artists.module';
import { CafeModule } from './cafe/cafe.module';
import { StoreModule } from './store/store.module';
import { FinancialModule } from './financial/financial.module';
import { CrmModule } from './crm/crm.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ConsentModule } from './consent/consent.module';
import { BriefingModule } from './briefing/briefing.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AutomationsModule } from './automations/automations.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.register({
      isGlobal: true,
      ttl: 30, // segundos
      max: 500,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    AppointmentsModule,
    TattooArtistsModule,
    CafeModule,
    StoreModule,
    FinancialModule,
    CrmModule,
    DashboardModule,
    TenantsModule,
    UsersModule,
    NotificationsModule,
    ConsentModule,
    BriefingModule,
    CheckoutModule,
    PortfolioModule,
    WhatsappModule,
    AutomationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
