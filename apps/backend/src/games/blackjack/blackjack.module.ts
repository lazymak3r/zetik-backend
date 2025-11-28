import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BlackjackGameEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  HouseEdgeEntity,
  UserBetEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../../balance/balance.module';
import { BonusesModule } from '../../bonus/bonuses.module';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairModule } from '../services/provably-fair.module';
import { UserBetService } from '../services/user-bet.service';
import { BlackjackController } from './blackjack.controller';
import { BlackjackService } from './blackjack.service';
import { BlackjackActionService } from './services/blackjack-action.service';
import { BlackjackCardService } from './services/blackjack-card.service';
import { BlackjackGameLogicService } from './services/blackjack-game-logic.service';
import { BlackjackPayoutService } from './services/blackjack-payout.service';
import { BlackjackSideBetsService } from './services/blackjack-side-bets.service';
import { BlackjackUtilsService } from './services/blackjack-utils.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlackjackGameEntity,
      UserBetEntity,
      HouseEdgeEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
    ]),
    forwardRef(() => BalanceModule),
    ProvablyFairModule,
    forwardRef(() => BonusesModule),
  ],
  controllers: [BlackjackController],
  providers: [
    BlackjackService,
    BlackjackGameLogicService,
    BlackjackCardService,
    BlackjackPayoutService,
    BlackjackActionService,
    BlackjackSideBetsService,
    BlackjackUtilsService,
    UserBetService,
    HouseEdgeService,
    GameConfigService,
    FiatPreservationService,
  ],
  exports: [BlackjackService],
})
export class BlackjackModule {}
