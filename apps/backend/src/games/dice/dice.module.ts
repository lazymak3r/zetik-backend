import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DiceBetEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  HouseEdgeEntity,
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
import { UserBetService } from '../services/user-bet.service';
import { DiceController } from './dice.controller';
import { DiceService } from './dice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiceBetEntity,
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
  controllers: [DiceController],
  providers: [
    DiceService,
    UserBetService,
    HouseEdgeService,
    GameConfigService,
    FiatPreservationService,
  ],
  exports: [DiceService],
})
export class DiceModule {}
