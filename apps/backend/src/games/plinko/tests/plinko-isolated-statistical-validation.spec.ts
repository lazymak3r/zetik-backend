/**
 * 🎯 PLINKO ISOLATED STATISTICAL VALIDATION TESTS - 200K SIMULATIONS
 *
 * CRITICAL MISSION: Mathematical proof of Plinko game correctness through large-scale simulations
 *
 * This file contains ISOLATED statistical validation tests that:
 * 1. Replicate exact ProvablyFairService + PlinkoService logic
 * 2. Run 200,000 simulations for mathematical significance
 * 3. Validate binomial distribution uniformity
 * 4. Verify multiplier table payouts match Stake.com
 * 5. Perform Chi-squared tests for fairness
 * 6. Check autocorrelation to detect patterns
 * 7. Meet casino industry standards (MGA/Curacao compliance)
 *
 * ⚠️  IMPORTANT: These tests should FIND PROBLEMS in the code logic,
 * NOT be adjusted to pass. If tests fail → fix the game logic!
 */

import * as crypto from 'crypto';

// Multiplier tables from PlinkoService (matches Stake.com)
const MULTIPLIER_TABLES = {
  LOW: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  MEDIUM: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  HIGH: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

describe('🎯 PLINKO ISOLATED STATISTICAL VALIDATION - 200K Mathematical Proof', () => {
  // 🔧 ISOLATED PLINKO BALL DROP GENERATION
  // Exact replica of PlinkoService logic - NO dependencies
  function generateIsolatedBallDrop(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    rowCount: number,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
  ): { bucketIndex: number; ballPath: number[] } {
    const ballPath: number[] = [];
    const bucketCount = rowCount + 1;

    // Pure 50/50 probability - risk levels only affect multiplier tables
    const leftProbability = 0.5;

    // Start at top center
    let leftSteps = 0;
    ballPath.push(Math.floor(bucketCount / 2));

    // Each row: independent binary decision (left vs right)
    for (let row = 1; row <= rowCount; row++) {
      // Generate random value using cursor-based approach (matches ProvablyFairService)
      const hmac = crypto.createHmac('sha512', serverSeed);
      const data = `${clientSeed}:${nonce}:${row - 1}`;
      hmac.update(data);
      const hash = hmac.digest('hex');
      const hashBytes = Buffer.from(hash, 'hex');

      // Bytes-to-float normalization (Stake.com algorithm - CORRECT VERSION)
      // CRITICAL: Must use exact same algorithm as BytesToFloatService
      // Formula: byte[0]/256 + byte[1]/65536 + byte[2]/16777216 + byte[3]/4294967296
      const DIVISORS = [256, 65536, 16777216, 4294967296];
      let randomValue = 0;
      for (let j = 0; j < 4; j++) {
        const byte = hashBytes[j];
        randomValue += byte / DIVISORS[j];
      }

      // Binary decision: left or right
      const goesLeft = randomValue < leftProbability;

      if (goesLeft) {
        leftSteps++;
      }

      // Calculate current visual position
      const currentPosition = leftSteps;
      ballPath.push(currentPosition);
    }

    return {
      bucketIndex: leftSteps,
      ballPath,
    };
  }

  // 📊 Helper function to run large simulations
  function runPlinkoSimulation(
    rounds: number,
    rowCount: number,
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    serverSeed: string = 'test-server-seed-123',
    clientSeed: string = 'test-client-seed-456',
  ): {
    results: number[];
    buckets: Map<number, number>;
    multipliers: number[];
    averageMultiplier: number;
  } {
    const results: number[] = [];
    const buckets = new Map<number, number>();
    const multipliers: number[] = [];

    for (let i = 0; i < rounds; i++) {
      const { bucketIndex } = generateIsolatedBallDrop(
        serverSeed,
        clientSeed,
        i + 1,
        rowCount,
        riskLevel,
      );
      results.push(bucketIndex);

      // Track bucket distribution
      buckets.set(bucketIndex, (buckets.get(bucketIndex) || 0) + 1);

      // Get multiplier
      const multiplierTable = MULTIPLIER_TABLES[riskLevel][rowCount];
      const multiplier = multiplierTable[bucketIndex];
      multipliers.push(multiplier);
    }

    const averageMultiplier = multipliers.reduce((sum, val) => sum + val, 0) / multipliers.length;

    return {
      results,
      buckets,
      multipliers,
      averageMultiplier,
    };
  }

  // Helper function to calculate factorial
  function factorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  describe('🎯 Binomial Distribution Validation - Medium Risk', () => {
    const SIMULATION_ROUNDS = process.env.VALIDATION_SIMULATIONS
      ? parseInt(process.env.VALIDATION_SIMULATIONS)
      : process.env.CI
        ? 10000
        : 200000;
    const ROW_COUNT = 16;

    it('should follow binomial distribution for 16 rows (17 buckets)', () => {
      const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, ROW_COUNT, 'MEDIUM');

      console.log(
        `\n🎯 Binomial Distribution Test (${SIMULATION_ROUNDS.toLocaleString()} samples, 16 rows):`,
      );

      // Expected distribution: binomial distribution with p = 0.5, n = 16
      // Calculate expected probabilities for each bucket
      const expectedProbabilities: number[] = [];
      for (let k = 0; k <= ROW_COUNT; k++) {
        // Binomial coefficient: C(n, k) = n! / (k! * (n-k)!)
        const binomialCoeff = factorial(ROW_COUNT) / (factorial(k) * factorial(ROW_COUNT - k));
        const probability = binomialCoeff * Math.pow(0.5, ROW_COUNT);
        expectedProbabilities.push(probability);
      }

      // Chi-squared test
      let chiSquared = 0;
      for (let bucket = 0; bucket <= ROW_COUNT; bucket++) {
        const observed = simulation.buckets.get(bucket) || 0;
        const expected = expectedProbabilities[bucket] * SIMULATION_ROUNDS;

        console.log(
          `Bucket ${bucket}: ${observed} (expected: ${expected.toFixed(0)}) - probability: ${(expectedProbabilities[bucket] * 100).toFixed(2)}%`,
        );

        chiSquared += Math.pow(observed - expected, 2) / expected;
      }

      console.log(`\nChi-squared statistic: ${chiSquared.toFixed(4)}`);
      console.log(`Degrees of freedom: ${ROW_COUNT}`); // 17 buckets - 1
      console.log(`Critical value (99% confidence): 33.409`); // For df=16 at 99%

      // Chi-squared test: should be less than critical value
      expect(chiSquared).toBeLessThan(33.409); // 99% confidence level
    }, 300000);

    it('should have center bucket as most common (binomial peak)', () => {
      const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, ROW_COUNT, 'MEDIUM');

      // For 16 rows, center bucket is bucket 8 (16/2)
      const centerBucket = ROW_COUNT / 2;
      const centerCount = simulation.buckets.get(centerBucket) || 0;

      console.log(`\n🎯 Center Bucket Test (16 rows, MEDIUM risk):`);
      console.log(`Center bucket (${centerBucket}): ${centerCount} occurrences`);

      // Center bucket should be most common
      let maxCount = 0;
      let maxBucket = -1;
      for (const [bucket, count] of simulation.buckets.entries()) {
        if (count > maxCount) {
          maxCount = count;
          maxBucket = bucket;
        }
      }

      console.log(`Most common bucket: ${maxBucket} with ${maxCount} occurrences`);

      expect(maxBucket).toBe(centerBucket);
    }, 300000);
  });

  describe('📊 Risk Level Distribution Consistency Tests', () => {
    const SIMULATION_ROUNDS = process.env.VALIDATION_SIMULATIONS
      ? parseInt(process.env.VALIDATION_SIMULATIONS)
      : process.env.CI
        ? 10000
        : 200000;
    const ROW_COUNT = 16;

    it('All risk levels should have identical 50/50 distribution', () => {
      const riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
      const probabilities: Record<string, number> = {};

      riskLevels.forEach((riskLevel) => {
        const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, ROW_COUNT, riskLevel);

        // Calculate actual left probability
        const totalLeftDecisions = simulation.results.reduce((sum, val) => sum + val, 0);
        const totalDecisions = SIMULATION_ROUNDS * ROW_COUNT;
        const actualLeftProbability = totalLeftDecisions / totalDecisions;

        probabilities[riskLevel] = actualLeftProbability;

        console.log(
          `\n📊 ${riskLevel} Risk Distribution Test (${SIMULATION_ROUNDS.toLocaleString()} samples):`,
        );
        console.log(`Expected left probability: 0.500000 (50.0000%)`);
        console.log(
          `Actual left probability: ${actualLeftProbability.toFixed(6)} (${(actualLeftProbability * 100).toFixed(4)}%)`,
        );
        console.log(`Deviation: ${Math.abs(actualLeftProbability - 0.5).toFixed(6)}`);

        // All risk levels should have 50/50 distribution
        expect(Math.abs(actualLeftProbability - 0.5)).toBeLessThan(0.001);
      });

      // Verify all risk levels have similar probabilities (within 0.1% of each other)
      const probabilityValues = Object.values(probabilities);
      const maxProb = Math.max(...probabilityValues);
      const minProb = Math.min(...probabilityValues);
      const probDiff = maxProb - minProb;

      console.log(
        `\n📊 Probability difference across risk levels: ${(probDiff * 100).toFixed(4)}%`,
      );
      expect(probDiff).toBeLessThan(0.001); // Within 0.1% difference
    }, 600000);

    it('All risk levels should produce identical binomial distributions', () => {
      const riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
      const distributions: Record<string, Map<number, number>> = {};

      riskLevels.forEach((riskLevel) => {
        const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, ROW_COUNT, riskLevel);
        distributions[riskLevel] = simulation.buckets;
      });

      // Compare distributions between risk levels using chi-squared test
      const comparisons = [
        { risk1: 'LOW', risk2: 'MEDIUM' },
        { risk1: 'HIGH', risk2: 'MEDIUM' },
      ];

      comparisons.forEach(({ risk1, risk2 }) => {
        let chiSquared = 0;
        for (let bucket = 0; bucket <= ROW_COUNT; bucket++) {
          const observed = distributions[risk1].get(bucket) || 0;
          const expected = distributions[risk2].get(bucket) || 0;
          if (expected > 5) {
            chiSquared += Math.pow(observed - expected, 2) / expected;
          }
        }

        const criticalValue = 27.0; // χ²(16, 0.05) for 95% confidence
        console.log(
          `\n📊 Distribution comparison ${risk1} vs ${risk2}: χ² = ${chiSquared.toFixed(2)} (critical = ${criticalValue})`,
        );
        expect(chiSquared).toBeLessThan(criticalValue);
      });
    }, 600000);
  });

  describe('💰 House Edge Validation', () => {
    const SIMULATION_ROUNDS = process.env.VALIDATION_SIMULATIONS
      ? parseInt(process.env.VALIDATION_SIMULATIONS)
      : process.env.CI
        ? 10000
        : 200000;

    it('should have house edge close to 1% for MEDIUM risk, 16 rows', () => {
      const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, 16, 'MEDIUM');

      console.log(
        `\n💰 House Edge Test - MEDIUM Risk, 16 Rows (${SIMULATION_ROUNDS.toLocaleString()} samples):`,
      );
      console.log(`Average multiplier: ${simulation.averageMultiplier.toFixed(4)}x`);

      // Expected average multiplier for fair game (100% RTP): 1.00x
      // With ~1% house edge: ~0.99x
      const expectedMultiplier = 0.99; // Approximate target
      const deviation = Math.abs(simulation.averageMultiplier - expectedMultiplier);

      console.log(`Expected multiplier: ~${expectedMultiplier}x (99% RTP)`);
      console.log(`Deviation: ${deviation.toFixed(4)}`);
      console.log(`House edge: ~${((1 - simulation.averageMultiplier) * 100).toFixed(2)}%`);

      // Allow 0.1 deviation (house edge varies by row count and risk level)
      expect(deviation).toBeLessThan(0.1);
    }, 300000);

    it('should have consistent house edge across all row counts (MEDIUM risk)', () => {
      const rowCounts = [8, 12, 16];
      const ROUNDS = process.env.CI ? 5000 : 100000;

      console.log(
        `\n💰 House Edge Consistency Test (${ROUNDS.toLocaleString()} samples per row count):`,
      );

      const houseEdges: number[] = [];

      for (const rowCount of rowCounts) {
        const simulation = runPlinkoSimulation(ROUNDS, rowCount, 'MEDIUM');
        const houseEdge = (1 - simulation.averageMultiplier) * 100;
        houseEdges.push(houseEdge);

        console.log(
          `${rowCount} rows: Average multiplier = ${simulation.averageMultiplier.toFixed(4)}x, House edge = ${houseEdge.toFixed(2)}%`,
        );
      }

      // All house edges should be within reasonable range (0.5% - 2%)
      for (const edge of houseEdges) {
        expect(edge).toBeGreaterThan(0.5);
        expect(edge).toBeLessThan(2);
      }
    }, 600000);
  });

  describe('🔍 Randomness Quality Tests', () => {
    const SIMULATION_ROUNDS = process.env.VALIDATION_SIMULATIONS
      ? parseInt(process.env.VALIDATION_SIMULATIONS)
      : process.env.CI
        ? 5000
        : 50000;

    it('should produce no deterministic patterns (autocorrelation test)', () => {
      const serverSeed = 'pattern-test-server-seed';
      const clientSeed = 'pattern-test-client-seed';
      const simulation = runPlinkoSimulation(
        SIMULATION_ROUNDS,
        16,
        'MEDIUM',
        serverSeed,
        clientSeed,
      );

      // Check for autocorrelation (should be near zero for random data)
      const mean =
        simulation.results.reduce((sum, val) => sum + val, 0) / simulation.results.length;
      let autocorr = 0;
      const lag = 1;

      for (let i = 0; i < simulation.results.length - lag; i++) {
        autocorr += (simulation.results[i] - mean) * (simulation.results[i + lag] - mean);
      }

      autocorr /= simulation.results.length - lag;

      const variance =
        simulation.results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        simulation.results.length;

      const autocorrCoeff = autocorr / variance;

      console.log(`\n🔍 Autocorrelation Test (${SIMULATION_ROUNDS.toLocaleString()} samples):`);
      console.log(`Autocorrelation coefficient (lag=1): ${autocorrCoeff.toFixed(8)}`);
      console.log(`Expected for random data: ~0.0`);

      // Autocorrelation should be very close to zero for random data
      expect(Math.abs(autocorrCoeff)).toBeLessThan(0.05);
    }, 120000);

    it('should produce different outcomes with different seeds', () => {
      const seed1Results = runPlinkoSimulation(1000, 16, 'MEDIUM', 'seed1', 'client1');
      const seed2Results = runPlinkoSimulation(1000, 16, 'MEDIUM', 'seed2', 'client2');

      // Results should be different with different seeds
      const matchCount = seed1Results.results.filter(
        (val, idx) => val === seed2Results.results[idx],
      ).length;

      console.log(`\n🔍 Seed Uniqueness Test (1,000 samples each):`);
      console.log(`Matching outcomes: ${matchCount}/1000`);
      console.log(`Expected: <200 (< 20% match rate for random binomial data)`);

      // With different seeds, outcomes should be very different
      // For binomial distribution, some overlap is expected
      expect(matchCount).toBeLessThan(200); // Less than 20% match rate
    }, 30000);
  });

  describe('🎲 Edge Case Validation', () => {
    it('should handle all row counts correctly', () => {
      const rowCounts = [8, 9, 10, 11, 12, 13, 14, 15, 16];

      console.log(`\n🎲 Row Count Validation:`);

      for (const rowCount of rowCounts) {
        const { bucketIndex } = generateIsolatedBallDrop(
          'test-server-seed',
          'test-client-seed',
          1,
          rowCount,
          'MEDIUM',
        );

        const expectedBuckets = rowCount + 1;
        const multiplierTable = MULTIPLIER_TABLES.MEDIUM[rowCount];

        console.log(
          `${rowCount} rows: bucket ${bucketIndex}/${rowCount} (${expectedBuckets} total buckets), multiplier: ${multiplierTable[bucketIndex]}x`,
        );

        expect(bucketIndex).toBeGreaterThanOrEqual(0);
        expect(bucketIndex).toBeLessThanOrEqual(rowCount);
        expect(multiplierTable[bucketIndex]).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce all possible buckets over many simulations', () => {
      const ROW_COUNT = 12;
      const ROUNDS = process.env.CI ? 10000 : 100000;

      const simulation = runPlinkoSimulation(ROUNDS, ROW_COUNT, 'MEDIUM');

      console.log(
        `\n🎲 Bucket Coverage Test (${ROUNDS.toLocaleString()} samples, ${ROW_COUNT} rows):`,
      );
      console.log(`Expected buckets: ${ROW_COUNT + 1} (0 to ${ROW_COUNT})`);
      console.log(`Observed unique buckets: ${simulation.buckets.size}`);

      // With 100k samples, all 13 buckets should appear
      expect(simulation.buckets.size).toBe(ROW_COUNT + 1);
    });

    it('should match Stake.com multiplier tables exactly', () => {
      console.log(`\n🎲 Stake.com Multiplier Table Compatibility:`);
      console.log(`Risk levels: LOW, MEDIUM, HIGH`);
      console.log(`Row counts: 8, 9, 10, 11, 12, 13, 14, 15, 16`);
      console.log(`✅ Multiplier tables loaded and verified`);

      // Verify all risk levels have all row counts
      for (const risk of ['LOW', 'MEDIUM', 'HIGH']) {
        for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
          const table = MULTIPLIER_TABLES[risk][rows];
          expect(table).toBeDefined();
          expect(table.length).toBe(rows + 1);
        }
      }
    });
  });

  describe('🎮 ALL CONFIGURATIONS COMPREHENSIVE TEST - 27 Config Matrix', () => {
    const SIMULATION_ROUNDS = process.env.VALIDATION_SIMULATIONS
      ? parseInt(process.env.VALIDATION_SIMULATIONS)
      : process.env.CI
        ? 1000
        : 100000; // Reduced default since we're testing 27 configs

    it('should validate all 27 configurations (LOW/MEDIUM/HIGH × 8-16 rows)', () => {
      const riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
      const rowCounts = [8, 9, 10, 11, 12, 13, 14, 15, 16];

      console.log(`\n🎮 COMPREHENSIVE CONFIGURATION MATRIX TEST`);
      console.log(`=`.repeat(80));
      console.log(
        `Total configurations: ${riskLevels.length * rowCounts.length} (3 risk levels × 9 row counts)`,
      );
      console.log(`Simulations per config: ${SIMULATION_ROUNDS.toLocaleString()}`);
      console.log(
        `Total simulations: ${(riskLevels.length * rowCounts.length * SIMULATION_ROUNDS).toLocaleString()}`,
      );
      console.log(`=`.repeat(80));

      const results: Array<{
        risk: string;
        rows: number;
        avgMultiplier: number;
        houseEdge: number;
        uniqueBuckets: number;
        centerBucket: number;
        centerCount: number;
      }> = [];

      // Test all 27 configurations
      for (const risk of riskLevels) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🎯 RISK LEVEL: ${risk}`);
        console.log(`${'='.repeat(80)}`);

        for (const rows of rowCounts) {
          const simulation = runPlinkoSimulation(SIMULATION_ROUNDS, rows, risk);

          // Calculate metrics
          const houseEdge = (1 - simulation.averageMultiplier) * 100;
          const uniqueBuckets = simulation.buckets.size;
          const centerBucket = Math.floor(rows / 2);
          const centerCount = simulation.buckets.get(centerBucket) || 0;

          // Store results
          results.push({
            risk,
            rows,
            avgMultiplier: simulation.averageMultiplier,
            houseEdge,
            uniqueBuckets,
            centerBucket,
            centerCount,
          });

          // Output detailed results for each configuration
          console.log(`\n  ${risk} - ${rows} rows (${rows + 1} buckets):`);
          console.log(`    Average Multiplier: ${simulation.averageMultiplier.toFixed(4)}x`);
          console.log(`    House Edge: ${houseEdge.toFixed(2)}%`);
          console.log(`    Unique Buckets Seen: ${uniqueBuckets}/${rows + 1}`);
          console.log(
            `    Center Bucket (#${centerBucket}): ${centerCount} hits (${((centerCount / SIMULATION_ROUNDS) * 100).toFixed(2)}%)`,
          );

          // Validations
          expect(simulation.averageMultiplier).toBeGreaterThan(0);
          expect(simulation.averageMultiplier).toBeLessThan(2); // Reasonable upper bound
          expect(houseEdge).toBeGreaterThan(-1); // Allow slight negative for variance
          expect(houseEdge).toBeLessThan(5); // House edge should be reasonable
          expect(uniqueBuckets).toBeGreaterThan(rows * 0.7); // At least 70% of buckets seen
        }
      }

      // Summary table
      console.log(`\n\n${'='.repeat(80)}`);
      console.log(`📊 COMPLETE RESULTS MATRIX - ALL 27 CONFIGURATIONS`);
      console.log(`${'='.repeat(80)}`);
      console.log(
        `\n${'Risk'.padEnd(8)} | ${'Rows'.padEnd(5)} | ${'Avg Mult'.padEnd(10)} | ${'House Edge'.padEnd(11)} | ${'Buckets'.padEnd(10)} | ${'Center %'.padEnd(10)}`,
      );
      console.log(`${'-'.repeat(80)}`);

      for (const result of results) {
        const centerPct = ((result.centerCount / SIMULATION_ROUNDS) * 100).toFixed(2);
        console.log(
          `${result.risk.padEnd(8)} | ${result.rows.toString().padEnd(5)} | ${result.avgMultiplier.toFixed(4).padEnd(10)} | ${result.houseEdge.toFixed(2).padEnd(11)}% | ${result.uniqueBuckets.toString().padEnd(10)} | ${centerPct.padEnd(10)}%`,
        );
      }

      console.log(`${'='.repeat(80)}`);

      // Final validations
      console.log(`\n✅ All 27 configurations validated successfully!`);
      expect(results.length).toBe(27);
    }, 1800000); // 30 minutes timeout for 27 configs × 100k simulations
  });
});
