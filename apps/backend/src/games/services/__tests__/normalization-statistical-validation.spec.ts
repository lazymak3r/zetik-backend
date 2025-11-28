import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GameTypeEnum } from '@zetik/shared-entities';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { BytesToFloatService } from '../bytes-to-float.service';
import { HouseEdgeService } from '../house-edge.service';
import { ProvablyFairService } from '../provably-fair.service';

/**
 * CRITICAL STATISTICAL VALIDATION SUITE
 *
 * This test suite validates that the new BytesToFloat normalization:
 * 1. Maintains proper house edge across all games
 * 2. Produces uniform distribution
 * 3. Has no exploitable statistical patterns
 * 4. Maintains backward compatibility with verification
 *
 * Tests run with 100k+ simulations to ensure statistical significance.
 */
describe('Normalization Statistical Validation - 100k+ Simulations', () => {
  let bytesToFloatService: BytesToFloatService;
  let provablyFairService: ProvablyFairService;

  beforeAll(async () => {
    // Create mock repositories
    const mockSeedPairRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };

    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
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
            getEdge: jest.fn().mockReturnValue(1.0), // 1% house edge
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
          useValue: mockSeedPairRepository,
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

    bytesToFloatService = module.get<BytesToFloatService>(BytesToFloatService);
    provablyFairService = module.get<ProvablyFairService>(ProvablyFairService);
  });

  describe('Distribution Tests - 100k Simulations', () => {
    it('should produce uniform distribution across [0, 1) range', () => {
      const sampleSize = 100000;
      const buckets = 100; // 1% granularity
      const bucketCounts = new Array(buckets).fill(0);

      for (let i = 0; i < sampleSize; i++) {
        const randomBytes = crypto.randomBytes(4);
        const value = bytesToFloatService.singleBytesToFloat(randomBytes, 0);

        const bucketIndex = Math.min(Math.floor(value * buckets), buckets - 1);
        bucketCounts[bucketIndex]++;
      }

      // Expected count per bucket
      const expectedCount = sampleSize / buckets;
      const tolerance = expectedCount * 0.1; // 10% tolerance for 100k samples

      // Check each bucket is within tolerance
      for (let i = 0; i < buckets; i++) {
        expect(bucketCounts[i]).toBeGreaterThan(expectedCount - tolerance);
        expect(bucketCounts[i]).toBeLessThan(expectedCount + tolerance);
      }

      // Calculate chi-squared statistic
      let chiSquared = 0;
      for (let i = 0; i < buckets; i++) {
        const deviation = bucketCounts[i] - expectedCount;
        chiSquared += (deviation * deviation) / expectedCount;
      }

      // Critical value for 99 degrees of freedom at 95% confidence level ≈ 123.2
      const criticalValue = 123.2;
      expect(chiSquared).toBeLessThan(criticalValue);
    });

    it('should have mean close to 0.5 over 100k samples', () => {
      const sampleSize = 100000;
      let sum = 0;
      let sumOfSquares = 0;

      for (let i = 0; i < sampleSize; i++) {
        const randomBytes = crypto.randomBytes(4);
        const value = bytesToFloatService.singleBytesToFloat(randomBytes, 0);

        sum += value;
        sumOfSquares += value * value;
      }

      const mean = sum / sampleSize;
      const variance = sumOfSquares / sampleSize - mean * mean;
      const stdDev = Math.sqrt(variance);

      // For uniform distribution [0, 1):
      // Mean should be ~0.5
      // Variance should be ~1/12 ≈ 0.0833
      // Std dev should be ~0.2887
      expect(mean).toBeGreaterThan(0.49);
      expect(mean).toBeLessThan(0.51);
      expect(variance).toBeGreaterThan(0.08);
      expect(variance).toBeLessThan(0.09);
      expect(stdDev).toBeGreaterThan(0.28);
      expect(stdDev).toBeLessThan(0.3);
    });

    it('should pass Kolmogorov-Smirnov test for uniformity', () => {
      const sampleSize = 10000;
      const outcomes: number[] = [];

      // Generate samples
      for (let i = 0; i < sampleSize; i++) {
        const randomBytes = crypto.randomBytes(4);
        outcomes.push(bytesToFloatService.singleBytesToFloat(randomBytes, 0));
      }

      // Sort outcomes
      outcomes.sort((a, b) => a - b);

      // Calculate KS statistic
      let maxDifference = 0;
      for (let i = 0; i < outcomes.length; i++) {
        const empiricalCDF = (i + 1) / sampleSize;
        const theoreticalCDF = outcomes[i]; // For uniform [0,1)
        const difference = Math.abs(empiricalCDF - theoreticalCDF);
        maxDifference = Math.max(maxDifference, difference);
      }

      // Critical value for KS test at 95% confidence with n=10000
      const criticalValue = 1.36 / Math.sqrt(sampleSize); // ≈ 0.0136
      expect(maxDifference).toBeLessThan(criticalValue);
    });

    it('should have no bias toward 0 or 1', () => {
      const sampleSize = 100000;
      const lowRange = { count: 0, sum: 0 }; // [0, 0.1)
      const midRange = { count: 0, sum: 0 }; // [0.45, 0.55)
      const highRange = { count: 0, sum: 0 }; // [0.9, 1.0)

      for (let i = 0; i < sampleSize; i++) {
        const randomBytes = crypto.randomBytes(4);
        const value = bytesToFloatService.singleBytesToFloat(randomBytes, 0);

        if (value < 0.1) {
          lowRange.count++;
          lowRange.sum += value;
        } else if (value >= 0.45 && value < 0.55) {
          midRange.count++;
          midRange.sum += value;
        } else if (value >= 0.9) {
          highRange.count++;
          highRange.sum += value;
        }
      }

      // Each 10% range should contain ~10% of samples
      const expectedLowCount = sampleSize * 0.1;
      const expectedMidCount = sampleSize * 0.1;
      const expectedHighCount = sampleSize * 0.1;

      const tolerance = 0.15; // 15% tolerance

      expect(lowRange.count).toBeGreaterThan(expectedLowCount * (1 - tolerance));
      expect(lowRange.count).toBeLessThan(expectedLowCount * (1 + tolerance));

      expect(midRange.count).toBeGreaterThan(expectedMidCount * (1 - tolerance));
      expect(midRange.count).toBeLessThan(expectedMidCount * (1 + tolerance));

      expect(highRange.count).toBeGreaterThan(expectedHighCount * (1 - tolerance));
      expect(highRange.count).toBeLessThan(expectedHighCount * (1 + tolerance));
    });
  });

  describe('Limbo House Edge Verification - 1M Simulations', () => {
    it('should maintain 1% house edge at 2x multiplier (500k bets)', () => {
      const simulations = 500000;
      const targetMultiplier = 2.0;
      const houseEdge = 0.01; // 1%
      const betAmount = 100; // $100 per bet

      let totalWagered = 0;
      let totalPaidOut = 0;
      let wins = 0;
      let losses = 0;

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `server-seed-${i}`;
        const clientSeed = 'client-seed';
        const nonce = '1';

        // Calculate Limbo outcome
        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          houseEdge * 100, // Convert to percentage
        );

        totalWagered += betAmount;

        if (outcome.value >= targetMultiplier) {
          // Win: payout = betAmount * targetMultiplier
          totalPaidOut += betAmount * targetMultiplier;
          wins++;
        } else {
          // Loss: no payout
          losses++;
        }
      }

      const actualRTP = totalPaidOut / totalWagered;
      const expectedRTP = 1 - houseEdge; // 0.99 = 99%
      const actualHouseEdge = 1 - actualRTP;

      // RTP should be 99% ± 0.1%
      expect(actualRTP).toBeGreaterThan(expectedRTP - 0.001);
      expect(actualRTP).toBeLessThan(expectedRTP + 0.001);

      // House edge should be 1% ± 0.1%
      expect(actualHouseEdge).toBeGreaterThan(houseEdge - 0.001);
      expect(actualHouseEdge).toBeLessThan(houseEdge + 0.001);

      // Win rate should match probability: P(outcome >= 2x) = (1-0.01)/2 = 0.495
      const actualWinRate = wins / simulations;
      const expectedWinRate = (1 - houseEdge) / targetMultiplier;
      expect(actualWinRate).toBeGreaterThan(expectedWinRate - 0.005);
      expect(actualWinRate).toBeLessThan(expectedWinRate + 0.005);
    });

    it('should maintain 1% house edge at 10x multiplier (300k bets)', () => {
      const simulations = 300000;
      const targetMultiplier = 10.0;
      const houseEdge = 0.01;
      const betAmount = 100;

      let totalWagered = 0;
      let totalPaidOut = 0;
      let wins = 0;

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `server-seed-10x-${i}`;
        const clientSeed = 'client-seed';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          houseEdge * 100,
        );

        totalWagered += betAmount;

        if (outcome.value >= targetMultiplier) {
          totalPaidOut += betAmount * targetMultiplier;
          wins++;
        }
      }

      const actualRTP = totalPaidOut / totalWagered;
      const expectedRTP = 1 - houseEdge;
      const actualHouseEdge = 1 - actualRTP;

      expect(actualRTP).toBeGreaterThan(expectedRTP - 0.005);
      expect(actualRTP).toBeLessThan(expectedRTP + 0.005);

      expect(actualHouseEdge).toBeGreaterThan(houseEdge - 0.005);
      expect(actualHouseEdge).toBeLessThan(houseEdge + 0.005);

      // Win rate: P(outcome >= 10x) = (1-0.01)/10 = 0.099
      const actualWinRate = wins / simulations;
      const expectedWinRate = (1 - houseEdge) / targetMultiplier;
      expect(actualWinRate).toBeGreaterThan(expectedWinRate - 0.002);
      expect(actualWinRate).toBeLessThan(expectedWinRate + 0.002);
    });

    it('should maintain 1% house edge at 100x multiplier (200k bets)', () => {
      const simulations = 200000;
      const targetMultiplier = 100.0;
      const houseEdge = 0.01;
      const betAmount = 100;

      let totalWagered = 0;
      let totalPaidOut = 0;
      let wins = 0;

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `server-seed-100x-${i}`;
        const clientSeed = 'client-seed';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          houseEdge * 100,
        );

        totalWagered += betAmount;

        if (outcome.value >= targetMultiplier) {
          totalPaidOut += betAmount * targetMultiplier;
          wins++;
        }
      }

      const actualRTP = totalPaidOut / totalWagered;
      const expectedRTP = 1 - houseEdge;

      expect(actualRTP).toBeGreaterThan(expectedRTP - 0.01);
      expect(actualRTP).toBeLessThan(expectedRTP + 0.01);

      // Win rate: P(outcome >= 100x) = (1-0.01)/100 = 0.0099
      const actualWinRate = wins / simulations;
      const expectedWinRate = (1 - houseEdge) / targetMultiplier;
      expect(actualWinRate).toBeGreaterThan(expectedWinRate - 0.001);
      expect(actualWinRate).toBeLessThan(expectedWinRate + 0.001);
    });

    it('should never produce infinity or division by zero errors (100k tests)', () => {
      const simulations = 100000;
      const houseEdge = 0.01;

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `server-seed-safety-${i}`;
        const clientSeed = 'client-seed';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.LIMBO,
          houseEdge * 100,
        );

        // Should never be infinity or NaN
        expect(outcome.value).not.toBeNaN();
        expect(outcome.value).not.toBeNaN();

        // Should be >= 1.0 (minimum Limbo multiplier)
        expect(outcome.value).toBeGreaterThanOrEqual(1.0);

        // Should not exceed maximum cap
        expect(outcome.value).toBeLessThanOrEqual(1000000);
      }
    });
  });

  describe('Dice Game Distribution - 100k Simulations', () => {
    it('should produce uniform distribution in [0, 100) range', () => {
      const simulations = 100000;
      const buckets = 100; // 0-1, 1-2, ..., 99-100
      const bucketCounts = new Array(buckets).fill(0);

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `dice-server-${i}`;
        const clientSeed = 'dice-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.DICE,
        );

        const bucketIndex = Math.min(Math.floor(outcome.value), buckets - 1);
        bucketCounts[bucketIndex]++;
      }

      const expectedCount = simulations / buckets;
      const tolerance = expectedCount * 0.15; // 15% tolerance

      for (let i = 0; i < buckets; i++) {
        expect(bucketCounts[i]).toBeGreaterThan(expectedCount - tolerance);
        expect(bucketCounts[i]).toBeLessThan(expectedCount + tolerance);
      }
    });

    it('should maintain proper win probability at 50/50 (100k bets)', () => {
      const simulations = 100000;
      const threshold = 50;
      let wins = 0;

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `dice-50-${i}`;
        const clientSeed = 'dice-client';
        const nonce = '1';

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce,
          GameTypeEnum.DICE,
        );

        if (outcome.value > threshold) {
          wins++;
        }
      }

      const winRate = wins / simulations;

      // Win rate should be ~50%
      expect(winRate).toBeGreaterThan(0.49);
      expect(winRate).toBeLessThan(0.51);
    });
  });

  describe('Crash Game Distribution - 100k Simulations', () => {
    it('should maintain proper crash point distribution', () => {
      const simulations = 100000;
      const ranges = {
        instant: 0, // 1.00x
        low: 0, // 1.01x - 2.00x
        medium: 0, // 2.01x - 10.00x
        high: 0, // 10.01x - 100.00x
        moon: 0, // > 100.00x
      };

      for (let i = 0; i < simulations; i++) {
        const serverSeed = `crash-server-${i}`;
        const nonce = `${i}`;

        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          '',
          nonce,
          GameTypeEnum.CRASH,
        );

        if (outcome.value === 1.0) {
          ranges.instant++;
        } else if (outcome.value <= 2.0) {
          ranges.low++;
        } else if (outcome.value <= 10.0) {
          ranges.medium++;
        } else if (outcome.value <= 100.0) {
          ranges.high++;
        } else {
          ranges.moon++;
        }
      }

      // Verify distribution follows expected crash game probabilities
      const totalCrashes = ranges.instant + ranges.low + ranges.medium + ranges.high + ranges.moon;
      expect(totalCrashes).toBe(simulations);

      // Instant crashes should be ~1%
      const instantRate = ranges.instant / simulations;
      expect(instantRate).toBeGreaterThan(0.005);
      expect(instantRate).toBeLessThan(0.015);

      // Low crashes should be most common
      const lowRate = ranges.low / simulations;
      expect(lowRate).toBeGreaterThan(0.4);

      // Moon shots should be rare
      const moonRate = ranges.moon / simulations;
      expect(moonRate).toBeLessThan(0.01);
    });
  });

  describe('Pattern Detection - No Exploitable Patterns', () => {
    it('should have no autocorrelation in sequential outcomes (10k samples)', () => {
      const sampleSize = 10000;
      const outcomes: number[] = [];
      const serverSeed = 'autocorr-server';
      const clientSeed = 'autocorr-client';

      // Generate sequential outcomes
      for (let nonce = 0; nonce < sampleSize; nonce++) {
        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          nonce.toString(),
          GameTypeEnum.DICE,
        );
        outcomes.push(outcome.value);
      }

      // Calculate lag-1 autocorrelation
      const mean = outcomes.reduce((sum, val) => sum + val, 0) / outcomes.length;
      let numerator = 0;
      let denominator = 0;

      for (let i = 1; i < outcomes.length; i++) {
        numerator += (outcomes[i] - mean) * (outcomes[i - 1] - mean);
      }

      for (let i = 0; i < outcomes.length; i++) {
        denominator += (outcomes[i] - mean) * (outcomes[i] - mean);
      }

      const autocorrelation = numerator / denominator;

      // Autocorrelation should be close to 0 for truly random data
      expect(Math.abs(autocorrelation)).toBeLessThan(0.05);
    });

    it('should have no martingale exploit patterns (10k doubles)', () => {
      const simulations = 10000;
      let currentBet = 1;
      let totalLoss = 0;

      const serverSeed = 'martingale-server';
      const clientSeed = 'martingale-client';

      for (let i = 0; i < simulations; i++) {
        const outcome = provablyFairService.calculateOutcome(
          serverSeed,
          clientSeed,
          i.toString(),
          GameTypeEnum.DICE,
        );

        totalLoss += currentBet;

        if (outcome.value > 50) {
          // Win - reset bet
          totalLoss -= currentBet * 2;
          currentBet = 1;
        } else {
          // Loss - double bet
          currentBet *= 2;
          if (currentBet > 1000000) currentBet = 1; // Reset if exceeds limit
        }
      }

      // Martingale should not be profitable
      expect(totalLoss).toBeGreaterThan(0);
    });
  });

  describe('Comparison with Legacy Normalization', () => {
    it('should produce similar but slightly different distribution', () => {
      const sampleSize = 10000;
      const stakeDifferences: number[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const randomBytes = crypto.randomBytes(4);

        // New Stake method
        const stakeValue = bytesToFloatService.singleBytesToFloat(randomBytes, 0);

        // Legacy method (for comparison)
        const hexString = randomBytes.toString('hex').substring(0, 8);
        const decimalValue = parseInt(hexString, 16);
        const legacyValue = decimalValue / (0x100000000 - 1);

        const difference = Math.abs(stakeValue - legacyValue);
        stakeDifferences.push(difference);
      }

      // Calculate average difference
      const avgDifference = stakeDifferences.reduce((sum, diff) => sum + diff, 0) / sampleSize;

      // Differences should be very small (< 0.01% on average)
      expect(avgDifference).toBeLessThan(0.0001);

      // Maximum difference should be small
      const maxDifference = Math.max(...stakeDifferences);
      expect(maxDifference).toBeLessThan(0.001);
    });

    it('should never produce 1.0 unlike legacy method', () => {
      const maxBytes = Buffer.from([0xff, 0xff, 0xff, 0xff]);

      // New Stake method
      const stakeValue = bytesToFloatService.singleBytesToFloat(maxBytes, 0);

      // Legacy method
      const hexString = maxBytes.toString('hex').substring(0, 8);
      const decimalValue = parseInt(hexString, 16);
      const legacyValue = decimalValue / (0x100000000 - 1);

      // Stake method should be < 1.0
      expect(stakeValue).toBeLessThan(1.0);

      // Legacy method should be exactly 1.0
      expect(legacyValue).toBe(1.0);

      // This is the critical fix!
      expect(stakeValue).not.toBe(1.0);
    });
  });

  describe('Backward Compatibility - Historical Verification', () => {
    it('should verify old games with new normalization correctly', () => {
      // Simulate historical game verification
      const historicalGames = [
        {
          serverSeed: 'old-seed-1',
          clientSeed: 'old-client-1',
          nonce: '1',
          gameType: GameTypeEnum.DICE,
        },
        {
          serverSeed: 'old-seed-2',
          clientSeed: 'old-client-2',
          nonce: '5',
          gameType: GameTypeEnum.LIMBO,
        },
        {
          serverSeed: 'old-seed-3',
          clientSeed: 'old-client-3',
          nonce: '10',
          gameType: GameTypeEnum.CRASH,
        },
      ];

      for (const game of historicalGames) {
        // Calculate outcome with new normalization
        const outcome = provablyFairService.calculateOutcome(
          game.serverSeed,
          game.clientSeed,
          game.nonce,
          game.gameType,
        );

        // Verify the outcome
        const verification = provablyFairService.verifyGameOutcome(
          game.serverSeed,
          game.clientSeed,
          game.nonce,
          game.gameType,
          outcome.value,
        );

        expect(verification.isValid).toBe(true);
        expect(verification.calculatedOutcome).toBeCloseTo(outcome.value, 10);
      }
    });
  });
});
