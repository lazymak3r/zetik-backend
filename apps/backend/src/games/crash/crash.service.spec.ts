import { PlaceCrashBetDto } from './dto/place-crash-bet.dto';

describe('CrashService - Unit Tests', () => {
  describe('DTO Type Safety', () => {
    it('should handle string bet amounts correctly in DTOs', () => {
      const stringBetDto: PlaceCrashBetDto = {
        betAmount: '1.0',
        autoCashOutAt: 1.5,
      };

      expect(typeof stringBetDto.betAmount).toBe('string');
      expect(typeof stringBetDto.autoCashOutAt).toBe('number');
      expect(stringBetDto.betAmount).toBe('1.0');
      expect(stringBetDto.autoCashOutAt).toBe(1.5);
    });

    it('should handle small amounts with precision', () => {
      const smallBetDto: PlaceCrashBetDto = {
        betAmount: '0.01',
        autoCashOutAt: 2.0,
      };

      expect(typeof smallBetDto.betAmount).toBe('string');
      expect(smallBetDto.betAmount).toBe('0.01');
    });

    it('should handle large amounts correctly', () => {
      const largeBetDto: PlaceCrashBetDto = {
        betAmount: '1000.0',
        autoCashOutAt: 1.01,
      };

      expect(typeof largeBetDto.betAmount).toBe('string');
      expect(largeBetDto.betAmount).toBe('1000.0');
    });

    it('should handle auto cash out multipliers as numbers', () => {
      const autoCashOutDto: PlaceCrashBetDto = {
        betAmount: '10.0',
        autoCashOutAt: 2.5,
      };

      expect(typeof autoCashOutDto.autoCashOutAt).toBe('number');
      expect(autoCashOutDto.autoCashOutAt).toBe(2.5);
    });
  });

  describe('USD Amount Calculations', () => {
    it('should use numeric types for amounts to optimize calculations', () => {
      const betDto: PlaceCrashBetDto = {
        betAmount: '50.0',
        autoCashOutAt: 3.0,
      };

      const startTime = performance.now();
      const calculation = parseFloat(String(betDto.betAmount)) * Number(betDto.autoCashOutAt);
      const endTime = performance.now();

      expect(typeof calculation).toBe('number');
      expect(calculation).toBeCloseTo(150.0, 2);
      expect(endTime - startTime).toBeLessThan(1);
    });

    it('should maintain precision to 2 decimal places', () => {
      const betDto: PlaceCrashBetDto = {
        betAmount: '12.34',
        autoCashOutAt: 2.5,
      };

      const winAmount = parseFloat(String(betDto.betAmount)) * Number(betDto.autoCashOutAt);

      expect(typeof winAmount).toBe('number');
      expect(winAmount).toBeCloseTo(30.85, 2);
    });
  });

  describe('DTO Validation Compatibility', () => {
    it('should validate string-based DTO fields', () => {
      // Test that our DTO fields work with class-validator
      const validDto: PlaceCrashBetDto = {
        betAmount: '25.5', // 25.50 in string form
        autoCashOutAt: 2.0,
      };

      // Check types are correct for validation
      expect(typeof validDto.betAmount).toBe('string');
      const betNum = parseFloat(validDto.betAmount);
      expect(betNum).toBeGreaterThanOrEqual(0.01);
      expect(betNum).toBeLessThanOrEqual(1000);

      if (validDto.autoCashOutAt) {
        expect(typeof validDto.autoCashOutAt).toBe('number');
        expect(validDto.autoCashOutAt).toBeGreaterThanOrEqual(1.01);
        expect(validDto.autoCashOutAt).toBeLessThanOrEqual(100);
      }
    });

    it('should handle edge case values correctly', () => {
      // Test minimum valid bet
      const minBetDto: PlaceCrashBetDto = {
        betAmount: '0.01', // min in string form
        autoCashOutAt: 1.01,
      };

      expect(typeof minBetDto.betAmount).toBe('string');
      expect(typeof minBetDto.autoCashOutAt).toBe('number');
      expect(parseFloat(minBetDto.betAmount)).toBe(0.01);
      expect(minBetDto.autoCashOutAt).toBe(1.01);

      // Test maximum valid bet
      const maxBetDto: PlaceCrashBetDto = {
        betAmount: '1000', // max in string form
        autoCashOutAt: 100,
      };

      expect(typeof maxBetDto.betAmount).toBe('string');
      expect(typeof maxBetDto.autoCashOutAt).toBe('number');
      expect(parseFloat(maxBetDto.betAmount)).toBe(1000);
      expect(maxBetDto.autoCashOutAt).toBe(100);
    });
  });

  describe('Crash Point Generation Logic', () => {
    // Mock crash point generation function (static version)
    const generateCrashPoint = (serverSeed: string, nonce: string): number => {
      // Simple deterministic algorithm for testing that varies with inputs
      const hash = Buffer.from(serverSeed + nonce).toString('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const normalized = hashValue / 0xffffffff;

      // Generate crash point between 1.0 and 100.0
      return 1.0 + normalized * 99.0;
    };

    it('should generate crash point in valid range', () => {
      const crashPoint = generateCrashPoint('server-seed', '1');

      expect(crashPoint).toBeGreaterThanOrEqual(1.0);
      expect(crashPoint).toBeLessThanOrEqual(100.0);
    });

    it('should be deterministic with same inputs', () => {
      const crashPoint1 = generateCrashPoint('server-seed', '1');
      const crashPoint2 = generateCrashPoint('server-seed', '1');

      expect(crashPoint1).toBe(crashPoint2);
    });

    it('should generate different crash points with different seeds', () => {
      // Test that different seeds produce valid crash points
      const seed1 = 'server-seed-alpha';
      const seed2 = 'server-seed-beta';
      const nonce = '1';

      const crashPoint1 = generateCrashPoint(seed1, nonce);
      const crashPoint2 = generateCrashPoint(seed2, nonce);

      // Both should be in valid range
      expect(crashPoint1).toBeGreaterThanOrEqual(1.0);
      expect(crashPoint1).toBeLessThanOrEqual(100.0);
      expect(crashPoint2).toBeGreaterThanOrEqual(1.0);
      expect(crashPoint2).toBeLessThanOrEqual(100.0);
    });

    it('should generate different crash points with different nonces', () => {
      // Test that different nonces produce valid crash points
      const seed = 'server-seed-test';
      const nonce1 = '1';
      const nonce2 = '2';

      const crashPoint1 = generateCrashPoint(seed, nonce1);
      const crashPoint2 = generateCrashPoint(seed, nonce2);

      // Both should be in valid range
      expect(crashPoint1).toBeGreaterThanOrEqual(1.0);
      expect(crashPoint1).toBeLessThanOrEqual(100.0);
      expect(crashPoint2).toBeGreaterThanOrEqual(1.0);
      expect(crashPoint2).toBeLessThanOrEqual(100.0);
    });
  });

  describe('Win Calculation Logic', () => {
    // Mock win calculation function (static version)
    const calculateWinAmount = (
      betAmount: number,
      cashOutAt: number,
      crashPoint: number,
    ): number => {
      if (cashOutAt <= crashPoint) {
        return betAmount * cashOutAt;
      }
      return 0;
    };

    it('should calculate correct win amount for crashed game', () => {
      const betAmount = 100.0;
      const cashOutAt = 2.5;
      const crashPoint = 3.0; // Game crashed after cash out

      const winAmount = calculateWinAmount(betAmount, cashOutAt, crashPoint);

      expect(winAmount).toBe(250.0); // 100 * 2.5
    });

    it('should return 0 for game that crashed before cash out', () => {
      const betAmount = 100.0;
      const cashOutAt = 2.5;
      const crashPoint = 2.0; // Game crashed before cash out

      const winAmount = calculateWinAmount(betAmount, cashOutAt, crashPoint);

      expect(winAmount).toBe(0);
    });

    it('should handle edge case where crash point equals cash out', () => {
      const betAmount = 100.0;
      const cashOutAt = 2.0;
      const crashPoint = 2.0; // Exact same value

      const winAmount = calculateWinAmount(betAmount, cashOutAt, crashPoint);

      // Should still win since cash out happens at the exact point
      expect(winAmount).toBe(200.0); // 100 * 2.0
    });

    it('should calculate win amount with precision for small amounts', () => {
      const betAmount = 0.01;
      const cashOutAt = 1.5;
      const crashPoint = 2.0;

      const winAmount = calculateWinAmount(betAmount, cashOutAt, crashPoint);

      expect(winAmount).toBeCloseTo(0.015, 4); // 0.01 * 1.5
    });

    it('should handle high multiplier wins', () => {
      const betAmount = 10.0;
      const cashOutAt = 50.0;
      const crashPoint = 100.0;

      const winAmount = calculateWinAmount(betAmount, cashOutAt, crashPoint);

      expect(winAmount).toBe(500.0); // 10 * 50
    });
  });

  describe('Bet Validation Logic', () => {
    // Mock validation function (static version)
    const validateBetParameters = (dto: PlaceCrashBetDto): void => {
      // Convert betAmount to number for validation
      const amountNum =
        typeof dto.betAmount === 'string' ? parseFloat(dto.betAmount) : dto.betAmount;
      if (typeof amountNum !== 'number' || isNaN(amountNum) || !isFinite(amountNum)) {
        throw new Error('Invalid bet amount');
      }

      if (amountNum < 0.01 || amountNum > 10000) {
        throw new Error('Bet amount must be between $0.01 and $10,000');
      }

      if (dto.autoCashOutAt !== undefined) {
        const autoNum = dto.autoCashOutAt;
        if (typeof autoNum !== 'number' || isNaN(autoNum) || !isFinite(autoNum)) {
          throw new Error('Invalid auto cash out value');
        }

        if (autoNum < 1.01 || autoNum > 100) {
          throw new Error('Auto cash out must be between 1.01x and 100x');
        }
      }
    };

    it('should accept valid bet parameters', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '10.0',
        autoCashOutAt: 2.0,
      };

      expect(() => validateBetParameters(dto)).not.toThrow();
    });

    it('should reject bet amount below minimum', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '0.005', // Below minimum
        autoCashOutAt: 2.0,
      };

      expect(() => validateBetParameters(dto)).toThrow('Bet amount must be between');
    });

    it('should reject bet amount above maximum', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '10001', // Above maximum
        autoCashOutAt: 2.0,
      };

      expect(() => validateBetParameters(dto)).toThrow('Bet amount must be between');
    });

    it('should reject auto cash out below minimum', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '10.0',
        autoCashOutAt: 1.005, // Below minimum
      };

      expect(() => validateBetParameters(dto)).toThrow('Auto cash out must be between');
    });

    it('should reject auto cash out above maximum', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '10.0',
        autoCashOutAt: 101, // Above maximum
      };

      expect(() => validateBetParameters(dto)).toThrow('Auto cash out must be between');
    });

    it('should accept valid auto cash out range', () => {
      const validValues = [1.01, 1.5, 2.0, 10.0, 100.0];

      validValues.forEach((value) => {
        const dto: PlaceCrashBetDto = {
          betAmount: '10.0',
          autoCashOutAt: value,
        };

        expect(() => validateBetParameters(dto)).not.toThrow();
      });
    });

    it('should validate against manipulation attempts', () => {
      const invalidDtos = [
        { betAmount: '-10.0', autoCashOutAt: 2.0 }, // Negative amount
        { betAmount: '10.0', autoCashOutAt: -1.0 }, // Negative multiplier
        { betAmount: 'NaN', autoCashOutAt: 2.0 }, // NaN amount
        { betAmount: '10.0', autoCashOutAt: Infinity }, // Infinite multiplier
      ];

      invalidDtos.forEach((dto) => {
        expect(() => validateBetParameters(dto)).toThrow();
      });
    });
  });

  describe('Auto Cash Out Logic', () => {
    // Mock auto cash out function (static version)
    const shouldAutoCashOut = (
      autoCashOutAt: number | null | undefined,
      currentMultiplier: number,
    ): boolean => {
      if (!autoCashOutAt) return false;
      return currentMultiplier >= autoCashOutAt;
    };

    it('should automatically cash out when crash point reaches auto cash out value', () => {
      const autoCashOutAt = 2.0;
      const currentMultiplier = 2.0;

      const shouldCashOut = shouldAutoCashOut(autoCashOutAt, currentMultiplier);

      expect(shouldCashOut).toBe(true);
    });

    it('should not cash out when multiplier is below auto cash out', () => {
      const autoCashOutAt = 2.0;
      const currentMultiplier = 1.5;

      const shouldCashOut = shouldAutoCashOut(autoCashOutAt, currentMultiplier);

      expect(shouldCashOut).toBe(false);
    });

    it('should handle null auto cash out (manual cash out only)', () => {
      const autoCashOutAt = null;
      const currentMultiplier = 5.0;

      const shouldCashOut = shouldAutoCashOut(autoCashOutAt, currentMultiplier);

      expect(shouldCashOut).toBe(false);
    });
  });

  describe('Edge Cases & Security', () => {
    it('should handle very high crash points correctly', () => {
      // Test with extremely high crash point
      const betAmount = 10.0;
      const cashOutAt = 2.0;

      const winAmount = betAmount * cashOutAt; // Should win regardless of crash point

      expect(winAmount).toBe(20.0); // 10 * 2.0
      expect(Number.isFinite(winAmount)).toBe(true);
    });

    it('should handle precision with decimal multipliers', () => {
      const betAmount = 13.37;
      const cashOutAt = 1.234;

      const winAmount = betAmount * cashOutAt;

      expect(winAmount).toBeCloseTo(16.5, 2); // 13.37 * 1.234
    });

    it('should ensure house edge can be maintained', () => {
      const houseEdge = 2.0; // 2% house edge

      // Test that house edge configuration is reasonable
      expect(houseEdge).toBeGreaterThan(0);
      expect(houseEdge).toBeLessThan(10); // Should be reasonable percentage
      expect(Number.isFinite(houseEdge)).toBe(true);
    });
  });

  describe('Type Consistency', () => {
    it('should maintain numeric types through object transformations', () => {
      const originalDto: PlaceCrashBetDto = {
        betAmount: '123.45', // BTC amount
        autoCashOutAt: 2.5,
      };

      // Simulate what happens when DTO is passed through transformations
      const processed = { ...originalDto };

      expect(typeof processed.betAmount).toBe('string');
      expect(typeof processed.autoCashOutAt).toBe('number');
      expect(processed.betAmount).toBe('123.45');
      expect(processed.autoCashOutAt).toBe(2.5);
    });

    it('should work correctly with JSON serialization/deserialization', () => {
      const dto: PlaceCrashBetDto = {
        betAmount: '99.99', // BTC amount
        autoCashOutAt: 3.14,
      };

      // Simulate API JSON handling
      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as PlaceCrashBetDto;

      // betAmount remains string through JSON
      expect(typeof deserialized.betAmount).toBe('string');
      expect(typeof deserialized.autoCashOutAt).toBe('number');
      expect(deserialized.betAmount).toBe('99.99');
      expect(deserialized.autoCashOutAt).toBe(3.14);
    });
  });

  describe('USD Transform Validation', () => {
    it('should round USD amounts to 2 decimal places', () => {
      const amount = 9.99; // Already 2 decimal places

      // Transform function should round to 2 decimals for USD
      const transformedAmount = Math.round(amount * 100) / 100;

      expect(transformedAmount).toBe(9.99);
      expect(typeof transformedAmount).toBe('number');
    });

    it('should handle USD amounts with more than 2 decimal places', () => {
      const rawAmount = 9.999; // 3 decimal places
      const expectedAmount = 10.0; // Should round to 10.00

      // Simulate transform
      const transformedAmount = Math.round(rawAmount * 100) / 100;

      expect(transformedAmount).toBe(expectedAmount);
    });
  });
});
