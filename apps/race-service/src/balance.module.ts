import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BalanceHistoryEntity,
  BalanceStatisticEntity,
  BalanceWalletEntity,
  CurrencyRateHistoryEntity,
  FiatRateHistoryEntity,
} from '@zetik/shared-entities';
import { CurrencyConverterService } from './services/currency-converter.service';
import { RaceBalanceService } from './services/race-balance.service';

/**
 * Minimal BalanceModule for Race Service
 *
 * This module provides a minimal implementation of balance operations for race prize distribution.
 * It uses RaceBalanceService instead of the full BalanceService to avoid heavy dependencies.
 *
 * Key differences from main BalanceModule:
 * - RaceBalanceService replaces BalanceService (no WebSocket, no self-exclusion, no stats tracking)
 * - CurrencyConverterService for fiat-to-crypto conversion with 1-hour caching
 * - Only BONUS operations supported (race prize distribution)
 * - Uses DistributedLockService from CommonModule (global) for race condition prevention
 *
 * Dependencies:
 * - DistributedLockService: Provided by CommonModule (global)
 * - DataSource: Injected by TypeORM
 *
 * Currency Conversion:
 * - CurrencyConverterService caches fiat and crypto rates for 1 hour
 * - Conversions flow through USD: fiat -> USD -> crypto
 * - Rates loaded from FiatRateHistoryEntity and CurrencyRateHistoryEntity
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceWalletEntity,
      BalanceHistoryEntity,
      BalanceStatisticEntity,
      CurrencyRateHistoryEntity,
      FiatRateHistoryEntity,
    ]),
  ],
  providers: [RaceBalanceService, CurrencyConverterService],
  exports: [RaceBalanceService, CurrencyConverterService],
})
export class RaceServiceBalanceModule {}
