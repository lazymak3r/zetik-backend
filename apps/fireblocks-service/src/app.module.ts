import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommonModule } from '../../backend/src/common/common.module';
import { RequestLoggerMiddleware } from '../../backend/src/common/middleware/request-logger.middleware';
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
import { fireblocksConfig } from '../../backend/src/payments/config/fireblocks.config';
import { WebhookModule } from './modules/webhook.module';

/**
 * Fireblocks Service Application Module
 *
 * This is a single-instance microservice dedicated to processing Fireblocks webhooks.
 * It handles deposit and withdrawal transaction events from Fireblocks.
 *
 * Key Features:
 * - Single instance (no clustering) to prevent duplicate transaction processing
 * - Idempotent webhook handling with distributed locking
 * - HTTP endpoint: POST /payments/fireblocks-webhook
 *
 * Dependencies:
 * - WebhookModule: Provides FireblocksWebhookController and PaymentsService
 * - BalanceModule: Imported via WebhookModule with forwardRef
 * - AffiliateModule: Imported via WebhookModule with forwardRef
 *
 * Note: BalanceModule must not be imported directly here to avoid circular
 * dependencies with WebSocketModule. It's properly handled in WebhookModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/fireblocks-service/.env', 'apps/backend/.env', '.env'],
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
    DatabaseModule,
    CommonModule,
    WebhookModule, // Minimal module for webhook processing (includes BalanceModule via forwardRef)
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
