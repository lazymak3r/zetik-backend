import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/bonus-service/.env'), join(process.cwd(), '.env')],
});

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('BonusService');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const port = process.env.BONUS_SERVICE_PORT || 4003;

  await app.listen(port);

  logger.log(`💰 Bonus Scheduler running on: http://localhost:${port}`);
  logger.log(`🏥 Health: http://localhost:${port}/health`);
  logger.log(`🎯 Triggers: http://localhost:${port}/bonus-trigger/*`);
  logger.log(`⏰ Cron: Daily 1AM | Weekly 2AM Mon | Monthly 3AM 1st | Expire 4AM`);
}

bootstrap().catch((error) => {
  console.error('Failed to start bonus service:', error);
  process.exit(1);
});
