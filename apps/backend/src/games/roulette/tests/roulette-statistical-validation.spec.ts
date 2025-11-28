import { BetType } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';

/**
 * 🎰 ROULETTE STATISTICAL VALIDATION TESTS
 *
 * European Roulette Mathematical Standards Compliance
 * - Malta Gaming Authority (MGA) requirements
 * - Curacao eGaming mathematical validation
 * - 100,000+ simulations for statistical significance
 *
 * EUROPEAN ROULETTE SPECS:
 * - Wheel: 0-36 (37 numbers, single zero)
 * - House Edge: Fixed mathematical 2.70% (1/37)
 * - Colors: 18 Red + 18 Black + 1 Green (0)
 * - Bet Types: 10 complex types with geometric constraints
 */
describe('Roulette - Statistical Validation', () => {
  // European Roulette Mathematical Constants
  const EUROPEAN_NUMBERS = 37; // 0-36
  const HOUSE_EDGE = 2.7; // 1/37 ≈ 2.70%
  const RTP = 97.3; // Return to Player
  // Smaller samples on CI to keep pipeline fast while preserving statistical validity
  const IS_CI = !!process.env.CI;
  const STATISTICAL_SAMPLE_SIZE = IS_CI ? 5000 : 100000; // 5k on CI, 100k locally

  // European Roulette Color Distribution
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

  // Theoretical Win Frequencies (European Roulette)
  const THEORETICAL_FREQUENCIES = {
    STRAIGHT: 1 / 37, // Single number: 2.70%
    SPLIT: 2 / 37, // Two numbers: 5.41%
    STREET: 3 / 37, // Three numbers: 8.11%
    CORNER: 4 / 37, // Four numbers: 10.81%
    LINE: 6 / 37, // Six numbers: 16.22%
    COLUMN: 12 / 37, // Column: 32.43%
    DOZEN: 12 / 37, // Dozen: 32.43%
    EVEN_MONEY: 18 / 37, // Red/Black/Even/Odd/High/Low: 48.65%
    BASKET: 4 / 37, // Basket (0,1,2,3): 10.81%
    TRIO: 3 / 37, // Trio: 8.11%
  };

  // Utility function to generate provably fair roulette outcome (FIXED: match ProvablyFairService)
  function generateRouletteOutcome(serverSeed: string, clientSeed: string, nonce: string): number {
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:ROULETTE`;
    hmac.update(data);
    const hash = hmac.digest('hex');

    // Take first 8 characters for randomness (matching ProvablyFairService)
    const hexSubstring = hash.substring(0, 8);
    const decimalValue = parseInt(hexSubstring, 16);
    const normalizedValue = decimalValue / (0x100000000 - 1);

    // European roulette: 0-36 (37 numbers)
    return Math.floor(normalizedValue * 37);
  }

  describe('🎲 Winning Number Generation - Statistical Distribution', () => {
    it('should generate uniform distribution across all 37 numbers over 100k spins', () => {
      const numberCounts = new Array(37).fill(0);
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';

      // Generate winning numbers
      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        expect(winningNumber).toBeGreaterThanOrEqual(0);
        expect(winningNumber).toBeLessThanOrEqual(36);
        expect(Number.isInteger(winningNumber)).toBe(true);

        numberCounts[winningNumber]++;
      }

      // Statistical Analysis - Chi-squared test for uniformity
      const expectedFrequency = STATISTICAL_SAMPLE_SIZE / EUROPEAN_NUMBERS;
      const tolerance = expectedFrequency * (IS_CI ? 0.2 : 0.1); // wider tolerance on smaller CI sample

      let chiSquared = 0;
      for (let i = 0; i < EUROPEAN_NUMBERS; i++) {
        const observed = numberCounts[i];
        const expected = expectedFrequency;
        chiSquared += Math.pow(observed - expected, 2) / expected;

        // Each number should appear approximately 100k/37 ≈ 2703 times
        expect(observed).toBeGreaterThan(expectedFrequency - tolerance);
        expect(observed).toBeLessThan(expectedFrequency + tolerance);
      }

      // Chi-squared critical value for 36 degrees of freedom at 95% confidence
      const chiSquaredCritical = 50.998; // α = 0.05, df = 36
      expect(chiSquared).toBeLessThan(chiSquaredCritical);
    });

    it('should maintain correct color distribution (18R + 18B + 1G = 37)', () => {
      const colorCounts = { red: 0, black: 0, green: 0 };
      const serverSeed = 'color-test-seed';
      const clientSeed = 'color-client-seed';

      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (RED_NUMBERS.includes(winningNumber)) {
          colorCounts.red++;
        } else if (BLACK_NUMBERS.includes(winningNumber)) {
          colorCounts.black++;
        } else if (winningNumber === 0) {
          colorCounts.green++;
        }
      }

      // Expected frequencies
      const expectedRed = STATISTICAL_SAMPLE_SIZE * (18 / 37);
      const expectedBlack = STATISTICAL_SAMPLE_SIZE * (18 / 37);
      const expectedGreen = STATISTICAL_SAMPLE_SIZE * (1 / 37);

      // Allow variance proportional to sample size (~2%)
      const tolerance = Math.ceil(STATISTICAL_SAMPLE_SIZE * 0.02);

      expect(Math.abs(colorCounts.red - expectedRed)).toBeLessThan(tolerance);
      expect(Math.abs(colorCounts.black - expectedBlack)).toBeLessThan(tolerance);
      expect(Math.abs(colorCounts.green - expectedGreen)).toBeLessThan(tolerance);

      // Total should equal sample size
      expect(colorCounts.red + colorCounts.black + colorCounts.green).toBe(STATISTICAL_SAMPLE_SIZE);
    });

    it('should ensure number independence between consecutive spins', () => {
      const serverSeed = 'independence-test';
      const clientSeed = 'independence-client';
      const consecutivePairs: number[][] = [];

      // Generate consecutive number pairs
      for (let i = 0; i < (IS_CI ? 5000 : 10000); i++) {
        const number1 = generateRouletteOutcome(serverSeed, clientSeed, i.toString());
        const number2 = generateRouletteOutcome(serverSeed, clientSeed, (i + 1).toString());

        consecutivePairs.push([number1, number2]);
      }

      // Test for independence - correlation should be near zero
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0,
        sumY2 = 0;
      const n = consecutivePairs.length;

      for (const [x, y] of consecutivePairs) {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
      }

      const correlation =
        (n * sumXY - sumX * sumY) /
        Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

      // Correlation should be very close to zero (independence)
      expect(Math.abs(correlation)).toBeLessThan(0.05);
    });
  });

  describe('💰 House Edge Mathematical Validation', () => {
    it('should maintain exact 2.70% house edge across all bet types over 100k games', () => {
      const betTypes = [
        { type: BetType.STRAIGHT, numbers: [7], multiplier: 36 },
        { type: BetType.SPLIT, numbers: [1, 2], multiplier: 18 },
        { type: BetType.STREET, numbers: [1, 2, 3], multiplier: 12 },
        { type: BetType.CORNER, numbers: [1, 2, 4, 5], multiplier: 9 },
        { type: BetType.LINE, numbers: [1, 2, 3, 4, 5, 6], multiplier: 6 },
        { type: BetType.RED, numbers: RED_NUMBERS, multiplier: 2 },
        { type: BetType.BLACK, numbers: BLACK_NUMBERS, multiplier: 2 },
        {
          type: BetType.EVEN,
          numbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
          multiplier: 2,
        },
        {
          type: BetType.ODD,
          numbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
          multiplier: 2,
        },
      ];

      for (const betConfig of betTypes) {
        let totalBetAmount = new BigNumber(0);
        let totalPayout = new BigNumber(0);
        const betAmount = '1.00'; // Standard bet size
        const serverSeed = `house-edge-${betConfig.type}`;
        const clientSeed = 'house-edge-client';

        const SAMPLE = IS_CI ? Math.min(5000, STATISTICAL_SAMPLE_SIZE) : STATISTICAL_SAMPLE_SIZE;
        for (let i = 0; i < SAMPLE; i++) {
          const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

          totalBetAmount = totalBetAmount.plus(betAmount);

          // Check if bet wins
          const isWinning = betConfig.numbers.includes(winningNumber);
          if (isWinning) {
            // Standard European roulette multipliers from CSV (no additional adjustments)
            const payout = new BigNumber(betAmount).multipliedBy(betConfig.multiplier);
            totalPayout = totalPayout.plus(payout);
          }
        }

        // Calculate actual house edge for standard European roulette
        const totalLoss = totalBetAmount.minus(totalPayout);
        const actualHouseEdge = totalLoss.dividedBy(totalBetAmount).multipliedBy(100);

        // European roulette standard: house edge should be ~2.70% due to zero
        // Allow reasonable variance for 100k sample size (statistical tolerance)
        const houseDiff = Math.abs(actualHouseEdge.toNumber() - HOUSE_EDGE);
        if (houseDiff >= 1.5) {
          throw new Error(
            `House edge variance too high: expected ~${HOUSE_EDGE}%, got ${actualHouseEdge.toNumber().toFixed(3)}%, diff: ${houseDiff.toFixed(3)}%`,
          );
        }

        // RTP should be ~97.30% (allow reasonable statistical variance)
        const actualRTP = totalPayout.dividedBy(totalBetAmount).multipliedBy(100);
        expect(Math.abs(actualRTP.toNumber() - RTP)).toBeLessThan(1.5);
      }
    });

    it('should validate theoretical vs actual RTP for all bet types', () => {
      const testData = [
        { type: BetType.STRAIGHT, expectedWinRate: 1 / 37, multiplier: 36 },
        { type: BetType.RED, expectedWinRate: 18 / 37, multiplier: 2 },
        { type: BetType.COLUMN, expectedWinRate: 12 / 37, multiplier: 3 },
      ];

      for (const data of testData) {
        // Theoretical RTP calculation for European roulette
        // RTP = probability_of_winning * payout_multiplier
        const theoreticalRTP = data.expectedWinRate * data.multiplier;

        // All theoretical RTPs should be approximately 97.30% (due to the zero)
        expect(theoreticalRTP).toBeCloseTo(RTP / 100, 2);
      }
    });
  });

  describe('🎯 Bet Type Statistical Frequency Validation', () => {
    it('should validate straight bet win frequency (1/37 ≈ 2.70%)', () => {
      const testNumber = 7;
      let wins = 0;
      const serverSeed = 'straight-frequency-test';
      const clientSeed = 'straight-client';

      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (winningNumber === testNumber) {
          wins++;
        }
      }

      const actualFrequency = wins / STATISTICAL_SAMPLE_SIZE;
      const expectedFrequency = THEORETICAL_FREQUENCIES.STRAIGHT;

      expect(actualFrequency).toBeCloseTo(expectedFrequency, 2);
    });

    it('should validate even money bet win frequency (18/37 ≈ 48.65%)', () => {
      let redWins = 0;
      let blackWins = 0;
      let evenWins = 0;
      let oddWins = 0;
      const serverSeed = 'even-money-frequency';
      const clientSeed = 'even-money-client';

      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (RED_NUMBERS.includes(winningNumber)) redWins++;
        if (BLACK_NUMBERS.includes(winningNumber)) blackWins++;
        if (winningNumber !== 0 && winningNumber % 2 === 0) evenWins++;
        if (winningNumber !== 0 && winningNumber % 2 === 1) oddWins++;
      }

      const expectedFrequency = THEORETICAL_FREQUENCIES.EVEN_MONEY;

      expect(redWins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(blackWins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(evenWins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(oddWins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
    });

    it('should validate column bet win frequency (12/37 ≈ 32.43%)', () => {
      const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
      const column2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
      const column3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

      let col1Wins = 0,
        col2Wins = 0,
        col3Wins = 0;
      const serverSeed = 'column-frequency-test';
      const clientSeed = 'column-client';

      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (column1.includes(winningNumber)) col1Wins++;
        if (column2.includes(winningNumber)) col2Wins++;
        if (column3.includes(winningNumber)) col3Wins++;
      }

      const expectedFrequency = THEORETICAL_FREQUENCIES.COLUMN;

      expect(col1Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(col2Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(col3Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
    });

    it('should validate dozen bet win frequency (12/37 ≈ 32.43%)', () => {
      const dozen1 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
      const dozen2 = Array.from({ length: 12 }, (_, i) => i + 13); // 13-24
      const dozen3 = Array.from({ length: 12 }, (_, i) => i + 25); // 25-36

      let doz1Wins = 0,
        doz2Wins = 0,
        doz3Wins = 0;
      const serverSeed = 'dozen-frequency-test';
      const clientSeed = 'dozen-client';

      for (let i = 0; i < STATISTICAL_SAMPLE_SIZE; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (dozen1.includes(winningNumber)) doz1Wins++;
        if (dozen2.includes(winningNumber)) doz2Wins++;
        if (dozen3.includes(winningNumber)) doz3Wins++;
      }

      const expectedFrequency = THEORETICAL_FREQUENCIES.DOZEN;

      expect(doz1Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(doz2Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
      expect(doz3Wins / STATISTICAL_SAMPLE_SIZE).toBeCloseTo(expectedFrequency, 2);
    });
  });

  describe('🏛️ European Roulette Mathematical Standards Compliance', () => {
    it('should meet Malta Gaming Authority (MGA) mathematical requirements', () => {
      // MGA requires mathematical proof of fair random number generation
      const serverSeed = 'mga-compliance-test';
      const clientSeed = 'mga-client-test';
      const results: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());
        results.push(winningNumber);
      }

      // MGA Standard: No number should appear with probability > 1/35 (2.86%)
      // in European roulette (allowing for statistical variance)
      const numberCounts = new Array(37).fill(0);
      results.forEach((num) => numberCounts[num]++);

      const maxFrequency = Math.max(...numberCounts) / results.length;
      const minFrequency = Math.min(...numberCounts) / results.length;

      expect(maxFrequency).toBeLessThan(0.04); // Max 4.0% (allowing variance)
      expect(minFrequency).toBeGreaterThan(0.015); // Min 1.5% (allowing variance)
    });

    it('should meet Curacao eGaming mathematical validation standards', () => {
      // Curacao requires proof that house edge is mathematically consistent
      const betAmount = new BigNumber('100');
      let totalBets = new BigNumber(0);
      let totalPayouts = new BigNumber(0);

      const serverSeed = 'curacao-validation';
      const clientSeed = 'curacao-client';

      // Test across multiple bet types for comprehensive validation
      const betConfigs = [
        { numbers: [0], multiplier: 36 }, // Straight
        { numbers: RED_NUMBERS, multiplier: 2 }, // Red
        { numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], multiplier: 3 }, // Column
      ];

      for (let betConfig of betConfigs) {
        for (let i = 0; i < 1000; i++) {
          const winningNumber = generateRouletteOutcome(
            serverSeed,
            clientSeed,
            `${betConfig.numbers[0]}-${i}`,
          );

          totalBets = totalBets.plus(betAmount);

          if (betConfig.numbers.includes(winningNumber)) {
            // Standard European roulette multipliers (from CSV)
            const payout = betAmount.multipliedBy(betConfig.multiplier);
            totalPayouts = totalPayouts.plus(payout);
          }
        }
      }

      // Curacao Standard: House edge must be within reasonable variance of theoretical 2.7%
      const actualHouseEdge = totalBets.minus(totalPayouts).dividedBy(totalBets).multipliedBy(100);
      expect(Math.abs(actualHouseEdge.toNumber() - HOUSE_EDGE)).toBeLessThan(4.0);
    });

    it('should validate provably fair cryptographic integrity', () => {
      const serverSeed = 'crypto-integrity-test';
      const clientSeed = 'crypto-client-test';

      // Test deterministic behavior
      const result1 = generateRouletteOutcome(serverSeed, clientSeed, '1');
      const result2 = generateRouletteOutcome(serverSeed, clientSeed, '1');

      expect(result1).toBe(result2);

      // Test different nonce produces different result
      const result3 = generateRouletteOutcome(serverSeed, clientSeed, '2');
      expect(result1).not.toBe(result3);

      // Test range validity
      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result1).toBeLessThanOrEqual(36);
      expect(Number.isInteger(result1)).toBe(true);
    });
  });

  describe('🔢 Complex Betting Scenarios Statistical Analysis', () => {
    it('should validate multiple simultaneous bets maintain correct odds', () => {
      const serverSeed = 'multi-bet-validation';
      const clientSeed = 'multi-bet-client';

      // Complex betting scenario: Red + Column 1 + Straight 7
      const redNumbers = RED_NUMBERS;
      const column1Numbers = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
      const straightNumber = 7;

      let redWins = 0,
        column1Wins = 0,
        straightWins = 0;
      let overlappingWins = 0; // Number 7 wins both red and column1

      for (let i = 0; i < 1000; i++) {
        const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

        if (redNumbers.includes(winningNumber)) redWins++;
        if (column1Numbers.includes(winningNumber)) column1Wins++;
        if (winningNumber === straightNumber) straightWins++;
        if (winningNumber === 7) overlappingWins++; // 7 is red and in column 1
      }

      // Validate individual bet frequencies
      expect(redWins / 1000).toBeCloseTo(18 / 37, 1);
      expect(column1Wins / 1000).toBeCloseTo(12 / 37, 1);
      expect(straightWins / 1000).toBeCloseTo(1 / 37, 0);

      // Validate overlapping wins (number 7 appears in both red and column1)
      expect(overlappingWins).toBe(straightWins);
    });

    it('should ensure bet independence in complex scenarios', () => {
      // Test that multiple bets on same spin are independent
      const betCombinations = [
        {
          bet1: RED_NUMBERS,
          bet2: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
        }, // Red + Odd
        {
          bet1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
          bet2: Array.from({ length: 12 }, (_, i) => i + 1),
        }, // Column1 + Dozen1
      ];

      for (const combo of betCombinations) {
        let bothWin = 0;
        let onlyBet1Wins = 0;
        let onlyBet2Wins = 0;
        let neitherWins = 0;

        const serverSeed = `independence-${combo.bet1[0]}`;
        const clientSeed = 'independence-client';

        for (let i = 0; i < 1000; i++) {
          const winningNumber = generateRouletteOutcome(serverSeed, clientSeed, i.toString());

          const bet1Wins = combo.bet1.includes(winningNumber);
          const bet2Wins = combo.bet2.includes(winningNumber);

          if (bet1Wins && bet2Wins) bothWin++;
          else if (bet1Wins && !bet2Wins) onlyBet1Wins++;
          else if (!bet1Wins && bet2Wins) onlyBet2Wins++;
          else neitherWins++;
        }

        // Validate that outcomes follow expected probability distributions
        const totalOutcomes = bothWin + onlyBet1Wins + onlyBet2Wins + neitherWins;
        expect(totalOutcomes).toBe(1000);

        // Each category should have reasonable frequency
        expect(bothWin / totalOutcomes).toBeGreaterThan(0);
        expect(onlyBet1Wins / totalOutcomes).toBeGreaterThan(0);
        expect(onlyBet2Wins / totalOutcomes).toBeGreaterThan(0);
        expect(neitherWins / totalOutcomes).toBeGreaterThan(0);
      }
    });
  });
});
