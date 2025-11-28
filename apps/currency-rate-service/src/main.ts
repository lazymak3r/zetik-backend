import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/currency-rate-service/.env'), join(process.cwd(), '.env')],
});

import { Logger, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LoggerService } from '../../backend/src/common/services/logger.service';
import { commonConfig } from '../../backend/src/config/common.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const commonConf = commonConfig();
  const logger = new Logger('CurrencyRateService');

  // Create app context for cron-only microservice (no HTTP server)
  const logLevels: LogLevel[] = commonConf.isProduction
    ? (['error', 'log'] as LogLevel[]) // Only LOG and ERROR for production
    : (['error', 'warn', 'log', 'debug', 'verbose'] as LogLevel[]); // All levels for development

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: logLevels,
  });

  // Use custom logger only for production
  if (commonConf.isProduction) {
    app.useLogger(app.get(LoggerService));
  }

  logger.log('🚀 Currency Rate Service started successfully');
  logger.log(`🌍 Environment: ${commonConf.nodeEnv}`);
  logger.log('⏰ Running scheduled currency rate update cron jobs');
  logger.log('📌 Single instance mode - no HTTP server');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    void (async () => {
      logger.log('🛑 SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    })();
  });

  process.on('SIGINT', () => {
    void (async () => {
      logger.log('🛑 SIGINT received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    })();
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start Currency Rate Service:', error);
  process.exit(1);
});
