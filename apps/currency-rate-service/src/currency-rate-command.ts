import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CurrencyRateSchedulerService } from '../../backend/src/balance/services/currency-rate-scheduler.service';
import { CurrencyRateService } from '../../backend/src/balance/services/currency-rate.service';
import { FiatRateService } from '../../backend/src/balance/services/fiat-rate.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const command = process.argv[2];
  const logger = new Logger('CurrencyRateCLI');

  if (!command) {
    logger.error('No command provided. Available commands:');
    logger.error('  update        - Update all rates (crypto + fiat)');
    logger.error('  update-crypto - Update only crypto rates');
    logger.error('  update-fiat   - Update only fiat rates');
    logger.error('  status        - Show current rates status');
    logger.error('  cleanup       - Cleanup old rate records');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const currencyRateService = app.get(CurrencyRateService);
    const schedulerService = app.get(CurrencyRateSchedulerService);
    const fiatRateService = app.get(FiatRateService);

    switch (command) {
      case 'update':
        logger.log('🔄 Starting manual currency rates update...');
        await schedulerService.manualUpdate();
        logger.log('✅ Manual currency rates update completed');
        break;

      case 'update-crypto': {
        logger.log('🔄 Starting manual crypto rates update...');
        const activeCurrencies =
          await currencyRateService['currenciesService'].getActiveCurrencies();
        await currencyRateService.initializeRatesFromExternalSources(activeCurrencies);
        logger.log('✅ Manual crypto rates update completed');
        break;
      }

      case 'update-fiat':
        logger.log('🔄 Starting manual fiat rates update...');
        await fiatRateService.forceUpdateRates();
        logger.log('✅ Manual fiat rates update completed');
        break;

      case 'status':
        await showStatus(currencyRateService, logger);
        break;

      case 'cleanup':
        logger.log('🧹 Cleaning up old rate records...');
        await currencyRateService.cleanupOldRates();
        logger.log('✅ Cleanup completed');
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Command failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

async function showStatus(currencyRateService: CurrencyRateService, logger: Logger) {
  logger.log('📊 Checking currency rates status...');

  const hasAllRates = await currencyRateService.hasRatesForAllActiveCurrencies();
  const ratesAreOld = await currencyRateService.areRatesOlderThan(1);
  const activeCurrencies = await currencyRateService['currenciesService'].getActiveCurrencies();

  logger.log(`Active currencies: ${activeCurrencies.join(', ')}`);
  logger.log(`Has all rates: ${hasAllRates}`);
  logger.log(`Rates are older than 1 hour: ${ratesAreOld}`);
  logger.log('');

  // Show latest rates with providers
  for (const asset of activeCurrencies) {
    const rateWithProvider = await currencyRateService.getLatestRateWithProvider(asset);
    if (rateWithProvider) {
      logger.log(`  ${asset}: $${rateWithProvider.rate} (from ${rateWithProvider.provider})`);
    } else {
      logger.log(`  ${asset}: ❌ No rate available`);
    }
  }
}

bootstrap().catch((error) => {
  console.error('Failed to run command:', error);
  process.exit(1);
});
