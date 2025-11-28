import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CurrencyRateService } from './currency-rate.service';
import { FiatRateService } from './fiat-rate.service';

@Injectable()
export class CurrencyRateSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyRateSchedulerService.name);

  constructor(
    private readonly currencyRateService: CurrencyRateService,
    private readonly fiatRateService: FiatRateService,
  ) {}

  async onModuleInit() {
    // Check rates freshness on startup
    await this.checkAndUpdateRatesOnStartup();
  }

  // Run twice daily at 6 AM and 6 PM
  @Cron('0 6,18 * * *')
  async updateCurrencyRates() {
    this.logger.log('Starting scheduled currency rates update');

    try {
      // Check if fiat rates need updating
      if (this.fiatRateService.shouldUpdateRates()) {
        this.logger.log('Updating fiat rates...');
        await this.fiatRateService.forceUpdateRates();
      } else {
        this.logger.log('Fiat rates are still fresh, skipping update');
      }

      // Update crypto rates
      this.logger.log('Checking crypto rates...');
      const needsCryptoUpdate = await this.currencyRateService['areRatesOlderThan'](12);
      if (needsCryptoUpdate) {
        this.logger.log('Updating crypto rates...');
        const activeCurrencies =
          await this.currencyRateService['currenciesService'].getActiveCurrencies();
        await this.currencyRateService['initializeRatesFromExternalSources'](activeCurrencies);
      }

      this.logger.log('Currency rates update completed successfully');
    } catch (error) {
      this.logger.error('Failed to update currency rates:', error);
    }
  }

  // Run daily at 3 AM to cleanup old records
  @Cron('0 3 * * *')
  async cleanupOldRates() {
    this.logger.log('Starting cleanup of old rate records');

    try {
      // Cleanup crypto rates (via existing method)
      await this.currencyRateService.cleanupOldRates();

      // Cleanup fiat rates
      await this.fiatRateService.cleanupOldRates();

      this.logger.log('Rate cleanup completed successfully');
    } catch (error) {
      this.logger.error('Failed to cleanup old rates:', error);
    }
  }

  private async checkAndUpdateRatesOnStartup() {
    this.logger.log('Checking currency rates freshness on startup...');

    try {
      // Check if fiat rates need updating (older than 12 hours)
      if (this.fiatRateService.shouldUpdateRates()) {
        this.logger.log('Fiat rates are stale, updating...');
        await this.fiatRateService.forceUpdateRates();
      } else {
        this.logger.log('Fiat rates are fresh');
      }

      // Check crypto rates freshness (older than 12 hours)
      const needsCryptoUpdate = await this.currencyRateService['areRatesOlderThan'](12);
      if (needsCryptoUpdate) {
        this.logger.log('Crypto rates need updating...');
        const activeCurrencies =
          await this.currencyRateService['currenciesService'].getActiveCurrencies();
        await this.currencyRateService['initializeRatesFromExternalSources'](activeCurrencies);
      } else {
        this.logger.log('Crypto rates are fresh');
      }

      this.logger.log('Startup rates check completed');
    } catch (error) {
      this.logger.error('Failed to check rates on startup:', error);
    }
  }

  // Manual trigger for testing
  async manualUpdate(): Promise<void> {
    await this.updateCurrencyRates();
  }
}
