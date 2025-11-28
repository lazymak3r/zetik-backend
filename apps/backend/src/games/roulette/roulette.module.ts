import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  RouletteGame,
  UserBetEntity,
} from '@zetik/shared-entities';

import { BalanceModule } from '../../balance/balance.module';
import { BonusesModule } from '../../bonus/bonuses.module';
import { UsersModule } from '../../users/users.module';
import { GamesModule } from '../games.module';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { ProvablyFairModule } from '../services/provably-fair.module';
import { UserBetService } from '../services/user-bet.service';
import { RouletteController } from './roulette.controller';
import { RouletteService } from './roulette.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RouletteGame,
      UserBetEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
    ]),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => GamesModule),
    ProvablyFairModule,
  ],
  controllers: [RouletteController],
  providers: [RouletteService, FiatPreservationService, GameConfigService, UserBetService],
  exports: [RouletteService],
})
export class RouletteModule {}
