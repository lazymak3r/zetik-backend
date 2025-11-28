import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  CurrencyRateHistoryEntity,
  FiatRateHistoryEntity,
} from '@zetik/shared-entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BigNumber } from 'bignumber.js';
import { CurrencyConverterService } from './currency-converter.service';

describe('CurrencyConverterService', () => {
  let service: CurrencyConverterService;
  let fiatRateRepo: any;
  let cryptoRateRepo: any;

  const mockFiatRates = [
    { id: '1', currency: CurrencyEnum.USD, rate: 1 },
    { id: '2', currency: CurrencyEnum.EUR, rate: 1.1 },
    { id: '3', currency: CurrencyEnum.INR, rate: 83 },
  ];

  const mockCryptoRates = [
    { id: '1', asset: AssetTypeEnum.BTC, rate: 111576 },
    { id: '2', asset: AssetTypeEnum.ETH, rate: 3500 },
  ];

  beforeEach(async () => {
    fiatRateRepo = {
      find: jest.fn().mockResolvedValue(mockFiatRates),
    };

    cryptoRateRepo = {
      find: jest.fn().mockResolvedValue(mockCryptoRates),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyConverterService,
        {
          provide: getRepositoryToken(FiatRateHistoryEntity),
          useValue: fiatRateRepo,
        },
        {
          provide: getRepositoryToken(CurrencyRateHistoryEntity),
          useValue: cryptoRateRepo,
        },
      ],
    }).compile();

    service = module.get<CurrencyConverterService>(CurrencyConverterService);
  });

  describe('convertFiatToCrypto', () => {
    it('should convert USD to BTC correctly', async () => {
      const usdAmount = new BigNumber('1000'); // $1000
      const result = await service.convertFiatToCrypto(
        usdAmount,
        CurrencyEnum.USD,
        AssetTypeEnum.BTC,
      );

      // 1000 / 111576 ≈ 0.00896351 BTC
      expect(result.toFixed(8)).toEqual('0.00896351');
    });

    it('should convert EUR to BTC through USD', async () => {
      const eurAmount = new BigNumber('1000'); // €1000
      const result = await service.convertFiatToCrypto(
        eurAmount,
        CurrencyEnum.EUR,
        AssetTypeEnum.BTC,
      );

      // 1000 EUR * 1.1 USD/EUR / 111576 USD/BTC ≈ 0.00986186 BTC
      expect(result.toFixed(8)).toEqual('0.00986186');
    });

    it('should convert INR to BTC through USD', async () => {
      const inrAmount = new BigNumber('10000'); // ₹10000
      const result = await service.convertFiatToCrypto(
        inrAmount,
        CurrencyEnum.INR,
        AssetTypeEnum.BTC,
      );

      // 10000 INR / 83 INR/USD / 111576 USD/BTC ≈ 0.00107851 BTC
      expect(result.toFixed(8)).toEqual('0.00107851');
    });

    it('should throw error for negative amount', async () => {
      const negativeAmount = new BigNumber('-1000');
      await expect(
        service.convertFiatToCrypto(negativeAmount, CurrencyEnum.USD, AssetTypeEnum.BTC),
      ).rejects.toThrow('Invalid fiat amount: cannot be negative');
    });

    it('should throw error for zero amount', async () => {
      const zeroAmount = new BigNumber('0');
      await expect(
        service.convertFiatToCrypto(zeroAmount, CurrencyEnum.USD, AssetTypeEnum.BTC),
      ).rejects.toThrow('Invalid fiat amount: cannot be zero');
    });

    it('should throw error for NaN amount', async () => {
      const nanAmount = new BigNumber('NaN');
      await expect(
        service.convertFiatToCrypto(nanAmount, CurrencyEnum.USD, AssetTypeEnum.BTC),
      ).rejects.toThrow('Invalid fiat amount: must be a valid number');
    });

    it('should throw error for null amount', async () => {
      const invalidAmount: any = null;
      await expect(
        service.convertFiatToCrypto(invalidAmount, CurrencyEnum.USD, AssetTypeEnum.BTC),
      ).rejects.toThrow('Invalid fiat amount: must be a valid number');
    });

    it('should maintain precision with small amounts', async () => {
      const smallAmount = new BigNumber('0.01'); // $0.01
      const result = await service.convertFiatToCrypto(
        smallAmount,
        CurrencyEnum.USD,
        AssetTypeEnum.BTC,
      );

      // 0.01 / 111576 ≈ 0.00000009 BTC
      expect(result.toFixed(8)).toEqual('0.00000009');
    });

    it('should handle large amounts without precision loss', async () => {
      const largeAmount = new BigNumber('1000000'); // $1M
      const result = await service.convertFiatToCrypto(
        largeAmount,
        CurrencyEnum.USD,
        AssetTypeEnum.BTC,
      );

      // 1000000 / 111576 ≈ 8.96351 BTC
      expect(result.toFixed(8)).toEqual('8.96351351');
    });

    it('should convert to ETH correctly', async () => {
      const usdAmount = new BigNumber('3500'); // $3500
      const result = await service.convertFiatToCrypto(
        usdAmount,
        CurrencyEnum.USD,
        AssetTypeEnum.ETH,
      );

      // 3500 / 3500 = 1 ETH
      expect(result.toFixed(8)).toEqual('1.00000000');
    });
  });

  describe('getFiatRate', () => {
    it('should return 1 for USD', async () => {
      const rate = await service.getFiatRate(CurrencyEnum.USD);
      expect(rate).toEqual(1);
    });

    it('should return correct rate for EUR', async () => {
      const rate = await service.getFiatRate(CurrencyEnum.EUR);
      expect(rate).toEqual(1.1);
    });

    it('should throw error for unknown currency', async () => {
      // @ts-ignore - intentionally passing invalid currency
      await expect(service.getFiatRate('UNKNOWN')).rejects.toThrow('No rate found for currency');
    });
  });

  describe('getCryptoRate', () => {
    it('should return correct rate for BTC', async () => {
      const rate = await service.getCryptoRate(AssetTypeEnum.BTC);
      expect(rate).toEqual(111576);
    });

    it('should return correct rate for ETH', async () => {
      const rate = await service.getCryptoRate(AssetTypeEnum.ETH);
      expect(rate).toEqual(3500);
    });

    it('should throw error for unknown asset', async () => {
      // @ts-ignore - intentionally passing invalid asset
      await expect(service.getCryptoRate('UNKNOWN')).rejects.toThrow('No rate found for asset');
    });
  });

  describe('caching', () => {
    it('should cache rates and not query database twice within TTL', async () => {
      const amount = new BigNumber('1000');

      // First call - should query database
      await service.convertFiatToCrypto(amount, CurrencyEnum.USD, AssetTypeEnum.BTC);
      expect(fiatRateRepo.find).toHaveBeenCalledTimes(1);
      expect(cryptoRateRepo.find).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.convertFiatToCrypto(amount, CurrencyEnum.USD, AssetTypeEnum.BTC);
      expect(fiatRateRepo.find).toHaveBeenCalledTimes(1);
      expect(cryptoRateRepo.find).toHaveBeenCalledTimes(1);
    });
  });
});
