import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BalanceWalletEntity,
  CurrencyRateHistoryEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  TransactionEntity,
  UserEntity,
  WithdrawRequestEntity,
} from '@zetik/shared-entities';
import { GamesService } from '../games/games.service';
import { DashboardController } from './dashboard.controller';
import { StatisticsService } from './services/statistics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceWalletEntity,
      UserEntity,
      TransactionEntity,
      WithdrawRequestEntity,
      CurrencyRateHistoryEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [StatisticsService, GamesService],
})
export class DashboardModule {}
