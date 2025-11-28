import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetTypeEnum, CurrencyRateHistoryEntity, RateProviderEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CurrencyRateConfig } from '../../config/currency-rate.config';
import { CurrenciesService } from '../../payments/services/currencies.service';

interface RateProvider {
  name: RateProviderEnum;
  fetchRate(asset: AssetTypeEnum): Promise<number | null>;
}

@Injectable()
export class CurrencyRateService {
  private readonly logger = new Logger(CurrencyRateService.name);
  private rateProviders: RateProvider[] = [];

  constructor(
    @InjectRepository(CurrencyRateHistoryEntity)
    private readonly currencyRateHistoryRepository: Repository<CurrencyRateHistoryEntity>,
    private readonly currenciesService: CurrenciesService,
    private readonly configService: ConfigService,
  ) {
    this.initializeProviders();
  }

  private initializeProviders() {
    const config = this.configService.get<CurrencyRateConfig>('currencyRate');
    const defaultProviders = ['CoinGecko', 'Binance', 'Coinbase', 'Kraken'];

    // Get providers from config or use defaults
    const configuredProviders = config?.providers || defaultProviders;

    // Validate providers to catch typos
    const validProviders = Object.values(RateProviderEnum);
    const enabledProviders = configuredProviders.filter((p) => {
      const isValid = validProviders.includes(p as RateProviderEnum);
      if (!isValid) {
        this.logger.warn(`Invalid provider "${p}" in CURRENCY_RATE_PROVIDERS, skipping`);
      }
      return isValid;
    });

    // Log if any providers were filtered out
    if (enabledProviders.length < configuredProviders.length) {
      this.logger.warn(
        `Filtered out ${configuredProviders.length - enabledProviders.length} invalid providers`,
      );
    }

    // Ensure we have at least one valid provider
    if (enabledProviders.length === 0) {
      this.logger.warn('No valid providers configured, using defaults: CoinGecko, Binance');
      enabledProviders.push(RateProviderEnum.COINGECKO, RateProviderEnum.BINANCE);
    }

    this.logger.log(`🔄 Initializing currency rate providers: ${enabledProviders.join(', ')}`);

    const allProviders: Record<RateProviderEnum, RateProvider> = {
      [RateProviderEnum.COINGECKO]: {
        name: RateProviderEnum.COINGECKO,
        fetchRate: this.fetchRateFromCoinGecko.bind(this),
      },
      [RateProviderEnum.BINANCE]: {
        name: RateProviderEnum.BINANCE,
        fetchRate: this.fetchRateFromBinance.bind(this),
      },
      [RateProviderEnum.COINBASE]: {
        name: RateProviderEnum.COINBASE,
        fetchRate: this.fetchRateFromCoinbase.bind(this),
      },
      [RateProviderEnum.KRAKEN]: {
        name: RateProviderEnum.KRAKEN,
        fetchRate: this.fetchRateFromKraken.bind(this),
      },
    };

    // Only include validated providers in the order specified
    this.rateProviders = enabledProviders
      .map((providerName) => allProviders[providerName as RateProviderEnum])
      .filter(Boolean);

    this.logger.log(`✅ Configured ${this.rateProviders.length} rate providers`);
  }

  private async fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  private getCoinGeckoId(asset: AssetTypeEnum): string | null {
    const coinGeckoIdMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'bitcoin',
      [AssetTypeEnum.ETH]: 'ethereum',
      [AssetTypeEnum.USDC]: 'usd-coin',
      [AssetTypeEnum.USDT]: 'tether',
      [AssetTypeEnum.LTC]: 'litecoin',
      [AssetTypeEnum.DOGE]: 'dogecoin',
      [AssetTypeEnum.TRX]: 'tron',
      [AssetTypeEnum.XRP]: 'ripple',
      [AssetTypeEnum.SOL]: 'solana',
    };

    return coinGeckoIdMap[asset] || null;
  }

  private async fetchRateFromCoinGecko(asset: AssetTypeEnum): Promise<number | null> {
    const coinGeckoId = this.getCoinGeckoId(asset);
    if (!coinGeckoId) {
      this.logger.error(`No CoinGecko ID mapping for asset: ${asset}`);
      return null;
    }

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;
      const response = await this.fetchWithTimeout(url, 5000);

      if (!response.ok) {
        this.logger.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      const price = data[coinGeckoId]?.usd;

      if (typeof price === 'number' && price > 0) {
        return price;
      }

      this.logger.error(`Invalid price data from CoinGecko for ${asset}:`, price);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch rate from CoinGecko for ${asset}: ${errorMessage}`);
      return null;
    }
  }

  private async fetchRateFromBinance(asset: AssetTypeEnum): Promise<number | null> {
    const symbolMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'BTCUSDT',
      [AssetTypeEnum.ETH]: 'ETHUSDT',
      [AssetTypeEnum.USDC]: 'USDCUSDT',
      [AssetTypeEnum.USDT]: 'USDTUSD',
      [AssetTypeEnum.LTC]: 'LTCUSDT',
      [AssetTypeEnum.DOGE]: 'DOGEUSDT',
      [AssetTypeEnum.TRX]: 'TRXUSDT',
      [AssetTypeEnum.XRP]: 'XRPUSDT',
      [AssetTypeEnum.SOL]: 'SOLUSDT',
    };

    const symbol = symbolMap[asset];
    if (!symbol) {
      this.logger.warn(`No Binance symbol mapping for asset: ${asset}`);
      return null;
    }

    try {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const response = await this.fetchWithTimeout(url, 5000);

      if (!response.ok) {
        if (response.status === 400) {
          return await this.fetchRateFromBinanceAlternative(asset);
        }
        this.logger.warn(`Binance API error for ${asset}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const price = parseFloat(data.price);

      if (price > 0) {
        this.logger.debug(`Binance rate for ${asset}: $${price}`);
        return price;
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`Binance fetch failed for ${asset}: ${errorMessage}`);
      return null;
    }
  }

  private async fetchRateFromBinanceAlternative(asset: AssetTypeEnum): Promise<number | null> {
    const alternativeMap: Partial<Record<AssetTypeEnum, string>> = {
      [AssetTypeEnum.USDT]: 'USDCUSDT',
      [AssetTypeEnum.USDC]: 'USDTUSD',
    };

    const symbol = alternativeMap[asset];
    if (!symbol) return null;

    try {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const response = await this.fetchWithTimeout(url, 5000);

      if (!response.ok) return null;

      const data = await response.json();
      const price = parseFloat(data.price);

      return price > 0 ? price : null;
    } catch {
      return null;
    }
  }

  private async fetchRateFromCoinbase(asset: AssetTypeEnum): Promise<number | null> {
    const symbolMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'BTC-USD',
      [AssetTypeEnum.ETH]: 'ETH-USD',
      [AssetTypeEnum.USDC]: 'USDC-USD',
      [AssetTypeEnum.USDT]: 'USDT-USD',
      [AssetTypeEnum.LTC]: 'LTC-USD',
      [AssetTypeEnum.DOGE]: 'DOGE-USD',
      [AssetTypeEnum.TRX]: 'TRX-USD',
      [AssetTypeEnum.XRP]: 'XRP-USD',
      [AssetTypeEnum.SOL]: 'SOL-USD',
    };

    const symbol = symbolMap[asset];
    if (!symbol) {
      this.logger.warn(`No Coinbase symbol mapping for asset: ${asset}`);
      return null;
    }

    try {
      const url = `https://api.coinbase.com/v2/prices/${symbol}/spot`;
      const response = await this.fetchWithTimeout(url, 5000);

      if (!response.ok) {
        this.logger.warn(`Coinbase API error for ${asset}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const price = parseFloat(data.data?.amount);

      if (price > 0) {
        this.logger.debug(`Coinbase rate for ${asset}: $${price}`);
        return price;
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`Coinbase fetch failed for ${asset}: ${errorMessage}`);
      return null;
    }
  }

  private async fetchRateFromKraken(asset: AssetTypeEnum): Promise<number | null> {
    const symbolMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'XBTUSD',
      [AssetTypeEnum.ETH]: 'ETHUSD',
      [AssetTypeEnum.USDC]: 'USDCUSD',
      [AssetTypeEnum.USDT]: 'USDTUSD',
      [AssetTypeEnum.LTC]: 'LTCUSD',
      [AssetTypeEnum.DOGE]: 'XDGUSD',
      [AssetTypeEnum.TRX]: 'TRXUSD',
      [AssetTypeEnum.XRP]: 'XRPUSD',
      [AssetTypeEnum.SOL]: 'SOLUSD',
    };

    const symbol = symbolMap[asset];
    if (!symbol) {
      this.logger.warn(`No Kraken symbol mapping for asset: ${asset}`);
      return null;
    }

    try {
      const url = `https://api.kraken.com/0/public/Ticker?pair=${symbol}`;
      const response = await this.fetchWithTimeout(url, 5000);

      if (!response.ok) {
        this.logger.warn(`Kraken API error for ${asset}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const result = data.result;
      if (!result) return null;

      const firstKey = Object.keys(result)[0];
      const priceData = result[firstKey];
      const price = parseFloat(priceData?.c?.[0]);

      if (price > 0) {
        this.logger.debug(`Kraken rate for ${asset}: $${price}`);
        return price;
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.debug(`Kraken fetch failed for ${asset}: ${errorMessage}`);
      return null;
    }
  }

  private async fetchRateWithFallbacks(
    asset: AssetTypeEnum,
    retryCount?: number,
  ): Promise<{ rate: number; provider: RateProviderEnum } | null> {
    const config = this.configService.get<CurrencyRateConfig>('currencyRate');
    const maxRetries = retryCount || config?.retryCount || 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (const provider of this.rateProviders) {
        try {
          this.logger.debug(`Trying ${provider.name} for ${asset} (attempt ${attempt})`);

          const rate = await provider.fetchRate(asset);
          if (rate && rate > 0) {
            this.logger.log(
              `✅ Successfully got rate for ${asset} from ${provider.name}: $${rate}`,
            );
            return { rate, provider: provider.name };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.debug(`${provider.name} failed for ${asset}: ${errorMessage}`);
        }

        // Small delay between providers to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Exponential backoff between retry cycles
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`All providers failed for ${asset}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.logger.error(`All rate providers failed for ${asset} after ${maxRetries} attempts`);
    return null;
  }

  // Update the main fetch method to use fallbacks
  async fetchRateForAsset(
    asset: AssetTypeEnum,
  ): Promise<{ rate: number; provider: RateProviderEnum } | null> {
    return await this.fetchRateWithFallbacks(asset);
  }

  // Update the batch processing - remove duplicate check
  async initializeRatesFromExternalSources(assets: AssetTypeEnum[]): Promise<void> {
    const config = this.configService.get<CurrencyRateConfig>('currencyRate');
    const results: string[] = [];
    const failedAssets: AssetTypeEnum[] = [];

    const BATCH_SIZE = config?.batchSize || 1;
    const BATCH_DELAY = config?.batchDelay || 3000;

    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);

      for (const asset of batch) {
        this.logger.log(`🔄 Fetching rate for ${asset}...`);

        const rateResult = await this.fetchRateForAsset(asset);
        if (rateResult) {
          const { rate, provider } = rateResult;
          // FIX: Remove duplicate check to avoid race condition
          await this.saveRateHistoryWithProvider(asset, rate, provider);
          results.push(`${asset}: $${rate.toFixed(4)} from ${provider}`);
        } else {
          failedAssets.push(asset);
        }

        // Delay between assets in the same batch
        if (i + BATCH_SIZE < assets.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      }
    }

    // Summary
    if (results.length > 0) {
      this.logger.log(`✅ Successfully processed ${results.length} rates: ${results.join(', ')}`);
    }
    if (failedAssets.length > 0) {
      this.logger.error(
        `❌ Failed to update ${failedAssets.length} rates: ${failedAssets.join(', ')}`,
      );
      await this.fillMissingRatesFromDatabase(failedAssets);
    }
  }

  private async saveRateHistoryWithProvider(
    asset: AssetTypeEnum,
    rate: number,
    provider: RateProviderEnum,
  ): Promise<void> {
    try {
      // Save with 8 decimal places precision for maximum accuracy
      const preciseRate = rate.toFixed(8);

      await this.currencyRateHistoryRepository.save({
        asset,
        rate: preciseRate,
        provider,
      });

      this.logger.debug(`Saved rate for ${asset}: $${rate} from ${provider}`);
    } catch (err) {
      this.logger.error(`Failed to save rate history for ${asset}`, err);
    }
  }

  // NEW method to get rate with provider info
  async getLatestRateWithProvider(
    asset: AssetTypeEnum,
  ): Promise<{ rate: number; provider: RateProviderEnum } | null> {
    try {
      const latestRate = await this.currencyRateHistoryRepository.findOne({
        where: { asset },
        order: { createdAt: 'DESC' },
      });

      return latestRate?.rate
        ? {
            rate: parseFloat(latestRate.rate),
            provider: latestRate.provider,
          }
        : null;
    } catch (err) {
      this.logger.error(`Failed to get latest rate for ${asset}`, err);
      return null;
    }
  }

  // KEEP the original method for backward compatibility
  async getLatestRateForAsset(asset: AssetTypeEnum): Promise<number | null> {
    try {
      const latestRate = await this.currencyRateHistoryRepository.findOne({
        where: { asset },
        order: { createdAt: 'DESC' },
      });

      return latestRate?.rate ? parseFloat(latestRate.rate) : null;
    } catch (err) {
      this.logger.error(`Failed to get latest rate for ${asset}`, err);
      return null;
    }
  }

  // Update other methods that use getLatestRateForAsset
  private async fillMissingRatesFromDatabase(failedAssets: AssetTypeEnum[]): Promise<void> {
    for (const asset of failedAssets) {
      const latestRate = await this.getLatestRateForAsset(asset);
      if (latestRate) {
        this.logger.warn(`Using cached rate from database for ${asset}: $${latestRate}`);
      } else {
        this.logger.error(`No rate available for ${asset} in database or external sources`);
      }
    }
  }

  // Update getAllLatestRates to handle the new return type
  async getAllLatestRates(): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};

    const assets = Object.values(AssetTypeEnum);

    // Process all assets in parallel instead of sequentially
    const ratePromises = assets.map(async (asset) => {
      const rate = await this.getLatestRateForAsset(asset); // Use the original method
      return { asset, rate };
    });

    const results = await Promise.all(ratePromises);

    // Build the rates object
    for (const { asset, rate } of results) {
      if (rate) {
        rates[asset] = rate;
      }
    }

    return rates;
  }

  // Update updateRatesForAssets to handle the new return type
  async updateRatesForAssets(assets: AssetTypeEnum[]): Promise<void> {
    const promises = assets.map(async (asset) => {
      try {
        const rateResult = await this.fetchRateForAsset(asset);
        if (rateResult && rateResult.rate > 0) {
          await this.saveRateHistoryWithProvider(asset, rateResult.rate, rateResult.provider);
          this.logger.debug(
            `Updated rate for ${asset}: ${rateResult.rate} from ${rateResult.provider}`,
          );
        } else {
          this.logger.warn(`Failed to fetch rate for ${asset}`);
        }
      } catch (err) {
        this.logger.error(`Error updating rate for ${asset}`, err);
      }
    });

    await Promise.all(promises);
  }

  async hasRatesForAllActiveCurrencies(): Promise<boolean> {
    try {
      const activeCurrencies = await this.currenciesService.getActiveCurrencies();
      const missingCurrencies: AssetTypeEnum[] = [];

      for (const asset of activeCurrencies) {
        const rate = await this.getLatestRateForAsset(asset);
        if (!rate) {
          missingCurrencies.push(asset);
        }
      }

      if (missingCurrencies.length > 0) {
        this.logger.warn(`Missing rates for currencies: ${missingCurrencies.join(', ')}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error('Failed to check if all active currencies have rates', err);
      return false; // On error, assume some rates are missing
    }
  }

  async areRatesOlderThan(hours: number): Promise<boolean> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);

      const recentRates = await this.currencyRateHistoryRepository.find({
        order: { createdAt: 'DESC' },
        take: 1,
      });

      if (!recentRates || recentRates.length === 0) {
        return true; // No rates = need to fetch
      }

      const recentRate = recentRates[0];
      const isOld = recentRate.createdAt < cutoffDate;
      return isOld;
    } catch (err) {
      this.logger.error('Failed to check rate age', err);
      return true; // On error, assume rates are old
    }
  }

  async getRateHistoryForAsset(
    asset: AssetTypeEnum,
    limit = 24,
  ): Promise<CurrencyRateHistoryEntity[]> {
    try {
      return await this.currencyRateHistoryRepository.find({
        where: { asset },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (err) {
      this.logger.error(`Failed to get rate history for ${asset}`, err);
      return [];
    }
  }

  async cleanupOldRates(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.currencyRateHistoryRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(
        `Cleaned up ${result.affected} old rate records older than ${daysToKeep} days`,
      );
    } catch (err) {
      this.logger.error('Failed to cleanup old rates', err);
    }
  }

  // Run every 4 hours to check and update outdated rates
  @Cron('0 */4 * * *')
  async scheduledRateUpdate(): Promise<void> {
    try {
      this.logger.log('🔄 Checking if currency rates need updating...');

      const ratesAreOld = await this.areRatesOlderThan(4); // Check if older than 4 hours

      if (ratesAreOld) {
        const activeCurrencies = await this.currenciesService.getActiveCurrencies();
        this.logger.log(
          `📈 Rates are outdated, updating ${activeCurrencies.length} currencies from external sources...`,
        );

        await this.initializeRatesFromExternalSources(activeCurrencies);
      } else {
        this.logger.log('✅ Currency rates are up to date, no update needed');
      }
    } catch (error) {
      this.logger.error('❌ Failed to perform scheduled rate update', error);
    }
  }

  // Run daily at 2 AM to cleanup old records
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledCleanup(): Promise<void> {
    await this.cleanupOldRates();
  }
}
