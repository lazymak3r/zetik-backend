import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AssetStatusEnum, AssetTypeEnum } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';

interface CurrencyRow {
  symbol: string;
}

@Injectable()
export class CurrenciesService implements OnModuleInit {
  private readonly logger = new Logger(CurrenciesService.name);
  private cache: AssetTypeEnum[] = [];
  private lastUpdate = 0;
  private readonly cacheMinutes = 5; // Cache for 5 minutes

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // Validate active currencies at startup - will block if none exist
    // await this.getActiveCurrencies();
  }

  async getActiveCurrencies(): Promise<AssetTypeEnum[]> {
    const now = Date.now();
    if (now - this.lastUpdate > this.cacheMinutes * 60 * 1000) {
      await this.refreshCache();
    }
    return this.cache;
  }

  private async refreshCache(): Promise<void> {
    try {
      const currencies: CurrencyRow[] = await this.dataSource.query(
        `SELECT symbol FROM payments.assets 
         WHERE status = $1 
         ORDER BY symbol`,
        [AssetStatusEnum.ACTIVE],
      );

      const validCurrencies = currencies
        .map((row) => row.symbol)
        .filter((symbol) => Object.values(AssetTypeEnum).includes(symbol as AssetTypeEnum));

      if (validCurrencies.length === 0) {
        const errorMessage = `
🚨 CRITICAL: No active currencies found in database!

Please run seeds to populate the assets table:
npm run seed
        `;
        this.logger.error(errorMessage);
        throw new Error('No active currencies found. Please run database seeds.');
      }

      this.cache = validCurrencies as AssetTypeEnum[];
      this.lastUpdate = Date.now();
      this.logger.log(`Active currencies loaded: ${this.cache.join(', ')}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No active currencies found')) {
        throw error; // Re-throw configuration errors
      }
      this.logger.error('Failed to refresh currency cache', error);
      throw new Error(
        'Failed to load active currencies from database. Please check database connection.',
      );
    }
  }

  // Force refresh cache (useful for testing or manual refresh)
  async forceRefresh(): Promise<void> {
    this.lastUpdate = 0;
    await this.refreshCache();
  }
}
