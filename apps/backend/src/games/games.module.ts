import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BonusTransactionEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  GameResultEntity,
  GameSessionEntity,
  HouseEdgeEntity,
  SportsbookBetEntity,
  SystemSettingEntity,
  UserEntity,
  UserGameFavoritesEntity,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../balance/balance.module';
import { BonusesModule } from '../bonus/bonuses.module';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { BetsReportController } from './bets-report.controller';
import { BlackjackModule } from './blackjack/blackjack.module';
import { BetFeedController } from './controllers/bet-feed.controller';
import { CrashModule } from './crash/crash.module';
import { DiceModule } from './dice/dice.module';
import { GamesController } from './games.controller';
import { KenoModule } from './keno/keno.module';
import { LimboModule } from './limbo/limbo.module';
import { MinesModule } from './mines/mines.module';
import { PlinkoModule } from './plinko/plinko.module';
import { RouletteModule } from './roulette/roulette.module';
import { BetsReportService } from './services/bets-report.service';
import { FavoriteGamesService } from './services/favorite-games.service';
import { FiatPreservationService } from './services/fiat-preservation.service';
import { GameConfigService } from './services/game-config.service';
import { GameSessionService } from './services/game-session.service';
import { HouseEdgeService } from './services/house-edge.service';
import { ProvablyFairModule } from './services/provably-fair.module';
import { UserBetModule } from './services/user-bet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameSessionEntity,
      GameResultEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
      UserEntity,
      UserGameFavoritesEntity,
      WeeklyRacePrizeEntity,
      BonusTransactionEntity,
      HouseEdgeEntity,
      SystemSettingEntity,
      SportsbookBetEntity,
    ]),
    EventEmitterModule,
    forwardRef(() => UsersModule),
    forwardRef(() => CommonModule),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => WebSocketModule),
    BlackjackModule,
    CrashModule,
    DiceModule,
    KenoModule,
    LimboModule,
    MinesModule,
    PlinkoModule,
    RouletteModule,
    ProvablyFairModule,
    UserBetModule,
  ],
  providers: [
    GameSessionService,
    GameConfigService,
    HouseEdgeService,
    BetsReportService,
    FiatPreservationService,
    FavoriteGamesService,
  ],
  controllers: [GamesController, BetsReportController, BetFeedController],
  exports: [GameSessionService, GameConfigService, UserBetModule, HouseEdgeService],
})
export class GamesModule {}
