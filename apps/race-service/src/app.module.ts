import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Import only specific entities from shared-entities
import {
  AssetEntity,
  BalanceHistoryEntity,
  BalanceStatisticEntity,
  BalanceWalletEntity,
  BonusVipTierEntity,
  CurrencyRateHistoryEntity,
  DefaultAvatarEntity,
  FiatRateHistoryEntity,
  MonthlyRacePrizeEntity,
  RaceEntity,
  RaceParticipantEntity,
  UserAvatarEntity,
  UserEntity,
  UserVipStatusEntity,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';

// Import CommonModule for Redis and DistributedLock services (global module)
import { CommonModule } from '../../backend/src/common/common.module';

// Import minimal BalanceModule for race-service
import { RaceServiceBalanceModule } from './balance.module';

// Import specific services from backend
import { RaceWagerTrackerService } from '../../backend/src/bonus/services/race-wager-tracker.service';

// Import race-service specific services
import { HealthController } from './health.controller';
import { RaceFinalizationService } from './race-finalization.service';
import { RaceWagerDistributionService } from './race-wager-distribution.service';

/**
 * Race Service Module
 *
 * This is a minimal, independent microservice dedicated to race operations.
 * It runs in single-instance mode to prevent redundant database calls and duplicate cron execution.
 *
 * Key features:
 * - Single instance (no clustering)
 * - Race wager distribution every 10 seconds (RaceWagerDistributionService)
 * - Race finalization cron jobs (RaceFinalizationService):
 *   - Finalize ended races (hourly)
 *   - Create weekly races (Mondays at 00:00 UTC)
 *   - Create monthly races (1st day of month at 00:00 UTC)
 *   - Activate pending races (hourly)
 *   - Flush leaderboards to database (every 5 minutes)
 * - Uses Redis for atomic operations and distributed locks
 * - Emits WebSocket events for real-time updates via EventEmitter2
 * - Minimal dependencies for faster startup and better isolation
 *
 * Architecture:
 * - Does NOT handle bet.confirmed events (handled by RaceWagerTrackerService in main backend)
 * - Handles distribution from user:wagers to race:wagers:{raceId}
 * - Handles all race-related cron jobs (moved from clustered backend)
 * - Must never run multiple instances to prevent race conditions
 * - Does NOT import WebSocketModule (only emits events via EventEmitter2)
 * - Uses stub services for BalanceService dependencies that race-service doesn't need
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/race-service/.env', 'apps/backend/.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'postgres'),
        entities: [
          RaceEntity,
          RaceParticipantEntity,
          WeeklyRacePrizeEntity,
          MonthlyRacePrizeEntity,
          BalanceWalletEntity,
          BalanceHistoryEntity,
          BalanceStatisticEntity,
          CurrencyRateHistoryEntity,
          FiatRateHistoryEntity,
          UserEntity,
          UserAvatarEntity,
          DefaultAvatarEntity,
          BonusVipTierEntity,
          UserVipStatusEntity,
          AssetEntity,
        ],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([
      RaceEntity,
      RaceParticipantEntity,
      WeeklyRacePrizeEntity,
      MonthlyRacePrizeEntity,
    ]),
    CommonModule, // Provides RedisService, DistributedLockService, UserCacheService, LoggerService
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    RaceServiceBalanceModule, // Minimal BalanceModule with stub dependencies
  ],
  controllers: [HealthController],
  providers: [RaceWagerTrackerService, RaceFinalizationService, RaceWagerDistributionService],
})
export class AppModule {}
