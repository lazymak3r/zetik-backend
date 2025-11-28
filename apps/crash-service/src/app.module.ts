import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../../backend/src/common/common.module';
import { affiliateConfig } from '../../backend/src/config/affiliate.config';
import { authConfig } from '../../backend/src/config/auth.config';
import { btcConfig } from '../../backend/src/config/btc.config';
import { commonConfig } from '../../backend/src/config/common.config';
import { databaseConfig } from '../../backend/src/config/database.config';
import { gamesConfig } from '../../backend/src/config/games.config';
import { intercomConfig } from '../../backend/src/config/intercom.config';
import { mailConfig } from '../../backend/src/config/mail.config';
import minioConfig from '../../backend/src/config/minio.config';
import { providerGamesConfig } from '../../backend/src/config/provider-games.config';
import { redisConfig } from '../../backend/src/config/redis.config';
import { DatabaseModule } from '../../backend/src/database/database.module';
import { CrashModule } from '../../backend/src/games/crash/crash.module';
import { fireblocksConfig } from '../../backend/src/payments/config/fireblocks.config';
import { HealthController } from './health.controller';

/**
 * Crash Service Module
 *
 * This is a standalone service dedicated to running the crash game logic.
 * It imports CrashModule from the main backend and runs in single-instance mode.
 *
 * Key features:
 * - Single instance (no clustering)
 * - WebSocket with Redis adapter for broadcasting (via CrashModule)
 * - Shares database and configuration with main backend
 * - Focused solely on crash game processing
 *
 * Note: WebSocketModule is imported via CrashModule with forwardRef to avoid
 * circular dependencies. Do not import WebSocketModule directly here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/crash-service/.env', 'apps/backend/.env', '.env'],
      load: [
        affiliateConfig,
        commonConfig,
        databaseConfig,
        authConfig,
        fireblocksConfig,
        btcConfig,
        gamesConfig,
        mailConfig,
        minioConfig,
        providerGamesConfig,
        redisConfig,
        intercomConfig,
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    CrashModule, // Import crash game module from backend (includes WebSocket)
  ],
  controllers: [HealthController],
})
export class AppModule {}
