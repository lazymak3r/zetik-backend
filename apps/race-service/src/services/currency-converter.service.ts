import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  CurrencyRateHistoryEntity,
  FiatRateHistoryEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Repository } from 'typeorm';

interface ICurrencyRates {
  fiatRates: Record<CurrencyEnum, number>;
  cryptoRates: Record<AssetTypeEnum, number>;
  timestamp: Date;
}

@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);
  private cache: ICurrencyRates | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    @InjectRepository(FiatRateHistoryEntity)
    private readonly fiatRateRepo: Repository<FiatRateHistoryEntity>,
    @InjectRepository(CurrencyRateHistoryEntity)
    private readonly cryptoRateRepo: Repository<CurrencyRateHistoryEntity>,
  ) {}

  /**
   * Convert fiat amount to crypto asset
   * All conversions go through USD: fiat -> USD -> crypto
   *
   * @param fiatAmount Amount in fiat currency
   * @param fromCurrency Source fiat currency (e.g., EUR, INR)
   * @param toAsset Target crypto asset (e.g., BTC)
   * @returns Amount in target crypto asset
   */
  async convertFiatToCrypto(
    fiatAmount: BigNumber,
    fromCurrency: CurrencyEnum,
    toAsset: AssetTypeEnum,
  ): Promise<BigNumber> {
    // Validate input
    if (!fiatAmount || fiatAmount.isNaN()) {
      throw new Error('Invalid fiat amount: must be a valid number');
    }
    if (fiatAmount.isNegative()) {
      throw new Error('Invalid fiat amount: cannot be negative');
    }
    if (fiatAmount.isZero()) {
      throw new Error('Invalid fiat amount: cannot be zero');
    }

    await this.ensureCacheValid();

    if (!this.cache) {
      throw new Error('Failed to load exchange rates');
    }

    // Step 1: Convert fiat to USD
    const usdAmount = this.convertToUsd(fiatAmount, fromCurrency, this.cache.fiatRates);

    // Step 2: Convert USD to crypto asset
    const cryptoAmount = this.convertFromUsd(usdAmount, toAsset, this.cache.cryptoRates);

    return cryptoAmount;
  }

  /**
   * Get current exchange rate for fiat currency (how many units = 1 USD)
   */
  async getFiatRate(currency: CurrencyEnum): Promise<number> {
    await this.ensureCacheValid();

    if (!this.cache) {
      throw new Error('Failed to load exchange rates');
    }

    if (currency === CurrencyEnum.USD) {
      return 1;
    }

    const rate = this.cache.fiatRates[currency];
    if (!rate) {
      throw new Error(`No rate found for currency ${currency}`);
    }

    return rate;
  }

  /**
   * Get current exchange rate for crypto asset (USD per 1 unit)
   */
  async getCryptoRate(asset: AssetTypeEnum): Promise<number> {
    await this.ensureCacheValid();

    if (!this.cache) {
      throw new Error('Failed to load exchange rates');
    }

    const rate = this.cache.cryptoRates[asset];
    if (!rate) {
      throw new Error(`No rate found for asset ${asset}`);
    }

    return rate;
  }

  private async ensureCacheValid(): Promise<void> {
    // Cache is still valid
    if (this.cache && Date.now() - this.cache.timestamp.getTime() < this.CACHE_TTL_MS) {
      return;
    }

    // Cache expired or doesn't exist, reload
    await this.loadCacheFromDatabase();
  }

  private async loadCacheFromDatabase(): Promise<void> {
    try {
      const [fiatRates, cryptoRates] = await Promise.all([
        this.loadFiatRates(),
        this.loadCryptoRates(),
      ]);

      this.cache = {
        fiatRates,
        cryptoRates,
        timestamp: new Date(),
      };

      this.logger.log(
        `Loaded rates: ${Object.keys(fiatRates).length} fiat, ${Object.keys(cryptoRates).length} crypto`,
      );
    } catch (error) {
      this.logger.error('Failed to load rates from database:', error);
      throw error;
    }
  }

  private async loadFiatRates(): Promise<Record<CurrencyEnum, number>> {
    const query = `
      SELECT DISTINCT ON (currency) currency, rate
      FROM balance.fiat_rate_history
      ORDER BY currency, "createdAt" DESC
    `;

    const results = await this.fiatRateRepo.query(query);
    const rates: Record<string, number> = { [CurrencyEnum.USD]: 1 };

    results.forEach((row: any) => {
      rates[row.currency as CurrencyEnum] = parseFloat(row.rate);
    });

    return rates as Record<CurrencyEnum, number>;
  }

  private async loadCryptoRates(): Promise<Record<AssetTypeEnum, number>> {
    const query = `
      SELECT DISTINCT ON (asset) asset, rate
      FROM balance.currency_rate_history
      ORDER BY asset, "createdAt" DESC
    `;

    const results = await this.cryptoRateRepo.query(query);
    const rates: Record<string, number> = {};

    results.forEach((row: any) => {
      rates[row.asset as AssetTypeEnum] = parseFloat(row.rate);
    });

    return rates as Record<AssetTypeEnum, number>;
  }

  private convertToUsd(
    amount: BigNumber,
    fromCurrency: CurrencyEnum,
    fiatRates: Record<CurrencyEnum, number>,
  ): BigNumber {
    if (fromCurrency === CurrencyEnum.USD) {
      return amount;
    }

    const rate = fiatRates[fromCurrency];
    if (!rate) {
      throw new Error(`No rate found for currency ${fromCurrency}`);
    }

    // amount_usd = amount / rate
    // e.g., 100 EUR / 0.85 (EUR/USD) = 117.65 USD
    return amount.dividedBy(new BigNumber(rate));
  }

  private convertFromUsd(
    usdAmount: BigNumber,
    toAsset: AssetTypeEnum,
    cryptoRates: Record<AssetTypeEnum, number>,
  ): BigNumber {
    const rate = cryptoRates[toAsset];
    if (!rate) {
      throw new Error(`No rate found for asset ${toAsset}`);
    }

    // amount_crypto = amount_usd / rate
    // e.g., 50000 USD / 45000 (BTC/USD) = 1.111... BTC
    return usdAmount.dividedBy(new BigNumber(rate));
  }
}
