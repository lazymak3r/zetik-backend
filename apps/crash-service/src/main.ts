import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/crash-service/.env'), join(process.cwd(), '.env')],
});

import { Logger, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter } from '../../backend/src/common/filters/http-exception.filter';
import { LoggerService } from '../../backend/src/common/services/logger.service';
import { commonConfig } from '../../backend/src/config/common.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const commonConf = commonConfig();
  const logger = new Logger('CrashService');

  // Create app with standard log levels for non-production
  const logLevels: LogLevel[] = commonConf.isProduction
    ? (['error', 'log'] as LogLevel[]) // Only LOG and ERROR for production
    : (['error', 'warn', 'log', 'debug', 'verbose'] as LogLevel[]); // All levels for development

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    rawBody: true,
  });

  // Configure Redis adapter for WebSocket broadcasting to main-api workers
  // This enables the crash service to broadcast to all main-api worker processes
  const { RedisIoAdapter } = await import('../../backend/src/websocket/adapters/redis.adapter');
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  logger.log('✅ Redis WebSocket adapter enabled for crash service broadcasting');

  // Use custom logger only for production
  if (commonConf.isProduction) {
    app.useLogger(app.get(LoggerService));
  }

  const port = process.env.CRASH_SERVICE_PORT || 4001;
  const nodeEnv = commonConf.nodeEnv;

  // Minimal HTTP server for health checks only
  // No CORS, no cookies, no v1 prefix - this is a worker service, not an API

  // Set up global exception filter for health endpoint errors
  const exceptionFilter = commonConf.isProduction
    ? new GlobalExceptionFilter(app.get(LoggerService))
    : new GlobalExceptionFilter();
  app.useGlobalFilters(exceptionFilter);

  await app.listen(port);

  logger.log(`🎮 Crash Service is running on: http://localhost:${port}`);
  logger.log(`🏥 Health check available at: http://localhost:${port}/health`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`⚠️  Single instance mode (no clustering) - Worker service only`);
}

bootstrap().catch((error) => {
  console.error('Failed to start crash service:', error);
  process.exit(1);
});
