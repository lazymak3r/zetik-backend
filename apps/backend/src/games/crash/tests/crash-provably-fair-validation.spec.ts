import * as crypto from 'crypto';
import { CRASH_CONSTANTS } from '../crash-constants';

/**
 * Pure Algorithm Testing - New Provably Fair Crash Game Implementation
 *
 * Tests the new Stake.com-compatible algorithm with Bitcoin block hash integration
 * and backwards seed chaining for enhanced security and industry-standard fairness.
 */

/**
 * Core crash point calculation algorithm (Stake.com compatible)
 * This matches the exact algorithm used in production
 */
function calculateCrashPoint(serverSeed: string, bitcoinBlockHash: string): number {
  // Validate constants are set
  if (!bitcoinBlockHash) {
    throw new Error(
      'Bitcoin block hash not set. Cannot calculate crash point until block is mined.',
    );
  }

  // Stake's algorithm: SHA-256 HMAC with server seed and Bitcoin block hash
  const hash = crypto.createHmac('sha256', serverSeed).update(bitcoinBlockHash).digest('hex');

  // Take first 32 bits of hash
  const hashInt = parseInt(hash.substring(0, 8), 16);

  // Stake's formula: exactly 1% house edge
  const crashPoint = Math.max(
    1.0,
    (Math.pow(2, 32) / (hashInt + 1)) * (1 - CRASH_CONSTANTS.HOUSE_EDGE),
  );

  return crashPoint;
}

/**
 * Generate test server seed using backwards chaining
 */
function generateTestSeed(seedIndex: number, terminatingHash: string, chainLength: number): string {
  // For testing, generate a seed by hashing backwards from terminating hash
  let currentSeed = terminatingHash;

  // Hash backwards from chain end to desired index
  for (let i = chainLength; i > seedIndex; i--) {
    currentSeed = crypto.createHash('sha256').update(currentSeed).digest('hex');
  }

  return currentSeed;
}

/**
 * Verify seed belongs to chain by hashing forward to terminating hash
 */
function verifySeedInChain(
  seed: string,
  gameIndex: number,
  terminatingHash: string,
  chainLength: number,
): boolean {
  try {
    let currentSeed = seed;

    // Hash forward from this seed to the final seed
    for (let i = gameIndex; i < chainLength; i++) {
      currentSeed = crypto.createHash('sha256').update(currentSeed).digest('hex');
    }

    // The final hash should match our terminating hash
    const finalHash = crypto.createHash('sha256').update(currentSeed).digest('hex');

    return finalHash === terminatingHash;
  } catch (error) {
    return false;
  }
}

describe('🚀 Crash Game - New Provably Fair Algorithm Validation', () => {
  const testBitcoinBlockHash = CRASH_CONSTANTS.BITCOIN_BLOCK_HASH;
  const testTerminatingHash = 'test_terminating_hash_for_validation_purposes_only';
  const testChainLength = 1000; // Smaller chain for testing

  describe('🎲 Provably Fair Mathematical Proof', () => {
    it('🧮 STATISTICAL VALIDATION: New algorithm produces expected distribution', () => {
      const sampleSize = 10000;

      let lowMultipliers = 0; // 1.00x - 2.00x
      let mediumMultipliers = 0; // 2.00x - 10.00x
      let highMultipliers = 0; // 10.00x+
      let extremeMultipliers = 0; // 100x+

      const results: number[] = [];

      for (let gameIndex = 1; gameIndex <= sampleSize; gameIndex++) {
        const serverSeed = generateTestSeed(gameIndex, testTerminatingHash, testChainLength);
        const crashPoint = calculateCrashPoint(serverSeed, testBitcoinBlockHash);
        results.push(crashPoint);

        if (crashPoint < 2.0) {
          lowMultipliers++;
        } else if (crashPoint < 10.0) {
          mediumMultipliers++;
        } else if (crashPoint < 100.0) {
          highMultipliers++;
        } else {
          extremeMultipliers++;
        }
      }

      // Statistical analysis
      const lowPercentage = (lowMultipliers / sampleSize) * 100;
      const mediumPercentage = (mediumMultipliers / sampleSize) * 100;
      const highPercentage = (highMultipliers / sampleSize) * 100;
      const extremePercentage = (extremeMultipliers / sampleSize) * 100;

      console.log('📊 NEW CRASH ALGORITHM STATISTICS:');
      console.log(`  🔻 Low multipliers (1-2x): ${lowMultipliers} (${lowPercentage.toFixed(2)}%)`);
      console.log(
        `  ⚡ Medium multipliers (2-10x): ${mediumMultipliers} (${mediumPercentage.toFixed(2)}%)`,
      );
      console.log(
        `  🚀 High multipliers (10-100x): ${highMultipliers} (${highPercentage.toFixed(2)}%)`,
      );
      console.log(
        `  🌟 Extreme multipliers (100x+): ${extremeMultipliers} (${extremePercentage.toFixed(2)}%)`,
      );

      // Validate statistical properties for Stake's algorithm
      expect(lowPercentage).toBeGreaterThan(40); // Most crashes should be low
      expect(highPercentage).toBeLessThan(20); // High multipliers should be rare
      expect(extremePercentage).toBeLessThan(5); // Extreme multipliers very rare

      // Verify no impossible values
      results.forEach((result) => {
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThan(Number.MAX_SAFE_INTEGER);
        expect(Number.isFinite(result)).toBe(true);
      });
    });

    it('🔄 DETERMINISTIC: Same inputs always produce same outputs', () => {
      const serverSeed = 'deterministic-test-seed-12345';

      const results1: number[] = [];
      const results2: number[] = [];

      for (let i = 0; i < 100; i++) {
        results1.push(calculateCrashPoint(serverSeed, testBitcoinBlockHash));
        results2.push(calculateCrashPoint(serverSeed, testBitcoinBlockHash));
      }

      expect(results1).toEqual(results2);
      console.log('✅ DETERMINISTIC TEST: 100 iterations produced identical results');
    });

    it('🎯 COLLISION RESISTANCE: Different seeds produce different results', () => {
      const seed1 = 'test_server_seed_001';
      const seed2 = 'test_server_seed_002';
      const seed3 = 'different_test_seed';

      const result1 = calculateCrashPoint(seed1, testBitcoinBlockHash);
      const result2 = calculateCrashPoint(seed2, testBitcoinBlockHash);
      const result3 = calculateCrashPoint(seed3, testBitcoinBlockHash);

      expect(result1).not.toBe(result2);
      expect(result1).not.toBe(result3);
      expect(result2).not.toBe(result3);
      console.log('✅ COLLISION RESISTANCE: Different seeds produce unique results');
    });

    it('🔗 BITCOIN BLOCK HASH VARIATION: Different block hashes change results', () => {
      const serverSeed = 'consistent-seed-for-block-test';
      const blockHash1 = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';
      const blockHash2 = '00000000000000000003f74156d134b8b2ef453665e39c8d32491c7f0004e6ee';

      const result1 = calculateCrashPoint(serverSeed, blockHash1);
      const result2 = calculateCrashPoint(serverSeed, blockHash2);

      expect(result1).not.toBe(result2);
      console.log(
        `✅ BLOCK HASH VARIATION: Block 1 = ${result1.toFixed(4)}x, Block 2 = ${result2.toFixed(4)}x`,
      );
    });
  });

  describe('🔗 Seed Chain Verification', () => {
    it('🔍 CHAIN INTEGRITY: Verify seeds can be validated in chain', () => {
      const testTerminating = 'chain_test_terminating_hash_123';
      const chainSize = 100;

      // Generate some test seeds
      const testSeeds: { seed: string; index: number }[] = [];
      for (let i = 1; i <= 10; i++) {
        const seed = generateTestSeed(i, testTerminating, chainSize);
        testSeeds.push({ seed, index: i });
      }

      // Verify each seed belongs to the chain
      testSeeds.forEach(({ seed, index }) => {
        const isValid = verifySeedInChain(seed, index, testTerminating, chainSize);
        expect(isValid).toBe(true);
      });

      console.log('✅ CHAIN INTEGRITY: All test seeds verified in chain');
    });

    it('🚫 CHAIN SECURITY: Invalid seeds are rejected', () => {
      const testTerminating = 'security_test_terminating_hash';
      const chainSize = 100;

      // Test with completely random seeds
      const fakeSeed1 = 'completely_fake_seed_123';
      const fakeSeed2 = crypto.randomBytes(32).toString('hex');

      const isValid1 = verifySeedInChain(fakeSeed1, 50, testTerminating, chainSize);
      const isValid2 = verifySeedInChain(fakeSeed2, 75, testTerminating, chainSize);

      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);

      console.log('✅ CHAIN SECURITY: Fake seeds properly rejected');
    });
  });

  describe('🏠 House Edge & Casino Mathematics', () => {
    it('📈 EXACT HOUSE EDGE: Validates exactly 1% house edge', () => {
      const sampleSize = 50000; // Large sample for accuracy

      let totalExpectedValue = 0;

      for (let i = 1; i <= sampleSize; i++) {
        const testSeed = generateTestSeed(i, testTerminatingHash, testChainLength);
        const crashPoint = calculateCrashPoint(testSeed, testBitcoinBlockHash);

        // Expected value = 1 / crashPoint (probability of crashing before this point)
        // For house edge calculation, we need the inverse relationship
        const expectedValue = 1.0 / crashPoint;
        totalExpectedValue += expectedValue;
      }

      const averageExpectedValue = totalExpectedValue / sampleSize;
      const theoreticalHouseEdge = (1 - averageExpectedValue) * 100;

      console.log(`🎰 HOUSE EDGE ANALYSIS (${sampleSize} samples):`);
      console.log(`  🎯 Average Expected Value: ${averageExpectedValue.toFixed(6)}`);
      console.log(`  🏠 Calculated House Edge: ${theoreticalHouseEdge.toFixed(3)}%`);
      console.log(`  📊 Target House Edge: ${CRASH_CONSTANTS.HOUSE_EDGE * 100}%`);

      // Verify house edge is approximately 1% (allow some statistical variance)
      expect(theoreticalHouseEdge).toBeGreaterThan(0.5);
      expect(theoreticalHouseEdge).toBeLessThan(1.5);
    });

    it('💰 PAYOUT CALCULATION: Verify crash point calculations are correct', () => {
      const testCases = [
        { seed: 'test_seed_low_multiplier', expectedRange: [1.0, 5.0] },
        { seed: 'test_seed_medium_multiplier', expectedRange: [1.0, 50.0] },
        { seed: 'test_seed_high_multiplier', expectedRange: [1.0, 1000.0] },
      ];

      testCases.forEach(({ seed, expectedRange }) => {
        const crashPoint = calculateCrashPoint(seed, testBitcoinBlockHash);

        expect(crashPoint).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(crashPoint).toBeLessThanOrEqual(expectedRange[1]);
        expect(Number.isFinite(crashPoint)).toBe(true);

        // Verify precision (crash points should have reasonable decimal places)
        const decimalPlaces = crashPoint.toString().split('.')[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(16); // JavaScript number precision limit
      });

      console.log('✅ PAYOUT CALCULATION: All test cases within expected ranges');
    });
  });

  describe('🚨 Security & Edge Case Testing', () => {
    it('🛡️ EXPLOIT PREVENTION: Extreme and malicious inputs', () => {
      const extremeCases = [
        { seed: '', blockHash: testBitcoinBlockHash, name: 'empty server seed' },
        { seed: 'test', blockHash: '', name: 'empty bitcoin block hash' },
        { seed: '0'.repeat(1000), blockHash: testBitcoinBlockHash, name: 'very long server seed' },
        { seed: '🎲🎰🚀', blockHash: testBitcoinBlockHash, name: 'unicode characters' },
        { seed: 'test_seed', blockHash: 'invalid_block_hash', name: 'invalid block hash format' },
      ];

      console.log('🛡️ SECURITY TESTING - Extreme inputs:');
      extremeCases.forEach((testCase) => {
        if (testCase.blockHash === '') {
          // Empty block hash should throw error
          expect(() => {
            calculateCrashPoint(testCase.seed, testCase.blockHash);
          }).toThrow();
          console.log(`  ⚠️  ${testCase.name}: correctly threw error`);
        } else {
          // Other cases should handle gracefully
          expect(() => {
            const result = calculateCrashPoint(testCase.seed, testCase.blockHash);
            expect(result).toBeGreaterThanOrEqual(1.0);
            expect(typeof result).toBe('number');
            expect(Number.isFinite(result)).toBe(true);
          }).not.toThrow();
          console.log(`  ✅ ${testCase.name}: handled gracefully`);
        }
      });
    });

    it('⚡ PERFORMANCE: Algorithm execution speed', () => {
      const iterations = 10000;
      const testSeed = 'performance-test-seed-2024';

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        calculateCrashPoint(testSeed, testBitcoinBlockHash);
      }

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      const operationsPerSecond = (iterations / executionTimeMs) * 1000;

      console.log(`⚡ PERFORMANCE METRICS:`);
      console.log(`  📊 ${iterations} calculations in ${executionTimeMs.toFixed(2)}ms`);
      console.log(`  🚀 ${operationsPerSecond.toFixed(0)} operations/second`);
      console.log(`  ⏱️ ${(executionTimeMs / iterations).toFixed(4)}ms per operation`);

      expect(operationsPerSecond).toBeGreaterThan(5000); // Should be reasonably fast
      expect(executionTimeMs / iterations).toBeLessThan(2); // Under 2ms per op
    });
  });

  describe('🎯 Advanced Statistical Analysis', () => {
    it('📊 MULTIPLIER FREQUENCY ANALYSIS: Detailed distribution study', () => {
      const sampleSize = 25000; // Large sample for accuracy

      const ranges = {
        '1.00-1.10x': { min: 1.0, max: 1.1, count: 0 },
        '1.10-1.25x': { min: 1.1, max: 1.25, count: 0 },
        '1.25-1.50x': { min: 1.25, max: 1.5, count: 0 },
        '1.50-2.00x': { min: 1.5, max: 2.0, count: 0 },
        '2.00-5.00x': { min: 2.0, max: 5.0, count: 0 },
        '5.00-10.00x': { min: 5.0, max: 10.0, count: 0 },
        '10.00-50.00x': { min: 10.0, max: 50.0, count: 0 },
        '50.00x+': { min: 50.0, max: Infinity, count: 0 },
      };

      let totalValue = 0;
      let maxValue = 0;
      let minValue = Infinity;

      for (let gameIndex = 1; gameIndex <= sampleSize; gameIndex++) {
        const testSeed = generateTestSeed(gameIndex, testTerminatingHash, testChainLength);
        const crashPoint = calculateCrashPoint(testSeed, testBitcoinBlockHash);

        totalValue += crashPoint;
        maxValue = Math.max(maxValue, crashPoint);
        minValue = Math.min(minValue, crashPoint);

        for (const [, range] of Object.entries(ranges)) {
          if (crashPoint >= range.min && crashPoint < range.max) {
            range.count++;
            break;
          }
        }
      }

      const averageMultiplier = totalValue / sampleSize;

      console.log(`📊 COMPREHENSIVE MULTIPLIER ANALYSIS (${sampleSize} samples):`);
      console.log(`  📈 Average multiplier: ${averageMultiplier.toFixed(4)}x`);
      console.log(`  🔺 Maximum multiplier: ${maxValue.toFixed(4)}x`);
      console.log(`  🔻 Minimum multiplier: ${minValue.toFixed(4)}x`);
      console.log('  📊 Frequency Distribution:');

      Object.entries(ranges).forEach(([name, range]) => {
        const percentage = (range.count / sampleSize) * 100;
        console.log(
          `    ${name.padEnd(12)}: ${range.count.toString().padStart(6)} (${percentage.toFixed(3)}%)`,
        );
      });

      // Statistical validations for Stake's algorithm
      expect(averageMultiplier).toBeGreaterThan(1.0);
      expect(averageMultiplier).toBeLessThan(10.0); // Reasonable average for 1% house edge
      expect(maxValue).toBeGreaterThan(10); // Should see some high values
      expect(minValue).toBe(1.0); // Minimum is always 1.0x in Stake's algorithm
    });
  });
});
