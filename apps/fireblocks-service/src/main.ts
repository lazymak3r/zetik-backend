import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/backend/.env'), join(process.cwd(), '.env')],
});

import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Response } from 'express';
import * as swStats from 'swagger-stats';
import { GlobalExceptionFilter } from '../../backend/src/common/filters/http-exception.filter';
import { LoggerService } from '../../backend/src/common/services/logger.service';
import { commonConfig } from '../../backend/src/config/common.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const commonConf = commonConfig();
  const logger = new Logger('FireblocksService');

  // Create app with standard log levels for non-production
  const logLevels: LogLevel[] = commonConf.isProduction
    ? (['error', 'log'] as LogLevel[]) // Only LOG and ERROR for production
    : (['error', 'warn', 'log', 'debug', 'verbose'] as LogLevel[]); // All levels for development

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    rawBody: true, // Required for Fireblocks webhook signature verification
  });

  // Use custom logger only for production
  if (commonConf.isProduction) {
    app.useLogger(app.get(LoggerService));
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('FIREBLOCKS_SERVICE_PORT', 4002);
  const nodeEnv = commonConf.nodeEnv;

  // Enable CORS
  app.enableCors({
    origin: commonConf.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'fireblocks-signature'],
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('v1');

  // Set up global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Set up cookie parser
  app.use(cookieParser());

  // Set up global exception filter
  const exceptionFilter = commonConf.isProduction
    ? new GlobalExceptionFilter(app.get(LoggerService))
    : new GlobalExceptionFilter();
  app.useGlobalFilters(exceptionFilter);

  // Set up Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fireblocks Service API')
    .setDescription('Dedicated service for Fireblocks webhook handling and transaction processing')
    .setVersion('1.0')
    .addTag('fireblocks')
    .addTag('webhooks')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // Serve empty favicon to prevent 404 noise in stats
  app.use('/favicon.ico', (_, res: Response) => {
    res.status(204).end();
  });

  // Set up Swagger Stats monitoring
  app.use(
    swStats.getMiddleware({
      swaggerSpec: document,
      authentication: false,
      uriPath: '/api-stats',
    }),
  );

  await app.listen(port);

  logger.log(`🚀 Fireblocks Service is running on: http://localhost:${port}`);
  logger.log(`📖 API Documentation: http://localhost:${port}/api`);
  logger.log(`📊 API Stats: http://localhost:${port}/api-stats`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`⚠️  SINGLE INSTANCE ONLY - Critical for idempotent transaction processing`);

  if (commonConf.isProduction) {
    logger.log(`📝 Simple Format: ${configService.get('common.logging.simpleFormat')}`);
    logger.log(`🔍 Request Logging: ${configService.get('common.logging.requestLogging')}`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start Fireblocks Service:', error);
  process.exit(1);
});
