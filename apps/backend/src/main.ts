// Set timezone to UTC for consistent date handling
process.env.TZ = 'UTC';

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
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggerService } from './common/services/logger.service';
import { commonConfig } from './config/common.config';

async function bootstrap() {
  const commonConf = commonConfig();
  const logger = new Logger('Bootstrap');

  // Create app with standard log levels for non-production
  const logLevels: LogLevel[] = commonConf.isProduction
    ? (['error', 'log'] as LogLevel[]) // Only LOG and ERROR for production
    : (['error', 'warn', 'log', 'debug', 'verbose'] as LogLevel[]); // All levels for development

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    rawBody: true,
  });

  // Configure Redis adapter for WebSocket
  // This enables cross-process WebSocket broadcasting (cluster mode + microservices)
  // Always enabled to support crash service and other microservices broadcasting
  const { RedisIoAdapter } = await import('./websocket/adapters/redis.adapter');
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  logger.log('✅ Redis WebSocket adapter enabled for cross-process broadcasting');

  // Use custom logger only for production
  if (commonConf.isProduction) {
    app.useLogger(app.get(LoggerService));
  }

  const port = commonConf.port;
  const nodeEnv = commonConf.nodeEnv;

  // Enable CORS
  app.enableCors({
    origin: commonConf.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
  const config = new DocumentBuilder()
    .setTitle('Zetik Casino API')
    .setDescription('API documentation for the Zetik Casino backend')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
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

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    logger.log('SIGTERM received, closing server gracefully...');
    app
      .close()
      .then(() => {
        logger.log('Server closed');
      })
      .catch((error) => {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      });
  });

  const configService = app.get(ConfigService);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📖 API Documentation: http://localhost:${port}/api`);
  logger.log(`📊 API Stats: http://localhost:${port}/api-stats`);
  logger.log(`🌍 Environment: ${nodeEnv}`);

  if (commonConf.isProduction) {
    logger.log(`📝 Simple Format: ${configService.get('common.logging.simpleFormat')}`);
    logger.log(`🔍 Request Logging: ${configService.get('common.logging.requestLogging')}`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
