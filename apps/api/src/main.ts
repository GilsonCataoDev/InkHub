import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { mkdirSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { BaileysService } from './whatsapp/baileys.service';

async function bootstrap() {
  // Garante que a pasta de uploads existe antes de qualquer coisa
  mkdirSync(join(process.cwd(), process.env['UPLOAD_DEST'] ?? 'uploads'), { recursive: true });

  const app = await NestFactory.create(AppModule);

  // VULN-011: security headers via helmet
  const isProd = process.env['NODE_ENV'] === 'production';
  // VULN-007: cookie-parser antes dos guards (JWT lê cookies)
  app.use(cookieParser());

  // VULN-006: forçar download (não execução inline) de qualquer arquivo em /uploads
  // Previne que SVG/HTML maliciosos sejam executados como página no browser
  app.use('/uploads', (_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Cache-Control', 'private, max-age=31536000');
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false, // desabilitado em dev para não quebrar Swagger UI
    crossOriginEmbedderPolicy: false, // permite servir uploads inline
    hsts: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  }));

  app.enableCors({
    origin: process.env['APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('InkHub API')
    .setDescription('ERP multi-tenant para estúdios de tatuagem')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'X-Tenant-ID')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['API_PORT'] ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📖 Swagger at http://localhost:${port}/api/docs`);

  // Reconecta sessões Baileys ativas após restart
  const baileys = app.get(BaileysService);
  await baileys.restoreExistingSessions();
}

bootstrap();
