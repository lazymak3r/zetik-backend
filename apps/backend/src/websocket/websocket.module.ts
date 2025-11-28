import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '@zetik/shared-entities';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { authConfig } from '../config/auth.config';
import { UsersModule } from '../users/users.module';
import { BetFeedGateway } from './gateways/bet-feed.gateway';
import { GameGateway } from './gateways/game.gateway';
import { NotificationGateway } from './gateways/notification.gateway';
import { StatsGateway } from './gateways/stats.gateway';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { WebSocketRateLimitInterceptor } from './interceptors/websocket-rate-limit.interceptor';
import { GameRoomService } from './services/game-room.service';
import { NotificationService } from './services/notification.service';
import { OnlineStatsService } from './services/online-stats.service';
import { WebSocketAuthService } from './services/websocket-auth.service';

@Module({
  imports: [
    forwardRef(() => CommonModule),
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([NotificationEntity]),
    JwtModule.register({
      secret: authConfig().secret,
      signOptions: { expiresIn: authConfig().accessExpiration },
    }),
    forwardRef(() => UsersModule),
  ],
  providers: [
    BetFeedGateway,
    GameGateway,
    NotificationGateway,
    StatsGateway,
    WebSocketAuthService,
    GameRoomService,
    NotificationService,
    OnlineStatsService,
    WebSocketAuthGuard,
    WebSocketRateLimitInterceptor,
  ],
  exports: [
    BetFeedGateway,
    GameGateway,
    NotificationGateway,
    StatsGateway,
    GameRoomService,
    NotificationService,
    OnlineStatsService,
    WebSocketAuthService,
    WebSocketAuthGuard,
    WebSocketRateLimitInterceptor,
  ],
})
export class WebSocketModule {}
