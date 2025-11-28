import { AssetTypeEnum } from '@zetik/shared-entities';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';

describe('Multi-Asset Earnings Aggregation', () => {
  let cryptoConverter: CryptoConverterService;

  beforeEach(() => {
    // Mock dependencies
    const mockCurrencyRateService = {
      hasRatesForAllActiveCurrencies: jest.fn().mockResolvedValue(true),
      areRatesOlderThan: jest.fn().mockResolvedValue(false),
    };

    const mockCurrenciesService = {
      getActiveCurrencies: jest.fn(),
    };

    cryptoConverter = new CryptoConverterService(
      mockCurrencyRateService as any,
      mockCurrenciesService as any,
    );

    // Mock currency rates for testing
    jest.spyOn(cryptoConverter as any, 'getRate').mockReturnValue('100000'); // BTC default

    // Override fallback rates for consistent testing
    (cryptoConverter as any).cache = new Map([
      [AssetTypeEnum.BTC, 100000],
      [AssetTypeEnum.ETH, 3500],
      [AssetTypeEnum.USDT, 1],
      [AssetTypeEnum.USDC, 1],
      [AssetTypeEnum.DOGE, 0.25],
      [AssetTypeEnum.LTC, 250],
      [AssetTypeEnum.XRP, 0.5],
      [AssetTypeEnum.TRX, 0.1],
      [AssetTypeEnum.SOL, 100],
    ]);
  });

  describe('Multi-asset commission aggregation', () => {
    it('should correctly aggregate BTC + ETH + USDT earnings to USD cents', () => {
      // BTC: 0.001 BTC @ $100,000 = $100 = 10,000 cents
      const btcEarnings = cryptoConverter.toCents('0.001', AssetTypeEnum.BTC);
      expect(parseFloat(btcEarnings)).toBe(10000);

      // ETH: 0.1 ETH @ $3,500 = $350 = 35,000 cents
      const ethEarnings = cryptoConverter.toCents('0.1', AssetTypeEnum.ETH);
      expect(parseFloat(ethEarnings)).toBe(35000);

      // USDT: 500 USDT @ $1 = $500 = 50,000 cents
      const usdtEarnings = cryptoConverter.toCents('500', AssetTypeEnum.USDT);
      expect(parseFloat(usdtEarnings)).toBe(50000);

      // Total: 10,000 + 35,000 + 50,000 = 95,000 cents = $950
      const total = parseFloat(btcEarnings) + parseFloat(ethEarnings) + parseFloat(usdtEarnings);
      expect(total).toBe(95000);
      expect(total / 100).toBe(950); // $950
    });

    it('should handle very small crypto amounts (dust)', () => {
      // 0.00000001 BTC (1 satoshi) @ $100,000 = $0.001 = 0.1 cents
      const dustBtc = cryptoConverter.toCents('0.00000001', AssetTypeEnum.BTC);
      expect(parseFloat(dustBtc)).toBeCloseTo(0.1, 1);

      // 0.0001 ETH @ $3,500 = $0.35 = 35 cents
      const dustEth = cryptoConverter.toCents('0.0001', AssetTypeEnum.ETH);
      expect(parseFloat(dustEth)).toBeCloseTo(35, 1);

      // Aggregation should still work
      const total = parseFloat(dustBtc) + parseFloat(dustEth);
      expect(total).toBeGreaterThan(0);
      expect(Number.isFinite(total)).toBe(true);
    });

    it('should handle zero amounts gracefully', () => {
      const zeroBtc = cryptoConverter.toCents('0', AssetTypeEnum.BTC);
      const zeroEth = cryptoConverter.toCents('0', AssetTypeEnum.ETH);
      const zeroUsdt = cryptoConverter.toCents('0', AssetTypeEnum.USDT);

      expect(parseFloat(zeroBtc)).toBe(0);
      expect(parseFloat(zeroEth)).toBe(0);
      expect(parseFloat(zeroUsdt)).toBe(0);

      const total = parseFloat(zeroBtc) + parseFloat(zeroEth) + parseFloat(zeroUsdt);
      expect(total).toBe(0);
    });

    it('should maintain precision across multiple conversions', () => {
      // Simulate commission calculation for different assets
      const btcCommission = '0.00342'; // ~$342
      const ethCommission = '0.1'; // ~$350
      const usdtCommission = '342.50';

      const btcCents = parseFloat(cryptoConverter.toCents(btcCommission, AssetTypeEnum.BTC));
      const ethCents = parseFloat(cryptoConverter.toCents(ethCommission, AssetTypeEnum.ETH));
      const usdtCents = parseFloat(cryptoConverter.toCents(usdtCommission, AssetTypeEnum.USDT));

      // Total should be approximately $1,034.50 = 103,450 cents
      const total = btcCents + ethCents + usdtCents;
      expect(total).toBeGreaterThan(100000);
      expect(total).toBeLessThan(105000);

      // Check for NaN
      expect(Number.isNaN(total)).toBe(false);
      expect(Number.isFinite(total)).toBe(true);
    });

    it('should handle rounding errors correctly', () => {
      // Commission amounts that might cause rounding issues
      const amounts = [
        { asset: AssetTypeEnum.BTC, amount: '0.0001' },
        { asset: AssetTypeEnum.ETH, amount: '0.001' },
        { asset: AssetTypeEnum.USDT, amount: '0.33' },
      ];

      const cents = amounts.map((item) =>
        parseFloat(cryptoConverter.toCents(item.amount, item.asset)),
      );

      // Sum should not have rounding errors
      const total = cents.reduce((sum, c) => sum + c, 0);
      expect(Number.isNaN(total)).toBe(false);

      // Should be representable as whole number of cents
      expect(Number.isInteger(total)).toBe(true);
    });

    it('should validate commission amounts are positive', () => {
      const btcCents = parseFloat(cryptoConverter.toCents('0.001', AssetTypeEnum.BTC));
      const ethCents = parseFloat(cryptoConverter.toCents('0.05', AssetTypeEnum.ETH));
      const usdtCents = parseFloat(cryptoConverter.toCents('100', AssetTypeEnum.USDT));

      expect(btcCents).toBeGreaterThan(0);
      expect(ethCents).toBeGreaterThan(0);
      expect(usdtCents).toBeGreaterThan(0);
    });

    it('should handle invalid or malformed input gracefully', () => {
      // Empty string
      const emptyBtc = cryptoConverter.toCents('', AssetTypeEnum.BTC);
      expect(parseFloat(emptyBtc)).toBe(0);

      // Non-numeric string - should return '0'
      const invalidEth = cryptoConverter.toCents('invalid', AssetTypeEnum.ETH);
      expect(parseFloat(invalidEth)).toBe(0);

      // Very large number
      const largeBtc = cryptoConverter.toCents('1000000', AssetTypeEnum.BTC);
      expect(parseFloat(largeBtc)).toBeGreaterThan(0);
      expect(Number.isFinite(parseFloat(largeBtc))).toBe(true);
    });
  });

  describe('Edge cases for conversion rates', () => {
    it('should handle extremely small conversion rates', () => {
      // DOGE has rate $0.25 per coin
      const dogeAmount = '1000'; // 1000 DOGE = $250 = 25,000 cents
      const dogeCents = parseFloat(cryptoConverter.toCents(dogeAmount, AssetTypeEnum.DOGE));
      expect(dogeCents).toBeCloseTo(25000, 0);
    });

    it('should handle precise currency conversions across multiple assets', () => {
      const rates = [
        { asset: AssetTypeEnum.BTC, amount: '0.001', expectedDollars: 100 },
        { asset: AssetTypeEnum.ETH, amount: '0.1', expectedDollars: 350 },
        { asset: AssetTypeEnum.USDT, amount: '500', expectedDollars: 500 },
      ];

      rates.forEach(({ asset, amount, expectedDollars }) => {
        const cents = parseFloat(cryptoConverter.toCents(amount, asset));
        const dollars = cents / 100;
        expect(dollars).toBeCloseTo(expectedDollars, 0);
      });
    });
  });
});
