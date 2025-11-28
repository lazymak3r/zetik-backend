import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { CurrenciesService } from '../../payments/services/currencies.service';
import { CryptoConverterService } from './crypto-converter.service';
import { CurrencyRateService } from './currency-rate.service';

describe('CryptoConverterService', () => {
  let service: CryptoConverterService;

  const mockCurrencyRateService = {
    getAllLatestRates: jest.fn(),
    getLatestRateForAsset: jest.fn(),
    hasRatesForAllActiveCurrencies: jest.fn(),
    areRatesOlderThan: jest.fn(),
    initializeRatesFromExternalSources: jest.fn(),
  };

  const mockCurrenciesService = {
    getActiveCurrencies: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoConverterService,
        {
          provide: CurrencyRateService,
          useValue: mockCurrencyRateService,
        },
        {
          provide: CurrenciesService,
          useValue: mockCurrenciesService,
        },
      ],
    }).compile();

    service = module.get<CryptoConverterService>(CryptoConverterService);

    // Allow cache to initialize
    await new Promise((r) => setTimeout(r, 10));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('NaN and edge case handling', () => {
    it('should handle NaN input in fromUsd', () => {
      expect(service.fromUsd(NaN, AssetTypeEnum.BTC)).toBe('0');
      expect(service.fromUsd('invalid', AssetTypeEnum.BTC)).toBe('0');
      expect(service.fromUsd('', AssetTypeEnum.BTC)).toBe('0');
      expect(service.fromUsd('0', AssetTypeEnum.BTC)).toBe('0');
      expect(service.fromUsd('-10', AssetTypeEnum.BTC)).toBe('0');
    });

    it('should handle NaN input in toUsd', () => {
      expect(service.toUsd(NaN, AssetTypeEnum.BTC)).toBe('0');
      expect(service.toUsd('invalid', AssetTypeEnum.BTC)).toBe('0');
      expect(service.toUsd('', AssetTypeEnum.BTC)).toBe('0');
      expect(service.toUsd('0', AssetTypeEnum.BTC)).toBe('0');
      expect(service.toUsd('-10', AssetTypeEnum.BTC)).toBe('0');
    });

    it('should handle null/undefined input in async methods', async () => {
      expect(await service.convertToUsd(NaN, AssetTypeEnum.BTC)).toBe(0);
      expect(await service.convertToUsd(0, AssetTypeEnum.BTC)).toBe(0);
      expect(await service.convertToUsd(-10, AssetTypeEnum.BTC)).toBe(0);
      expect(await service.convertToUsd(Infinity, AssetTypeEnum.BTC)).toBe(0);
    });

    it('should handle invalid rates from database', async () => {
      mockCurrencyRateService.getLatestRateForAsset.mockResolvedValue(null);
      const result = await service.convertToUsd(100, AssetTypeEnum.BTC);
      expect(result).toBeGreaterThan(0); // Should use fallback rate
    });

    it('should handle zero rates gracefully', async () => {
      mockCurrencyRateService.getLatestRateForAsset.mockResolvedValue(0);
      const result = await service.convertToUsd(100, AssetTypeEnum.BTC);
      expect(result).toBeGreaterThan(0); // Should use fallback rate
    });

    it('should handle negative rates gracefully', async () => {
      mockCurrencyRateService.getLatestRateForAsset.mockResolvedValue(-100);
      const result = await service.convertToUsd(100, AssetTypeEnum.BTC);
      expect(result).toBeGreaterThan(0); // Should use fallback rate
    });

    it('should handle string and number inputs in legacy methods', () => {
      expect(service.fromUsd('100000', AssetTypeEnum.BTC)).toBe('2.22222222'); // 100000 / 45000
      expect(service.fromUsd(100000, AssetTypeEnum.BTC)).toBe('2.22222222');
      expect(service.toUsd('2', AssetTypeEnum.BTC)).toBe('90000'); // 2 * 45000
      expect(service.toUsd(2, AssetTypeEnum.BTC)).toBe('90000');
    });
  });

  it('getRate returns cached rate from mock', () => {
    const rate = service.getRate(AssetTypeEnum.BTC);
    expect(rate).toBe('45000'); // cached rate from mock
  });

  it('toUsd converts using cached rates', () => {
    const usd = service.toUsd('2', AssetTypeEnum.BTC);
    expect(usd).toBe('90000'); // 2 * 45000 cached rate
  });

  it('fromUsd converts using cached rates', () => {
    const btc = service.fromUsd('100000', AssetTypeEnum.BTC);
    expect(btc).toBe('2.22222222'); // 100000 / 45000 cached rate
  });

  it('should handle convertBetweenAssets with same asset', async () => {
    const result = await service.convertBetweenAssets(100, AssetTypeEnum.BTC, AssetTypeEnum.BTC);
    expect(result).toBe(100);
  });

  it('should handle zero amount in convertBetweenAssets', async () => {
    const result = await service.convertBetweenAssets(0, AssetTypeEnum.BTC, AssetTypeEnum.ETH);
    expect(result).toBe(0);
  });

  it('should use fallback rates when cache is empty', () => {
    // Create new service with empty cache
    const service2 = new (CryptoConverterService as any)({
      getAllLatestRates: jest.fn().mockResolvedValue({}),
      getLatestRateForAsset: jest.fn().mockResolvedValue(null),
    });

    const rate = service2.getRate(AssetTypeEnum.BTC);
    expect(rate).toBe('45000'); // updated fallback rate

    const usd = service2.toUsd('2', AssetTypeEnum.BTC);
    expect(usd).toBe('90000'); // 2 * 45000 fallback rate

    const btc = service2.fromUsd('90000', AssetTypeEnum.BTC);
    expect(btc).toBe('2.00000000'); // 90000 / 45000 fallback rate
  });
});
