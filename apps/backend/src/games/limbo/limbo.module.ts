import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  HouseEdgeEntity,
  LimboGameEntity,
  UserBetEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../../balance/balance.module';
import { BonusesModule } from '../../bonus/bonuses.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairModule } from '../services/provably-fair.module';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { LimboController } from './limbo.controller';
import { LimboService } from './limbo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LimboGameEntity,
      UserBetEntity,
      HouseEdgeEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
    ]),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => UsersModule),
    ProvablyFairModule,
    forwardRef(() => CommonModule),
  ],
  controllers: [LimboController],
  providers: [
    LimboService,
    HouseEdgeService,
    ProvablyFairService,
    UserBetService,
    GameConfigService,
    FiatPreservationService,
  ],
  exports: [LimboService],
})
export class LimboModule {}
