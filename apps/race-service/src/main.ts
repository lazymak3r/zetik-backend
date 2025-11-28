// Set timezone to UTC for consistent date handling
process.env.TZ = 'UTC';

import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [
    join(process.cwd(), 'apps/race-service/.env'),
    join(process.cwd(), 'apps/backend/.env'),
    join(process.cwd(), '.env'),
  ],
});

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('RaceService');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const port = process.env.RACE_SERVICE_PORT || 4005;
  const nodeEnv = process.env.NODE_ENV || 'development';

  await app.listen(port);

  logger.log(`🏁 Race Service is running on: http://localhost:${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`⚠️  Single instance mode (no clustering)`);
  logger.log(`📊 Distribution interval: 10 seconds`);
  logger.log(`✅ Minimal race service initialized successfully`);
}

bootstrap().catch((error) => {
  console.error('Failed to start race service:', error);
  process.exit(1);
});
