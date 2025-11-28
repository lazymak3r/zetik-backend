import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyRateHistoryEntity, FiatRateHistoryEntity } from '@zetik/shared-entities';
import { CurrencyRateSchedulerService } from '../../../backend/src/balance/services/currency-rate-scheduler.service';
import { CurrencyRateService } from '../../../backend/src/balance/services/currency-rate.service';
import { FiatRateService } from '../../../backend/src/balance/services/fiat-rate.service';
import { CurrenciesService } from '../../../backend/src/payments/services/currencies.service';

/**
 * Minimal Currency Rate Module
 *
 * This module provides only the essential services needed for currency rate updates.
 * It avoids importing the full BalanceModule which has many dependencies
 * (GameConfig, BetFeed, S3, WebSocket, etc.) that are not needed for rate updates.
 *
 * Dependencies:
 * - CurrenciesService: Fetches active currencies from database
 * - CurrencyRateService: Manages crypto rate updates
 * - FiatRateService: Manages fiat rate updates
 * - CurrencyRateSchedulerService: Cron scheduler for rate updates
 */
@Module({
  imports: [TypeOrmModule.forFeature([CurrencyRateHistoryEntity, FiatRateHistoryEntity])],
  providers: [
    CurrenciesService,
    CurrencyRateService,
    FiatRateService,
    CurrencyRateSchedulerService,
  ],
  exports: [CurrencyRateSchedulerService],
})
export class CurrencyRateModule {}
