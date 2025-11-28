import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GameTypeEnum } from '@zetik/shared-entities';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { BytesToFloatService } from '../bytes-to-float.service';
import { HouseEdgeService } from '../house-edge.service';
import { ProvablyFairService } from '../provably-fair.service';

/**
 * PROVABLY FAIR NORMALIZATION INTEGRATION TESTS
 *
 * Tests the integration of BytesToFloatService with ProvablyFairService
 * to ensure all games work correctly with the new normalization method.
 */
describe('ProvablyFairService - Normalization Integration Tests', () => {
  let provablyFairService: ProvablyFairService;

  beforeAll(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn(),
          save: jest.fn(),
          update: jest.fn(),
          query: jest.fn(),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BytesToFloatService,
        ProvablyFairService,
        {
          provide: HouseEdgeService,
          useValue: {
            getEdge: jest.fn((gameType: string) => {
              switch (gameType) {
                case 'crash':
                  return 1.0;
                case 'dice':
                  return 1.0;
                default:
                  return 2.0;
              }
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'games.defaultHouseEdge') return 2.0;
              return defaultValue;
            }),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: 'SeedPairEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'DiceBetEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'CrashBetEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'BlackjackGameEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'KenoGameEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'LimboGameEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'MinesGameEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'PlinkoGameEntityRepository',
          useValue: mockRepository,
        },
        {
          provide: 'RouletteGameRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    provablyFairService = module.get<ProvablyFairService>(ProvablyFairService);
  });

  describe('Limbo Game Integration', () => {
    it('should never crash on edge case bytes (all zeros)', () => {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const clientSeed = '0'.repeat(64);
      const nonce = '1';

      expect(() => {
        provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          1.0, // 1% house edge
        );
      }).not.toThrow();
    });

    it('should never crash on edge case bytes (all 0xFF)', () => {
      const serverSeed = 'f'.repeat(64);
      const clientSeed = 'f'.repeat(64);
      const nonce = '1';

      const outcome = provablyFairService.calculateOutcome(
        serverSeed,
        clientSeed,
        nonce,
        GameTypeEnum.LIMBO,
        1.0,
      );

      expect(isFinite(outcome.value)).toBe(true);
      expect(outcome.value).not.toBeNaN();
      expect(outcome.value).toBeGreaterThanOrEqual(1.0);
    });

    it('should produce correct multiplier distribution', () => {
      const testCases = 1000;
      const multipliers: number[] = [];

      for (let i = 0; i < testCases; i++) {
        const serverSeed = `limbo-seed-${i}`;
        const clientSeed = 'limbo-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          1.0,
        );

        multipliers.push(outcome.value);

        // Should never produce invalid multipliers
        expect(isFinite(outcome.value)).toBe(true);
        expect(outcome.value).not.toBeNaN();
        expect(outcome.value).toBeGreaterThanOrEqual(1.0);
      }

      // Should have distribution of multipliers
      const lowMultipliers = multipliers.filter((m) => m < 2.0).length;
      const mediumMultipliers = multipliers.filter((m) => m >= 2.0 && m < 10.0).length;
      const highMultipliers = multipliers.filter((m) => m >= 10.0).length;

      // Most should be low multipliers
      expect(lowMultipliers).toBeGreaterThan(testCases * 0.4);

      // Some medium
      expect(mediumMultipliers).toBeGreaterThan(testCases * 0.1);

      // Few high (but should exist)
      expect(highMultipliers).toBeGreaterThan(0);
    });

    it('should handle extreme hash values without division by zero', () => {
      // Test with hash that would produce normalized value very close to 1.0
      const extremeCases = [
        {
          serverSeed: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          clientSeed: 'ffffffffffffffffffffffffffffffff',
          nonce: '1',
        },
        {
          serverSeed: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          clientSeed: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          nonce: '999',
        },
        {
          serverSeed: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          clientSeed: 'dddddddddddddddddddddddddddddddd',
          nonce: '12345',
        },
      ];

      for (const testCase of extremeCases) {
        const outcome = provablyFairService.calculateOutcome(
          testCase.serverSeed,
          testCase.clientSeed,
          testCase.nonce,
          GameTypeEnum.LIMBO,
          1.0,
        );

        expect(isFinite(outcome.value)).toBe(true);
        expect(outcome.value).not.toBeNaN();
        expect(outcome.value).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('should verify Limbo outcomes correctly', () => {
      const serverSeed = 'limbo-verify-seed';
      const clientSeed = 'limbo-verify-client';
      const nonce = '42';

      const outcome = provablyFairService.calculateOutcome(
        serverSeed,
        clientSeed,
        nonce,
        GameTypeEnum.LIMBO,
        1.0,
      );

      const verification = provablyFairService.verifyGameOutcome(
        serverSeed,
        clientSeed,
        nonce,
        GameTypeEnum.LIMBO,
        outcome.value,
      );

      expect(verification.isValid).toBe(true);
      expect(verification.calculatedOutcome).toBeCloseTo(outcome.value, 6);
    });
  });

  describe('Dice Game Integration', () => {
    it('should produce values in [0, 100) range', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `dice-seed-${i}`;
        const clientSeed = 'dice-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.DICE,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThan(100);
      }
    });

    it('should never produce values >= 100', () => {
      // Test with seeds that might produce edge values
      const extremeSeeds = Array.from({ length: 10000 }, (_, i) => `extreme-dice-${i}`);

      for (const serverSeed of extremeSeeds) {
        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          'dice-client',
          '1',
          GameTypeEnum.DICE,
        );

        expect(outcome.value).toBeLessThan(100);
      }
    });

    it('should round to 2 decimal places', () => {
      for (let i = 0; i < 100; i++) {
        const serverSeed = `dice-precision-${i}`;
        const clientSeed = 'dice-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.DICE,
        );

        // Check that value has at most 2 decimal places
        const rounded = Math.round(outcome.value * 100) / 100;
        expect(outcome.value).toBe(rounded);
      }
    });

    it('should verify dice outcomes correctly', () => {
      const serverSeed = 'dice-verify-seed';
      const clientSeed = 'dice-verify-client';
      const nonce = '7';

      const outcome = provablyFairService.calculateOutcome(
        serverSeed,
        clientSeed,
        nonce,
        GameTypeEnum.DICE,
      );

      const verification = provablyFairService.verifyGameOutcome(
        serverSeed,
        clientSeed,
        nonce,
        GameTypeEnum.DICE,
        outcome.value,
      );

      expect(verification.isValid).toBe(true);
      expect(verification.calculatedOutcome).toBe(outcome.value);
    });
  });

  describe('Crash Game Integration', () => {
    it('should produce valid crash points', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `crash-seed-${i}`;
        const nonce = `${i}`;

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          '',
          nonce,
          GameTypeEnum.CRASH,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(1.0);
        expect(outcome.value).toBeLessThanOrEqual(1000);
        expect(isFinite(outcome.value)).toBe(true);
      }
    });

    it('should have proper instant crash probability', () => {
      const testCases = 10000;
      let instantCrashes = 0;

      for (let i = 0; i < testCases; i++) {
        const serverSeed = `crash-instant-${i}`;
        const nonce = `${i}`;

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          '',
          nonce,
          GameTypeEnum.CRASH,
        );

        if (outcome.value === 1.0) {
          instantCrashes++;
        }
      }

      // Instant crash rate should be ~1%
      const instantCrashRate = instantCrashes / testCases;
      expect(instantCrashRate).toBeGreaterThan(0.005);
      expect(instantCrashRate).toBeLessThan(0.02);
    });

    it('should round crash points to 2 decimal places', () => {
      for (let i = 0; i < 100; i++) {
        const serverSeed = `crash-precision-${i}`;
        const nonce = `${i}`;

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          '',
          nonce,
          GameTypeEnum.CRASH,
        );

        // Check that value has at most 2 decimal places
        const rounded = Math.round(outcome.value * 100) / 100;
        expect(outcome.value).toBe(rounded);
      }
    });
  });

  describe('Roulette Game Integration', () => {
    it('should produce values in [0, 36] range', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `roulette-seed-${i}`;
        const clientSeed = 'roulette-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.ROULETTE,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThanOrEqual(36);
        expect(Number.isInteger(outcome.value)).toBe(true);
      }
    });

    it('should produce all numbers 0-36 over large sample', () => {
      const occurrences = new Array(37).fill(0);

      for (let i = 0; i < 10000; i++) {
        const serverSeed = `roulette-distribution-${i}`;
        const clientSeed = 'roulette-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.ROULETTE,
        );

        occurrences[outcome.value]++;
      }

      // All numbers should appear at least once
      for (let i = 0; i <= 36; i++) {
        expect(occurrences[i]).toBeGreaterThan(0);
      }
    });
  });

  describe('Plinko Game Integration', () => {
    it('should produce normalized values for path generation', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `plinko-seed-${i}`;
        const clientSeed = 'plinko-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.PLINKO,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThan(1.0);
      }
    });

    it('should generate multiple random values for ball path', () => {
      const serverSeed = 'plinko-multi-seed';
      const clientSeed = 'plinko-multi-client';
      const nonce = '1';

      // Generate 16 random values for Plinko path
      const values = provablyFairService.calculateMultipleOutcomes(
        serverSeed,
        clientSeed,
        nonce,
        16,
      );

      expect(values).toHaveLength(16);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1.0);
      });
    });
  });

  describe('Mines Game Integration', () => {
    it('should produce normalized values for grid generation', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `mines-seed-${i}`;
        const clientSeed = 'mines-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.MINES,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThan(1.0);
      }
    });

    it('should generate sufficient random values for mine placement', () => {
      const serverSeed = 'mines-multi-seed';
      const clientSeed = 'mines-multi-client';
      const nonce = '1';

      // Generate 25 random values for 5x5 grid
      const values = provablyFairService.calculateMultipleOutcomes(
        serverSeed,
        clientSeed,
        nonce,
        25,
      );

      expect(values).toHaveLength(25);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1.0);
      });
    });
  });

  describe('Keno Game Integration', () => {
    it('should produce normalized values for number selection', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `keno-seed-${i}`;
        const clientSeed = 'keno-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.KENO,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThan(1.0);
      }
    });

    it('should generate random values for keno ball selection', () => {
      const serverSeed = 'keno-multi-seed';
      const clientSeed = 'keno-multi-client';
      const nonce = '1';

      // Generate 20 random values for Keno draws
      const values = provablyFairService.calculateMultipleOutcomes(
        serverSeed,
        clientSeed,
        nonce,
        20,
      );

      expect(values).toHaveLength(20);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1.0);
      });
    });
  });

  describe('Blackjack Game Integration', () => {
    it('should produce normalized values for deck shuffling', () => {
      for (let i = 0; i < 1000; i++) {
        const serverSeed = `blackjack-seed-${i}`;
        const clientSeed = 'blackjack-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.BLACKJACK,
        );

        expect(outcome.value).toBeGreaterThanOrEqual(0);
        expect(outcome.value).toBeLessThan(1.0);
      }
    });

    it('should generate sufficient random values for full deck shuffle', () => {
      const serverSeed = 'blackjack-shuffle-seed';
      const clientSeed = 'blackjack-shuffle-client';
      const nonce = '1';

      // Generate 52 random values for deck shuffle
      const values = provablyFairService.calculateMultipleOutcomes(
        serverSeed,
        clientSeed,
        nonce,
        52,
      );

      expect(values).toHaveLength(52);
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1.0);
      });
    });
  });

  describe('Cross-Game Verification', () => {
    it('should produce deterministic outcomes across games for same seeds', () => {
      const serverSeed = 'cross-game-seed';
      const clientSeed = 'cross-game-client';
      const nonce = '1';

      const games = [
        GameTypeEnum.DICE,
        GameTypeEnum.LIMBO,
        GameTypeEnum.ROULETTE,
        GameTypeEnum.PLINKO,
        GameTypeEnum.MINES,
        GameTypeEnum.KENO,
        GameTypeEnum.BLACKJACK,
      ];

      for (const gameType of games) {
        const outcome1 = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          gameType,
        );

        const outcome2 = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          gameType,
        );

        expect(outcome1.value).toBe(outcome2.value);
        expect(outcome1.hash).toBe(outcome2.hash);
      }
    });

    it('should verify all games correctly', () => {
      const serverSeed = 'verify-all-seed';
      const clientSeed = 'verify-all-client';
      const nonce = '42';

      const games = [
        GameTypeEnum.DICE,
        GameTypeEnum.LIMBO,
        GameTypeEnum.ROULETTE,
        GameTypeEnum.PLINKO,
        GameTypeEnum.MINES,
        GameTypeEnum.KENO,
        GameTypeEnum.BLACKJACK,
      ];

      for (const gameType of games) {
        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          gameType,
          gameType === GameTypeEnum.LIMBO ? 1.0 : undefined,
        );

        const verification = provablyFairService.verifyGameOutcome(
          serverSeed,
          clientSeed,
          nonce,
          gameType,
          outcome.value,
        );

        expect(verification.isValid).toBe(true);
      }
    });
  });

  describe('Performance with New Normalization', () => {
    it('should calculate outcomes efficiently', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        provablyFairService.calculateOutcome(`server-${i}`, 'client', '1', GameTypeEnum.DICE);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 10k outcomes in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should generate multiple outcomes efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        provablyFairService.calculateMultipleOutcomes(
          `server-${i}`,
          'client',
          '1',
          52, // Full deck
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 1k * 52 values in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
});
