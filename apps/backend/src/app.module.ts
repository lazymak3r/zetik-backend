import { forwardRef, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { BlogModule } from './blog/blog.module';
import { BonusesModule } from './bonus/bonuses.module';
import { ChatModule } from './chat/chat.module';
import { CommonModule } from './common/common.module';
import { SelfExclusionInterceptor } from './common/interceptors/self-exclusion.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { affiliateConfig } from './config/affiliate.config';
import { authConfig } from './config/auth.config';
import { btcConfig } from './config/btc.config';
import { commonConfig } from './config/common.config';
import { currencyRateConfig } from './config/currency-rate.config';
import { databaseConfig } from './config/database.config';
import { gamesConfig } from './config/games.config';
import { intercomConfig } from './config/intercom.config';
import { mailConfig } from './config/mail.config';
import minioConfig from './config/minio.config';
import { providerGamesConfig } from './config/provider-games.config';
import { redisConfig } from './config/redis.config';
import { securityConfig } from './config/security.config';
import { sportsbookConfig } from './config/sportsbook.config';
import { DatabaseModule } from './database/database.module';
import { GamesModule } from './games/games.module';
import { NotificationsModule } from './notifications/notifications.module';
import { fireblocksConfig } from './payments/config/fireblocks.config';
import { PaymentsModule } from './payments/payments.module';
import { PromocodesModule } from './promocodes/promocodes.module';
import { ProviderGamesModule } from './provider-games/provider-games.module';
import { QueueModule } from './queue/queue.module';
import { SportsbookModule } from './sportsbook/sportsbook.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/backend/.env', '.env'],
      load: [
        affiliateConfig,
        commonConfig,
        databaseConfig,
        authConfig,
        securityConfig,
        fireblocksConfig,
        btcConfig,
        gamesConfig,
        mailConfig,
        minioConfig,
        providerGamesConfig,
        redisConfig,
        intercomConfig,
        sportsbookConfig,
        currencyRateConfig,
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    forwardRef(() => CommonModule),
    AuthModule,
    UsersModule,
    PaymentsModule,
    BalanceModule,
    BlogModule,
    GamesModule,
    ProviderGamesModule,
    BonusesModule,
    QueueModule,
    UploadModule,
    ChatModule,
    AffiliateModule,
    NotificationsModule,
    WebSocketModule,
    SportsbookModule,
    PromocodesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SelfExclusionInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
