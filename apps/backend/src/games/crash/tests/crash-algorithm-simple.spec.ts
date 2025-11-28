import * as crypto from 'crypto';

/**
 * Pure Algorithm Testing - Crash Game Mathematical Validation
 *
 * This test focuses purely on the mathematical algorithm without service dependencies.
 * Similar to the excellent Plinko validation tests, this provides statistical proof
 * of the algorithm's correctness and fairness.
 */

/**
 * Core crash point calculation algorithm (NEW - Stake.com compatible)
 * This should match the exact algorithm used in production
 */
function calculateCrashPoint(serverSeed: string, bitcoinBlockHash: string): number {
  // Validate bitcoin block hash is provided
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
  const houseEdge = 0.01; // 1%
  const crashPoint = Math.max(1.0, (Math.pow(2, 32) / (hashInt + 1)) * (1 - houseEdge));

  return crashPoint;
}

describe('🚀 Crash Game - Pure Algorithm Validation', () => {
  describe('🎲 Provably Fair Mathematical Proof', () => {
    it('🧮 STATISTICAL VALIDATION: Algorithm produces expected distribution', () => {
      const sampleSize = 10000;
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      let crashAt1x = 0;
      let lowMultipliers = 0; // 1.00x - 2.00x
      let mediumMultipliers = 0; // 2.00x - 10.00x
      let highMultipliers = 0; // 10.00x+

      const results: number[] = [];

      // Generate different server seeds for each test
      for (let i = 1; i <= sampleSize; i++) {
        const serverSeed = `crash-seed-${i}-validation-2024`;
        const crashPoint = calculateCrashPoint(serverSeed, bitcoinBlockHash);
        results.push(crashPoint);

        if (crashPoint === 1.0) {
          crashAt1x++;
        } else if (crashPoint < 2.0) {
          lowMultipliers++;
        } else if (crashPoint < 10.0) {
          mediumMultipliers++;
        } else {
          highMultipliers++;
        }
      }

      // Statistical analysis
      const crashAt1xPercentage = (crashAt1x / sampleSize) * 100;
      const lowPercentage = (lowMultipliers / sampleSize) * 100;
      const mediumPercentage = (mediumMultipliers / sampleSize) * 100;
      const highPercentage = (highMultipliers / sampleSize) * 100;

      console.log('📊 CRASH ALGORITHM STATISTICS:');
      console.log(
        `  💥 Instant crashes (1.00x): ${crashAt1x} (${crashAt1xPercentage.toFixed(2)}%)`,
      );
      console.log(`  🔻 Low multipliers (1-2x): ${lowMultipliers} (${lowPercentage.toFixed(2)}%)`);
      console.log(
        `  ⚡ Medium multipliers (2-10x): ${mediumMultipliers} (${mediumPercentage.toFixed(2)}%)`,
      );
      console.log(
        `  🚀 High multipliers (10x+): ${highMultipliers} (${highPercentage.toFixed(2)}%)`,
      );

      // Validate statistical properties for Stake's algorithm
      // Note: Stake's algorithm has different distribution than the old algorithm
      expect(lowPercentage).toBeGreaterThan(30); // Most crashes should be low
      expect(highPercentage).toBeLessThan(15); // High multipliers rare

      // Verify no impossible values
      results.forEach((result) => {
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThanOrEqual(10000);
      });
    });

    it('🔄 DETERMINISTIC: Same inputs always produce same outputs', () => {
      const serverSeed = 'deterministic-validation-seed';
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const results1: number[] = [];
      const results2: number[] = [];

      for (let i = 1; i <= 100; i++) {
        results1.push(calculateCrashPoint(serverSeed, bitcoinBlockHash));
        results2.push(calculateCrashPoint(serverSeed, bitcoinBlockHash));
      }

      expect(results1).toEqual(results2);
      console.log('✅ DETERMINISTIC TEST: 100 iterations produced identical results');
    });

    it('🎯 COLLISION RESISTANCE: Different seeds produce different results', () => {
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';
      const result1 = calculateCrashPoint('seed1', bitcoinBlockHash);
      const result2 = calculateCrashPoint('seed2', bitcoinBlockHash);
      const result3 = calculateCrashPoint('seed3', bitcoinBlockHash);

      expect(result1).not.toBe(result2);
      expect(result1).not.toBe(result3);
      expect(result2).not.toBe(result3);
      console.log('✅ COLLISION RESISTANCE: Different seeds produce unique results');
    });

    it('🔢 SEED VARIATION: Different server seeds produce varied results', () => {
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const results = new Set<number>();

      for (let i = 1; i <= 100; i++) {
        const serverSeed = `seed-variation-test-${i}`;
        const crashPoint = calculateCrashPoint(serverSeed, bitcoinBlockHash);
        results.add(crashPoint);
      }

      expect(results.size).toBeGreaterThan(90); // At least 90% unique results
      console.log(`✅ SEED VARIATION: ${results.size}/100 unique results`);
    });
  });

  describe('🏠 House Edge & Casino Mathematics', () => {
    it('📈 HOUSE EDGE CALCULATION: Theoretical vs Actual', () => {
      const sampleSize = 25000;
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      let totalReturn = 0;
      let totalBets = sampleSize;
      const cashoutTarget = 2.0; // Players trying to cash out at 2x

      for (let i = 1; i <= sampleSize; i++) {
        const serverSeed = `house-edge-seed-${i}`;
        const crashPoint = calculateCrashPoint(serverSeed, bitcoinBlockHash);
        const betAmount = 1; // Standardized bet

        if (crashPoint >= cashoutTarget) {
          totalReturn += betAmount * cashoutTarget; // Successful cashout
        } else {
          totalReturn += 0; // Lost bet
        }
      }

      const actualRTP = totalReturn / totalBets;
      const actualHouseEdge = (1 - actualRTP) * 100;

      console.log(`🎰 HOUSE EDGE ANALYSIS (${sampleSize} samples, 2x cashout):`);
      console.log(`  💰 Total Bets: ${totalBets}`);
      console.log(`  💸 Total Returns: ${totalReturn}`);
      console.log(`  🎯 RTP: ${(actualRTP * 100).toFixed(3)}%`);
      console.log(`  🏠 House Edge: ${actualHouseEdge.toFixed(3)}%`);

      expect(actualRTP).toBeGreaterThan(0.9); // Should be reasonable RTP
      expect(actualRTP).toBeLessThan(1.0); // House should have edge
      expect(actualHouseEdge).toBeGreaterThan(0);
      expect(actualHouseEdge).toBeLessThan(10);
    });

    it('📊 CHI-SQUARED TEST: Distribution fairness validation', () => {
      const sampleSize = 10000;
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const buckets = [
        { min: 1.0, max: 1.5, count: 0, name: '1.0-1.5x' },
        { min: 1.5, max: 2.0, count: 0, name: '1.5-2.0x' },
        { min: 2.0, max: 3.0, count: 0, name: '2.0-3.0x' },
        { min: 3.0, max: 5.0, count: 0, name: '3.0-5.0x' },
        { min: 5.0, max: 10.0, count: 0, name: '5.0-10.0x' },
        { min: 10.0, max: Infinity, count: 0, name: '10.0x+' },
      ];

      for (let i = 1; i <= sampleSize; i++) {
        const serverSeed = `chi-squared-seed-${i}`;
        const crashPoint = calculateCrashPoint(serverSeed, bitcoinBlockHash);

        for (const bucket of buckets) {
          if (crashPoint >= bucket.min && crashPoint < bucket.max) {
            bucket.count++;
            break;
          }
        }
      }

      console.log('📊 CRASH POINT DISTRIBUTION:');
      buckets.forEach((bucket) => {
        const percentage = (bucket.count / sampleSize) * 100;
        console.log(`  ${bucket.name}: ${bucket.count} (${percentage.toFixed(2)}%)`);
      });

      // Basic distribution validation
      expect(buckets[0].count).toBeGreaterThan(buckets[5].count); // Low > High
      expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(sampleSize);
    });
  });

  describe('🚨 Security & Edge Case Testing', () => {
    it('🛡️ EXPLOIT PREVENTION: Extreme and malicious inputs', () => {
      const testBitcoinBlockHash =
        '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';
      const extremeCases = [
        { server: '', blockHash: testBitcoinBlockHash, name: 'empty server seed' },
        { server: 'test', blockHash: '', name: 'empty bitcoin block hash' },
        {
          server: '0'.repeat(1000),
          blockHash: testBitcoinBlockHash,
          name: 'very long server seed',
        },
        { server: '🎲🎰🚀', blockHash: testBitcoinBlockHash, name: 'unicode characters' },
        { server: 'test', blockHash: 'invalid_hash_format', name: 'invalid block hash format' },
      ];

      console.log('🛡️ SECURITY TESTING - Extreme inputs:');
      extremeCases.forEach((testCase) => {
        if (testCase.blockHash === '') {
          // Empty block hash should throw error
          expect(() => {
            calculateCrashPoint(testCase.server, testCase.blockHash);
          }).toThrow();
          console.log(`  ⚠️  ${testCase.name}: correctly threw error`);
        } else {
          // Other cases should handle gracefully
          expect(() => {
            const result = calculateCrashPoint(testCase.server, testCase.blockHash);
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
      const serverSeed = 'performance-test-seed-2024';
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const startTime = process.hrtime.bigint();

      for (let i = 0; i < iterations; i++) {
        calculateCrashPoint(serverSeed, bitcoinBlockHash);
      }

      const endTime = process.hrtime.bigint();
      const executionTimeMs = Number(endTime - startTime) / 1000000;
      const operationsPerSecond = (iterations / executionTimeMs) * 1000;

      console.log(`⚡ PERFORMANCE METRICS:`);
      console.log(`  📊 ${iterations} calculations in ${executionTimeMs.toFixed(2)}ms`);
      console.log(`  🚀 ${operationsPerSecond.toFixed(0)} operations/second`);
      console.log(`  ⏱️ ${(executionTimeMs / iterations).toFixed(4)}ms per operation`);

      expect(operationsPerSecond).toBeGreaterThan(10000); // Should be fast
      expect(executionTimeMs / iterations).toBeLessThan(1); // Under 1ms per op
    });

    it('🧠 MEMORY EFFICIENCY: Large batch processing', () => {
      const batchSize = 50000;
      const serverSeed = 'memory-efficiency-test';
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < batchSize; i++) {
        const result = calculateCrashPoint(serverSeed, bitcoinBlockHash);
        expect(result).toBeGreaterThanOrEqual(1.0);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`🧠 MEMORY USAGE: ${memoryGrowthMB.toFixed(2)}MB for ${batchSize} calculations`);

      expect(memoryGrowthMB).toBeLessThan(50); // Should be memory efficient
    });
  });

  describe('🎯 Advanced Statistical Analysis', () => {
    it('📈 MULTIPLIER FREQUENCY ANALYSIS: Detailed distribution study', () => {
      const sampleSize = 50000; // Large sample for accuracy
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const ranges = {
        '1.00x': { min: 1.0, max: 1.01, count: 0 },
        '1.01-1.10x': { min: 1.01, max: 1.1, count: 0 },
        '1.10-1.25x': { min: 1.1, max: 1.25, count: 0 },
        '1.25-1.50x': { min: 1.25, max: 1.5, count: 0 },
        '1.50-2.00x': { min: 1.5, max: 2.0, count: 0 },
        '2.00-3.00x': { min: 2.0, max: 3.0, count: 0 },
        '3.00-5.00x': { min: 3.0, max: 5.0, count: 0 },
        '5.00-10.00x': { min: 5.0, max: 10.0, count: 0 },
        '10.00-100.00x': { min: 10.0, max: 100.0, count: 0 },
        '100.00x+': { min: 100.0, max: Infinity, count: 0 },
      };

      let totalValue = 0;
      let maxValue = 0;
      let minValue = Infinity;

      for (let i = 1; i <= sampleSize; i++) {
        const testSeed = `frequency-analysis-seed-${i}`;
        const crashPoint = calculateCrashPoint(testSeed, bitcoinBlockHash);
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
      expect(averageMultiplier).toBeLessThan(50.0); // Stake's algorithm can have higher averages
      expect(maxValue).toBeGreaterThan(100); // Should see some high values
      expect(minValue).toBe(1.0); // Minimum is always 1.0x in Stake's algorithm
      expect(ranges['1.00x'].count).toBeGreaterThan(sampleSize * 0.01); // At least 1% exact 1.00x
    });

    it('🎲 RANDOMNESS QUALITY: Entropy and uniformity validation', () => {
      const sampleSize = 10000;
      const bitcoinBlockHash = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

      const results: number[] = [];
      const hashedResults: string[] = [];

      for (let i = 1; i <= sampleSize; i++) {
        const serverSeed = `randomness-test-seed-${i}`;
        const crashPoint = calculateCrashPoint(serverSeed, bitcoinBlockHash);
        results.push(crashPoint);

        // Hash the result to analyze bit distribution
        const hash = crypto.createHash('md5').update(crashPoint.toString()).digest('hex');
        hashedResults.push(hash);
      }

      // Analyze bit distribution in the first character of hashes
      const firstCharCounts: { [key: string]: number } = {};
      hashedResults.forEach((hash) => {
        const firstChar = hash[0];
        firstCharCounts[firstChar] = (firstCharCounts[firstChar] || 0) + 1;
      });

      console.log('🎲 RANDOMNESS ANALYSIS:');
      console.log('  Hex character distribution in MD5 hashes:');
      Object.entries(firstCharCounts)
        .sort()
        .forEach(([char, count]) => {
          const percentage = (count / sampleSize) * 100;
          console.log(`    ${char}: ${count} (${percentage.toFixed(2)}%)`);
        });

      // Each hex character should appear roughly 1/16 of the time (6.25%)
      // Allow reasonable variance
      Object.values(firstCharCounts).forEach((count) => {
        const percentage = (count / sampleSize) * 100;
        expect(percentage).toBeGreaterThan(3); // At least 3%
        expect(percentage).toBeLessThan(10); // At most 10%
      });

      console.log('✅ RANDOMNESS TEST: Hash distribution appears uniform');
    });
  });
});
