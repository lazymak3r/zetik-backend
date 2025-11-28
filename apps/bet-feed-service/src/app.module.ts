import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BonusVipTierEntity,
  DefaultAvatarEntity,
  UserAvatarEntity,
  UserBetEntity,
  UserEntity,
  UserVipStatusEntity,
} from '@zetik/shared-entities';
import { HealthController } from './health.controller';
import { BetFeedModule } from './modules/bet-feed.module';

/**
 * Bet Feed Service Module
 *
 * Minimal, independent microservice for bet feed broadcasting.
 * NO backend module imports - completely standalone.
 *
 * Key features:
 * - Single instance (no clustering)
 * - WebSocket with standalone JWT authentication
 * - Direct database access via TypeORM
 * - Inline VIP status queries (no UserVipStatusService)
 * - Focused solely on bet feed processing and broadcasting
 *
 * Dependencies:
 * - PostgreSQL for bet/user/VIP data
 * - EventEmitterModule for internal events
 * - ScheduleModule for cron jobs
 * - ConfigModule for environment variables
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/bet-feed-service/.env', 'apps/backend/.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'postgres'),
        entities: [
          UserBetEntity,
          UserEntity,
          UserAvatarEntity,
          DefaultAvatarEntity,
          UserVipStatusEntity,
          BonusVipTierEntity,
        ],
        synchronize: false, // Never auto-sync in production
        logging: configService.get('DB_LOGGING', 'false') === 'true',
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BetFeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
