import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { commonConfig } from '../../backend/src/config/common.config';
import { databaseConfig } from '../../backend/src/config/database.config';
import { DatabaseModule } from '../../backend/src/database/database.module';
import { CurrencyRateModule } from './modules/currency-rate.module';

/**
 * Currency Rate Service Application Module
 *
 * This is a cron-only microservice that runs scheduled jobs to update currency rates.
 * It does not expose any HTTP endpoints and runs in single instance mode.
 *
 * Key Features:
 * - Runs CurrencyRateSchedulerService via minimal CurrencyRateModule
 * - No HTTP server (uses NestFactory.createApplicationContext)
 * - Single instance deployment only
 * - Graceful shutdown handling
 * - Minimal dependencies (no WebSocket, S3, Games, etc.)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/currency-rate-service/.env', 'apps/backend/.env', '.env'],
      load: [commonConfig, databaseConfig],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    // Minimal module with only currency rate services
    CurrencyRateModule,
  ],
})
export class AppModule {}
