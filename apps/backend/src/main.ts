import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  // Railway/Render inject PORT env var; fall back to BACKEND_PORT for local
  const port = parseInt(
    process.env.PORT || String(configService.get<number>('BACKEND_PORT', 4000)),
    10,
  );
  const corsOrigin =
    process.env.CORS_ORIGIN ||
    process.env.BACKEND_CORS_ORIGIN ||
    configService.get<string>('app.corsOrigin', 'http://localhost:3000');

  // DEBUG: log effective CORS origin so we can see what the deployed BE
  // actually picked up from the env vars.
  Logger.log(`🔒 CORS origin(s) allowed: ${corsOrigin}`, 'Bootstrap');

  // Security — helmet PHẢI được configure TRƯỚC khi gọi enableCors,
  // nếu không các header CSP/CORP mặc định của helmet sẽ chặn
  // cross-origin requests từ FE.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim().replace(/\/$/, ''));
  app.enableCors({
    origin: (origin, callback) => {
      // Allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      Logger.warn(`CORS blocked for origin: ${origin}`, 'Bootstrap');
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // Global validation pipe (for class-validator DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filter + interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LAW AI API')
    .setDescription('REST API documentation')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  Logger.log(`🚀 Backend running on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
