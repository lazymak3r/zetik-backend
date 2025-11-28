import { registerAs } from '@nestjs/config';

export interface CurrencyRateConfig {
  providers: string[];
  batchSize: number;
  batchDelay: number;
  retryCount: number;
}

export const currencyRateConfig = registerAs('currencyRate', (): CurrencyRateConfig => {
  // Parse with validation and bounds
  const rawBatchSize = parseInt(process.env.CURRENCY_RATE_BATCH_SIZE || '1', 10);
  const rawBatchDelay = parseInt(process.env.CURRENCY_RATE_BATCH_DELAY || '3000', 10);
  const rawRetryCount = parseInt(process.env.CURRENCY_RATE_RETRY_COUNT || '2', 10);

  // Apply bounds and validation
  const batchSize = Math.max(1, Math.min(10, isNaN(rawBatchSize) ? 1 : rawBatchSize));
  const batchDelay = Math.max(1000, Math.min(30000, isNaN(rawBatchDelay) ? 3000 : rawBatchDelay));
  const retryCount = Math.max(1, Math.min(5, isNaN(rawRetryCount) ? 2 : rawRetryCount));

  return {
    providers: process.env.CURRENCY_RATE_PROVIDERS
      ? process.env.CURRENCY_RATE_PROVIDERS.split(',').map((p) => p.trim())
      : ['CoinGecko', 'Binance', 'Coinbase', 'Kraken'],
    batchSize,
    batchDelay,
    retryCount,
  };
});
