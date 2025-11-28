import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [
    join(process.cwd(), 'apps/bet-feed-service/.env'),
    join(process.cwd(), 'apps/backend/.env'),
    join(process.cwd(), '.env'),
  ],
});

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Bootstrap the Bet Feed Service
 *
 * Minimal, independent microservice with no backend dependencies.
 * Uses standalone WebSocket gateway with JWT authentication.
 */
async function bootstrap() {
  const logger = new Logger('BetFeedService');

  // Determine environment and log levels
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: isProduction ? ['error', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const port = process.env.BET_FEED_SERVICE_PORT || 4004;

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Set up global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Set up global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Configure Redis adapter for WebSocket cross-process broadcasting
  const { RedisIoAdapter } = await import('./adapters/redis.adapter');
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  logger.log('✅ Redis WebSocket adapter enabled for cross-process broadcasting');

  await app.listen(port);

  logger.log(`📊 Bet Feed Service is running on: http://localhost:${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`⚠️  Single instance mode (no clustering)`);
  logger.log(`✅ Independent microservice with standalone WebSocket gateway`);
}

bootstrap().catch((error) => {
  console.error('Failed to start bet feed service:', error);
  process.exit(1);
});
