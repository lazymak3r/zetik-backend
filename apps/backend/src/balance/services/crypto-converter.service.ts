import { Injectable, Logger } from '@nestjs/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { CurrenciesService } from '../../payments/services/currencies.service';
import { CurrencyRateService } from './currency-rate.service';

@Injectable()
export class CryptoConverterService {
  private readonly logger = new Logger(CryptoConverterService.name);
  private cache = new Map<AssetTypeEnum, number>();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_HOURS = 1; // Cache for 1 hour

  // Fallback rates for development/testing - DO NOT USE IN PRODUCTION
  private readonly fallbackRates = {
    [AssetTypeEnum.BTC]: 45000,
    [AssetTypeEnum.ETH]: 3000,
    [AssetTypeEnum.USDC]: 1.0,
    [AssetTypeEnum.USDT]: 1.0,
    [AssetTypeEnum.LTC]: 180,
    [AssetTypeEnum.DOGE]: 0.08,
    [AssetTypeEnum.TRX]: 0.1,
    [AssetTypeEnum.XRP]: 0.6,
    [AssetTypeEnum.SOL]: 100,
  };

  constructor(
    private readonly currencyRateService: CurrencyRateService,
    private readonly currenciesService: CurrenciesService,
  ) {
    // Initialize cache and check if rates need updating
    void this.initializeOnStartup();
  }

  async initializeOnStartup(): Promise<void> {
    try {
      const hasAllRates = await this.currencyRateService.hasRatesForAllActiveCurrencies();
      const ratesAreOld = await this.currencyRateService.areRatesOlderThan(24);

      if (!hasAllRates || ratesAreOld) {
        this.logger.log(
          'Missing or outdated currency rates detected, updating from external sources...',
        );

        const activeCurrencies = await this.currenciesService.getActiveCurrencies();
        await this.currencyRateService.initializeRatesFromExternalSources(activeCurrencies);

        await this.updateCacheFromDatabase();
      } else {
        this.logger.log('✅ All active currency rates are up to date, no initialization needed');
        await this.updateCacheFromDatabase();
      }
    } catch (error) {
      this.logger.error('Failed to initialize converter service on startup', error);
    }
  }

  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  private safeParseFloat(value: string | number): number {
    if (typeof value === 'number') {
      return this.isValidNumber(value) ? value : 0;
    }

    if (typeof value !== 'string' || value.trim() === '') {
      return 0;
    }

    const parsed = parseFloat(value);
    return this.isValidNumber(parsed) ? parsed : 0;
  }

  private getFallbackRate(asset: AssetTypeEnum): number {
    return this.fallbackRates[asset] || 1;
  }

  private getValidRate(asset: AssetTypeEnum): number {
    // Check if cache is expired and refresh if needed
    if (this.isCacheExpired()) {
      this.logger.log('Cache expired, refreshing rates from database...');
      void this.updateCacheFromDatabase();
    }

    const cachedRate = this.cache.get(asset);
    if (cachedRate && this.isValidNumber(cachedRate)) {
      return cachedRate;
    }

    this.logger.warn(`No valid cached rate for ${asset}, using fallback`);
    return this.getFallbackRate(asset);
  }

  convertToUsd(amount: number, fromAsset: AssetTypeEnum): number | null {
    const safeAmount = this.safeParseFloat(amount);
    if (safeAmount <= 0) {
      return 0;
    }

    const rate = this.getValidRate(fromAsset);
    const usdValue = safeAmount * rate;

    if (!this.isValidNumber(usdValue)) {
      this.logger.error(
        `Conversion resulted in invalid value: ${safeAmount} * ${rate} = ${usdValue}`,
      );
      return null;
    }

    return usdValue;
  }

  convertFromUsd(usdAmount: number, toAsset: AssetTypeEnum): number | null {
    const safeAmount = this.safeParseFloat(usdAmount);
    if (safeAmount <= 0) {
      return 0;
    }

    const rate = this.getValidRate(toAsset);
    const assetAmount = safeAmount / rate;

    if (!this.isValidNumber(assetAmount)) {
      this.logger.error(
        `Conversion resulted in invalid value: ${safeAmount} / ${rate} = ${assetAmount}`,
      );
      return null;
    }

    return assetAmount;
  }

  private isCacheExpired(): boolean {
    if (!this.cacheTimestamp) {
      return true;
    }

    const now = new Date();
    const hoursDiff = (now.getTime() - this.cacheTimestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff >= this.CACHE_TTL_HOURS;
  }

  convertBetweenAssets(
    amount: number,
    fromAsset: AssetTypeEnum,
    toAsset: AssetTypeEnum,
  ): number | null {
    const safeAmount = this.safeParseFloat(amount);
    if (safeAmount <= 0) {
      return 0;
    }

    if (fromAsset === toAsset) {
      return safeAmount;
    }

    // Convert through USD
    const usdValue = this.convertToUsd(safeAmount, fromAsset);
    if (usdValue === null || !this.isValidNumber(usdValue)) {
      return null;
    }

    return this.convertFromUsd(usdValue, toAsset);
  }

  async getAllRatesInUsd(): Promise<Record<string, number>> {
    return this.currencyRateService.getAllLatestRates();
  }

  private async updateCacheFromDatabase(): Promise<void> {
    try {
      const rates = await this.currencyRateService.getAllLatestRates();

      // Check if rates is null, undefined, or empty
      if (!rates || typeof rates !== 'object') {
        this.logger.warn('No rates returned from database, cache remains empty');
        return;
      }

      // Validate all rates before caching
      const validRates: Record<string, number> = {};
      for (const [asset, rate] of Object.entries(rates)) {
        if (this.isValidNumber(rate)) {
          validRates[asset] = rate;
        } else {
          this.logger.warn(`Invalid rate for ${asset}: ${rate}, skipping cache update`);
        }
      }

      const validRatesCount = Object.keys(validRates).length;
      if (validRatesCount > 0) {
        const cacheEntries: [AssetTypeEnum, number][] = Object.entries(validRates) as [
          AssetTypeEnum,
          number,
        ][];
        this.cache = new Map(cacheEntries);
        this.cacheTimestamp = new Date();
      } else {
        this.logger.warn('No valid rates found in database, cache remains empty');
      }
    } catch (err) {
      this.logger.error('Failed to update rates cache', err);
    }
  }

  // Legacy method for backward compatibility
  fromUsd(usdAmount: string | number, asset: AssetTypeEnum): string {
    const amount = this.safeParseFloat(usdAmount);
    if (amount <= 0) {
      return '0';
    }

    const rate = this.getValidRate(asset);
    const result = amount / rate;

    if (!this.isValidNumber(result)) {
      this.logger.error(`fromUsd calculation failed: ${amount} / ${rate} = ${result}`);
      return '0';
    }

    return result.toFixed(8);
  }

  // Convert cents to crypto amount
  fromCents(centsAmount: string | number, asset: AssetTypeEnum): string {
    const cents = this.safeParseFloat(centsAmount);
    const dollarsAmount = cents / 100;
    return this.fromUsd(dollarsAmount.toString(), asset);
  }

  // Legacy method for backward compatibility
  toUsd(amount: string | number, asset: AssetTypeEnum): string {
    const amountNum = this.safeParseFloat(amount);
    if (amountNum <= 0) {
      return '0';
    }

    const rate = this.getValidRate(asset);
    const result = amountNum * rate;

    if (!this.isValidNumber(result)) {
      this.logger.error(`toUsd calculation failed: ${amountNum} * ${rate} = ${result}`);
      return '0';
    }

    return result.toString();
  }

  // Convert crypto amount to cents
  toCents(amount: string | number, asset: AssetTypeEnum): string {
    const amountNum = this.safeParseFloat(amount);
    const rate = this.getValidRate(asset);
    const usdValue = amountNum * rate;

    if (!this.isValidNumber(usdValue)) {
      this.logger.error(`toCents calculation failed: ${amountNum} * ${rate} = ${usdValue}`);
      return '0';
    }

    // Convert to cents with precision to hundredths (2 decimal places)
    const cents = Math.round(usdValue * 10000) / 100;
    return cents.toString();
  }

  // Legacy method for backward compatibility
  getRate(asset: AssetTypeEnum): string {
    const rate = this.getValidRate(asset);
    return rate.toString();
  }

  // Utility method for manual cache refresh
  async refreshCache(): Promise<void> {
    await this.updateCacheFromDatabase();
  }
}
