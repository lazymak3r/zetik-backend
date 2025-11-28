import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CrashBetEntity,
  CrashGameEntity,
  CrashGameStateEntity,
  CrashSeedEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  GameSessionEntity,
  HouseEdgeEntity,
  SystemSettingEntity,
  UserBetEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../../balance/balance.module';
import { BonusesModule } from '../../bonus/bonuses.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { WebSocketModule } from '../../websocket/websocket.module';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairModule } from '../services/provably-fair.module';
import { UserBetService } from '../services/user-bet.service';
import { CrashController } from './crash.controller';
import { CrashService } from './crash.service';
import { CrashGateway } from './gateways/crash.gateway.simple';
import { PublicProvablyFairController } from './public-provably-fair.controller';
import { CrashWebSocketService } from './services/crash-websocket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrashGameEntity,
      CrashBetEntity,
      CrashSeedEntity,
      CrashGameStateEntity,
      GameSessionEntity,
      UserEntity,
      UserBetEntity,
      HouseEdgeEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
      SystemSettingEntity,
    ]),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => WebSocketModule),
    ProvablyFairModule,
    forwardRef(() => CommonModule),
  ],
  providers: [
    CrashService,
    CrashGateway,
    CrashWebSocketService,
    UserBetService,
    HouseEdgeService,
    GameConfigService,
    FiatPreservationService,
  ],
  controllers: [CrashController, PublicProvablyFairController],
  exports: [CrashService],
})
export class CrashModule {}
