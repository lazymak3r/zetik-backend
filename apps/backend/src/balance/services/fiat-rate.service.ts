import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import { FiatRateHistoryEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class FiatRateService {
  private readonly logger = new Logger(FiatRateService.name);

  // Cache for fiat rates (USD as base)
  private fiatRatesCache = new Map<string, number>();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_HOURS = process.env.EXCHANGE_RATE_RELOAD_HOURS
    ? Number(process.env.EXCHANGE_RATE_RELOAD_HOURS)
    : 12; // Cache for 12 hours

  constructor(
    @InjectRepository(FiatRateHistoryEntity)
    private readonly fiatRateHistoryRepository: Repository<FiatRateHistoryEntity>,
  ) {}

  async getFiatRates(): Promise<Record<string, number>> {
    // Check if cache is valid
    if (this.isCacheValid()) {
      const rates = Object.fromEntries(this.fiatRatesCache);
      // Always include USD as 1.0 (base currency)
      rates[CurrencyEnum.USD] = 1.0;
      return rates;
    }

    // First try to get latest rates from database
    const dbRates = await this.getLatestRatesFromDb();
    if (dbRates && Object.keys(dbRates).length > 0) {
      // Check if DB rates are fresh (less than 12 hours old)
      const latestRates = await this.fiatRateHistoryRepository.find({
        order: { createdAt: 'DESC' },
        take: 1,
      });
      const latestRate = latestRates[0];

      if (latestRate) {
        const rateAge = Date.now() - latestRate.createdAt.getTime();
        const maxAge = this.CACHE_TTL_HOURS * 60 * 60 * 1000;

        if (rateAge < maxAge) {
          // DB rates are fresh, use them
          this.updateCache(dbRates);
          // Always include USD as 1.0 (base currency)
          dbRates[CurrencyEnum.USD] = 1.0;
          return dbRates;
        }
      }
    }

    // DB rates are stale or missing, fetch from API
    const apiRates = await this.fetchFiatRatesFromApi();

    // Save fresh rates to database (USD not included as it's always 1.0)
    await this.saveRatesToDb(apiRates);

    // Update cache
    this.updateCache(apiRates);

    // Always include USD as 1.0 (base currency)
    apiRates[CurrencyEnum.USD] = 1.0;
    return apiRates;
  }

  private async getLatestRatesFromDb(): Promise<Record<string, number> | null> {
    try {
      const query = `
        SELECT DISTINCT ON (currency) currency, rate, "createdAt"
        FROM balance.fiat_rate_history
        ORDER BY currency, "createdAt" DESC
      `;

      const results = await this.fiatRateHistoryRepository.query(query);

      if (!results || results.length === 0) {
        return null;
      }

      const rates: Record<string, number> = {};
      results.forEach((row: any) => {
        rates[row.currency] = parseFloat(row.rate);
      });

      this.logger.log(`Loaded ${results.length} fiat rates from database`);
      return rates;
    } catch (error) {
      this.logger.error('Failed to load fiat rates from database:', error);
      return null;
    }
  }

  private async saveRatesToDb(rates: Record<string, number>): Promise<void> {
    try {
      const entities = Object.entries(rates).map(([currency, rate]) => ({
        currency: currency as CurrencyEnum,
        rate: rate.toFixed(8), // 8 decimal places precision
      }));

      await this.fiatRateHistoryRepository.save(entities);
      this.logger.log(`Saved ${entities.length} fiat rates to database`);
    } catch (error) {
      this.logger.error('Failed to save fiat rates to database:', error);
    }
  }

  private updateCache(rates: Record<string, number>): void {
    this.fiatRatesCache.clear();
    Object.entries(rates).forEach(([currency, rate]) => {
      this.fiatRatesCache.set(currency, rate);
    });
    this.cacheTimestamp = new Date();
  }

  private isCacheValid(): boolean {
    if (!this.cacheTimestamp || this.fiatRatesCache.size === 0) {
      return false;
    }

    const now = new Date();
    const cacheAge = now.getTime() - this.cacheTimestamp.getTime();
    const maxAge = this.CACHE_TTL_HOURS * 60 * 60 * 1000;

    return cacheAge < maxAge;
  }

  private async fetchFiatRatesFromApi(): Promise<Record<string, number>> {
    try {
      // Using exchangerate-api.com (free tier: 1500 requests/month)
      // Set default: Open API limited v4 (2 decimal points) vs Free API v6 (4 decimal points)
      const url = process.env.EXCHANGE_RATE_URL || 'https://api.exchangerate-api.com/v4/latest/USD';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();

      // v4 format: "rates": {"USD":1,...,"ZWL":26.73}; v6 format: "conversion_rates":{"USD":1,..."ZWL":26.7290}
      if (!data?.rates && !data?.conversion_rates) {
        throw new Error('Invalid API response format');
      }

      // handle both v4 and v6 formats
      const rates: Record<string, number> | undefined = data.rates ?? data.conversion_rates;

      // Return only currencies we support (excluding USD as it's our base)
      const supportedRates: Record<string, number> = {};

      // Add supported currencies (excluding USD)
      Object.values(CurrencyEnum).forEach((currency) => {
        if (currency !== CurrencyEnum.USD && rates?.[currency]) {
          supportedRates[currency] = rates?.[currency];
        }
      });

      this.logger.log(
        `Fetched fiat rates for ${Object.keys(supportedRates).length} currencies from API`,
      );
      return supportedRates;
    } catch (error) {
      this.logger.error('Failed to fetch fiat rates from API:', error);

      // Return fallback rates
      return this.getFallbackRates();
    }
  }

  private getFallbackRates(): Record<string, number> {
    this.logger.warn('Using fallback fiat rates');

    return {
      [CurrencyEnum.EUR]: 0.85,
      [CurrencyEnum.MXN]: 18.0,
      [CurrencyEnum.BRL]: 5.5,
      [CurrencyEnum.JPY]: 150.0,
      [CurrencyEnum.IDR]: 15000.0,
      [CurrencyEnum.CAD]: 1.35,
      [CurrencyEnum.CNY]: 7.2,
      [CurrencyEnum.DKK]: 6.8,
      [CurrencyEnum.KRW]: 1300.0,
      [CurrencyEnum.INR]: 83.0,
      [CurrencyEnum.PHP]: 56.0,
      [CurrencyEnum.TRY]: 32.0,
      [CurrencyEnum.NZD]: 1.6,
      [CurrencyEnum.ARS]: 800.0,
      [CurrencyEnum.RUB]: 90.0,
      [CurrencyEnum.VND]: 24000.0,
    };
  }

  // Convert amount from USD to target currency
  convertFromUsd(usdAmount: number, targetCurrency: CurrencyEnum): number {
    const rates = Object.fromEntries(this.fiatRatesCache);
    const rate = rates[targetCurrency];

    if (!rate) {
      this.logger.warn(`No rate found for ${targetCurrency}, returning USD amount`);
      return usdAmount;
    }

    return usdAmount * rate;
  }

  // Convert amount from target currency to USD
  convertToUsd(amount: number, fromCurrency: CurrencyEnum): number {
    if (fromCurrency === CurrencyEnum.USD) {
      return amount;
    }

    const rates = Object.fromEntries(this.fiatRatesCache);
    const rate = rates[fromCurrency];

    if (!rate) {
      this.logger.warn(`No rate found for ${fromCurrency}, returning original amount`);
      return amount;
    }

    return amount / rate;
  }

  // Get current exchange rate for a currency (how many units of that currency = 1 USD)
  getCurrentRate(currency: CurrencyEnum): number | null {
    if (currency === CurrencyEnum.USD) {
      return 1;
    }

    const rates = Object.fromEntries(this.fiatRatesCache);
    return rates[currency] || null;
  }

  // Check if rates need updating (for cron job)
  shouldUpdateRates(): boolean {
    return !this.isCacheValid();
  }

  // Force update rates (for startup check)
  async forceUpdateRates(): Promise<void> {
    await this.getFiatRates();
  }

  // Clean up old rates (keep last 30 days)
  async cleanupOldRates(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.fiatRateHistoryRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(
        `Cleaned up ${result.affected} old fiat rate records older than ${daysToKeep} days`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old fiat rates:', error);
    }
  }
}
