import { RedisModule } from '@nestjs-modules/ioredis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBetEntity, UserEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import { UserPrivacySubscriberService } from '../services/user-privacy-subscriber.service';
import { BetFeedGateway } from './bet-feed.gateway';
import { BetFeedService } from './bet-feed.service';

/**
 * Bet Feed Module
 *
 * Event-driven bet feed module with Redis cache layer.
 * REST API endpoints have been moved to main backend for single API gateway.
 * This service now focuses on:
 * - Event-driven bet feed updates via @OnEvent('user-bet.created')
 * - Redis cache management for <50ms latency
 * - WebSocket delta broadcasting
 * - Fallback cron refresh every 60 seconds
 *
 * Imports:
 * - UserBetEntity, UserEntity, UserVipStatusEntity for querying bets and VIP status
 * - JwtModule for WebSocket authentication
 * - RedisModule for cache layer
 * - EventEmitterModule and ScheduleModule (imported via AppModule)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserBetEntity, UserEntity, UserVipStatusEntity]),
    JwtModule.register({}), // Empty config - will use JWT_SECRET from ConfigService
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
  ],
  controllers: [], // Controller moved to main backend (apps/backend)
  providers: [BetFeedService, BetFeedGateway, UserPrivacySubscriberService],
  exports: [BetFeedService, BetFeedGateway, UserPrivacySubscriberService],
})
export class BetFeedModule {}
