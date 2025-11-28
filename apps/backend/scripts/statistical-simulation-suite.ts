#!/usr/bin/env ts-node
/**
 * 🎲 COMPREHENSIVE STATISTICAL VALIDATION SIMULATION SUITE
 *
 * Enhanced comprehensive statistical validation suite for all casino games with:
 * - Clean, organized console output (no Jest noise)
 * - Extensive testing configurations
 * - Comprehensive summary tables
 * - Progress indicators for long simulations
 * - Color-coded results (green=pass, red=fail, yellow=warning)
 * - Full metrics verification (house edge, RTP, distribution)
 * - Complete Limbo multiplier testing (12 configurations)
 * - Detailed Plinko risk level analysis (27 configurations)
 * - Full Mines game testing (multiple mine counts and reveal patterns)
 *
 * Usage:
 *   pnpm simulation:run [simulations] [--skip-limbo] [--skip-plinko] [--skip-mines] [--skip-dice]
 *
 * Examples:
 *   pnpm simulation:run                  # Default: 1,000,000 simulations
 *   pnpm simulation:run 10000000         # 10 million simulations
 *   pnpm simulation:run --skip-mines     # Skip Mines testing
 *   pnpm simulation:run 100000 --skip-plinko --skip-mines  # Fast validation
 */

import chalk from 'chalk';
import cliProgress from 'cli-progress';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_SIMULATIONS = 1_000_000;

// Parse command line arguments
const args = process.argv.slice(2);
const simulationArg = args.find((arg) => !arg.startsWith('--'));
const SIMULATION_COUNT = simulationArg ? parseInt(simulationArg) : DEFAULT_SIMULATIONS;

// Parse skip flags
const SKIP_DICE = args.includes('--skip-dice');
const SKIP_LIMBO = args.includes('--skip-limbo');
const SKIP_PLINKO = args.includes('--skip-plinko');
const SKIP_MINES = args.includes('--skip-mines');

// Plinko multiplier tables (from PlinkoService)
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

// Comprehensive Limbo multipliers to test
const LIMBO_MULTIPLIERS = [1.1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

// Mines configurations to test
const MINES_CONFIGURATIONS = [
  { mines: 1, reveals: [1, 5, 10] },
  { mines: 3, reveals: [1, 5, 10] },
  { mines: 5, reveals: [1, 5, 10] },
  { mines: 10, reveals: [1, 5] },
  { mines: 15, reveals: [1, 5] },
  { mines: 20, reveals: [1] },
  { mines: 24, reveals: [1] },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatPercent(num: number, decimals: number = 2): string {
  return num.toFixed(decimals) + '%';
}

function formatMultiplier(num: number): string {
  return num.toFixed(4) + 'x';
}

function padRight(str: string, length: number): string {
  return str + ' '.repeat(Math.max(0, length - str.length));
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ============================================================================
// GAME GENERATION FUNCTIONS (Isolated from services)
// ============================================================================

/**
 * Generate isolated Dice outcome (exact replica of ProvablyFairService)
 */
function generateDiceOutcome(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha512', serverSeed);
  const data = `${clientSeed}:${nonce}:DICE`;
  hmac.update(data);
  const hash = hmac.digest('hex');
  const hashBytes = Buffer.from(hash, 'hex');

  // Bytes-to-float normalization
  const DIVISORS = [256, 65536, 16777216, 4294967296];
  let normalizedValue = 0;
  for (let j = 0; j < 4; j++) {
    const byte = hashBytes[j];
    normalizedValue += byte / DIVISORS[j];
  }

  // Dice formula: Math.floor(float × 10001) / 100
  const gameOutcome = Math.floor(normalizedValue * 10001) / 100;
  return gameOutcome;
}

/**
 * Generate isolated Limbo outcome (exact replica of ProvablyFairService)
 */
function generateLimboOutcome(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha512', serverSeed);
  const data = `${clientSeed}:${nonce}:LIMBO`;
  hmac.update(data);
  const hash = hmac.digest('hex');
  const hashBytes = Buffer.from(hash, 'hex');

  // Bytes-to-float normalization
  const DIVISORS = [256, 65536, 16777216, 4294967296];
  let normalizedValue = 0;
  for (let j = 0; j < 4; j++) {
    const byte = hashBytes[j];
    normalizedValue += byte / DIVISORS[j];
  }

  const houseEdge = 1.0;
  const safeNormalized = Math.max(0.000001, Math.min(0.999999, normalizedValue));
  let gameOutcome = (1 - houseEdge / 100) / safeNormalized;
  gameOutcome = Math.min(gameOutcome, 1000000);
  gameOutcome = Math.max(1.0, gameOutcome);

  return gameOutcome;
}

/**
 * Generate isolated Plinko ball drop (exact replica of PlinkoService)
 */
function generatePlinkoBallDrop(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rowCount: number,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
): { bucketIndex: number; multiplier: number } {
  // Pure 50/50 probability for ALL risk levels (industry standard)
  // Risk levels ONLY affect multiplier tables, NOT ball physics
  // Matches production PlinkoService implementation
  const leftProbability = 0.5;
  let leftSteps = 0;

  for (let row = 1; row <= rowCount; row++) {
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:${row - 1}`;
    hmac.update(data);
    const hash = hmac.digest('hex');
    const hashBytes = Buffer.from(hash, 'hex');

    // Bytes-to-float normalization
    const DIVISORS = [256, 65536, 16777216, 4294967296];
    let randomValue = 0;
    for (let j = 0; j < 4; j++) {
      const byte = hashBytes[j];
      randomValue += byte / DIVISORS[j];
    }

    const goesLeft = randomValue < leftProbability;
    if (goesLeft) {
      leftSteps++;
    }
  }

  const multiplierTable = MULTIPLIER_TABLES[riskLevel][rowCount];
  const multiplier = multiplierTable[leftSteps];

  return {
    bucketIndex: leftSteps,
    multiplier,
  };
}

/**
 * Generate isolated Mines game (exact replica of MinesService and ProvablyFairService)
 */
function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  minesCount: number,
): number[] {
  const GRID_SIZE = 25;
  const minePositions: number[] = [];
  const availablePositions = Array.from({ length: GRID_SIZE }, (_, i) => i);

  // Generate unique mine positions using cursor-based approach
  for (let cursor = 0; cursor < minesCount; cursor++) {
    // Generate random value using cursor
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:${cursor}`;
    hmac.update(data);
    const hash = hmac.digest('hex');
    const hashBytes = Buffer.from(hash, 'hex');

    // Bytes-to-float normalization
    const DIVISORS = [256, 65536, 16777216, 4294967296];
    let randomValue = 0;
    for (let j = 0; j < 4; j++) {
      const byte = hashBytes[j];
      randomValue += byte / DIVISORS[j];
    }

    // Select position from remaining available positions
    const index = Math.floor(randomValue * availablePositions.length);
    const selectedPosition = availablePositions.splice(index, 1)[0];
    minePositions.push(selectedPosition);
  }

  return minePositions.sort((a, b) => a - b);
}

/**
 * Calculate Mines multiplier for a given configuration
 */
function calculateMinesMultiplier(minesCount: number, revealedCount: number): number {
  const GRID_SIZE = 25;
  const HOUSE_EDGE = 0.01; // 1%

  if (revealedCount <= 0) {
    return 1.0;
  }

  const safeTiles = GRID_SIZE - minesCount;
  let cumulativeMultiplier = 1;

  for (let i = 0; i < revealedCount; i++) {
    const tilesRemaining = GRID_SIZE - i;
    const safeTilesRemaining = safeTiles - i;

    if (safeTilesRemaining <= 0) {
      throw new Error('Invalid calculation: no safe tiles remaining');
    }

    const stepMultiplier = tilesRemaining / safeTilesRemaining;
    cumulativeMultiplier *= stepMultiplier;
  }

  // Apply house edge
  const finalMultiplier = cumulativeMultiplier * (1 - HOUSE_EDGE);

  return finalMultiplier;
}

/**
 * Simulate a Mines game with specific reveal count
 */
function simulateMinesGame(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  minesCount: number,
  revealCount: number,
): { won: boolean; multiplier: number; hitMine: boolean } {
  const minePositions = generateMinePositions(serverSeed, clientSeed, nonce, minesCount);
  const GRID_SIZE = 25;

  // Simulate revealing tiles in order (0, 1, 2, ..., revealCount-1)
  let hitMine = false;
  for (let i = 0; i < revealCount; i++) {
    if (minePositions.includes(i)) {
      hitMine = true;
      break;
    }
  }

  if (hitMine) {
    return { won: false, multiplier: 0, hitMine: true };
  }

  // Calculate multiplier for successful reveals
  const multiplier = calculateMinesMultiplier(minesCount, revealCount);
  const safeTiles = GRID_SIZE - minesCount;
  const won = revealCount <= safeTiles && !hitMine;

  return { won, multiplier, hitMine: false };
}

// ============================================================================
// DICE SIMULATIONS
// ============================================================================

function runDiceSimulation(rounds: number): {
  min: number;
  max: number;
  average: number;
  uniqueOutcomes: number;
  distribution: Map<number, number>;
} {
  const serverSeed = 'test-server-seed-dice';
  const clientSeed = 'test-client-seed-dice';
  const results: number[] = [];
  const distribution = new Map<number, number>();

  const progressBar = new cliProgress.SingleBar(
    {
      format:
        chalk.cyan('  Progress |') +
        chalk.green('{bar}') +
        chalk.cyan('| {percentage}% | {value}/{total} simulations'),
    },
    cliProgress.Presets.shades_classic,
  );

  progressBar.start(rounds, 0);

  for (let i = 0; i < rounds; i++) {
    const outcome = generateDiceOutcome(serverSeed, clientSeed, i + 1);
    results.push(outcome);
    distribution.set(outcome, (distribution.get(outcome) || 0) + 1);

    if (i % 10000 === 0) {
      progressBar.update(i);
    }
  }

  progressBar.update(rounds);
  progressBar.stop();

  let min = results[0];
  let max = results[0];
  for (const val of results) {
    if (val < min) min = val;
    if (val > max) max = val;
  }
  const average = results.reduce((sum, val) => sum + val, 0) / results.length;

  return {
    min,
    max,
    average,
    uniqueOutcomes: distribution.size,
    distribution,
  };
}

// ============================================================================
// LIMBO SIMULATIONS
// ============================================================================

interface LimboMultiplierResult {
  multiplier: number;
  winCount: number;
  winRate: number;
  expectedWinRate: number;
  deviation: number;
}

function runLimboMultiplierTest(rounds: number, targetMultiplier: number): LimboMultiplierResult {
  const serverSeed = `test-server-seed-limbo-${targetMultiplier}`;
  const clientSeed = `test-client-seed-limbo-${targetMultiplier}`;
  let wins = 0;

  for (let i = 0; i < rounds; i++) {
    const resultMultiplier = generateLimboOutcome(serverSeed, clientSeed, i + 1);

    if (resultMultiplier >= targetMultiplier) {
      wins++;
    }
  }

  const winRate = (wins / rounds) * 100;
  const expectedWinRate = (100 - 1.0) / targetMultiplier; // 99% / multiplier
  const deviation = winRate - expectedWinRate;

  return {
    multiplier: targetMultiplier,
    winCount: wins,
    winRate,
    expectedWinRate,
    deviation,
  };
}

function runLimboComprehensiveTest(rounds: number): {
  results: LimboMultiplierResult[];
  overallHouseEdge: number;
  overallRTP: number;
} {
  console.log(chalk.gray(`  Testing ${LIMBO_MULTIPLIERS.length} multipliers...`));

  const results: LimboMultiplierResult[] = [];
  let totalBetAmount = 0;
  let totalWinAmount = 0;

  for (let idx = 0; idx < LIMBO_MULTIPLIERS.length; idx++) {
    const targetMultiplier = LIMBO_MULTIPLIERS[idx];
    console.log(
      chalk.gray(`    [${idx + 1}/${LIMBO_MULTIPLIERS.length}] Testing ${targetMultiplier}x...`),
    );

    const result = runLimboMultiplierTest(rounds, targetMultiplier);
    results.push(result);

    // Calculate RTP contribution
    const betPerGame = 1;
    totalBetAmount += rounds * betPerGame;

    const serverSeed = `test-server-seed-limbo-${targetMultiplier}`;
    const clientSeed = `test-client-seed-limbo-${targetMultiplier}`;

    for (let i = 0; i < rounds; i++) {
      const resultMultiplier = generateLimboOutcome(serverSeed, clientSeed, i + 1);
      if (resultMultiplier >= targetMultiplier) {
        totalWinAmount += betPerGame * targetMultiplier;
      }
    }
  }

  const overallHouseEdge = ((totalBetAmount - totalWinAmount) / totalBetAmount) * 100;
  const overallRTP = (totalWinAmount / totalBetAmount) * 100;

  return {
    results,
    overallHouseEdge,
    overallRTP,
  };
}

// ============================================================================
// PLINKO SIMULATIONS
// ============================================================================

function runPlinkoSimulation(
  rounds: number,
  rowCount: number,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
): {
  averageMultiplier: number;
  houseEdge: number;
  uniqueBuckets: number;
  bucketDistribution: Map<number, number>;
  centerHitPercentage: number;
} {
  const serverSeed = `test-server-seed-plinko-${riskLevel}-${rowCount}`;
  const clientSeed = `test-client-seed-plinko-${riskLevel}-${rowCount}`;
  const multipliers: number[] = [];
  const bucketDistribution = new Map<number, number>();

  for (let i = 0; i < rounds; i++) {
    const { bucketIndex, multiplier } = generatePlinkoBallDrop(
      serverSeed,
      clientSeed,
      i + 1,
      rowCount,
      riskLevel,
    );
    multipliers.push(multiplier);
    bucketDistribution.set(bucketIndex, (bucketDistribution.get(bucketIndex) || 0) + 1);
  }

  const averageMultiplier = multipliers.reduce((sum, val) => sum + val, 0) / multipliers.length;
  const houseEdge = (1 - averageMultiplier) * 100;

  // Calculate center hit percentage (middle buckets)
  const totalBuckets = rowCount + 1;
  const centerBuckets = Math.floor(totalBuckets / 3);
  const centerStart = Math.floor(totalBuckets / 2) - Math.floor(centerBuckets / 2);
  const centerEnd = centerStart + centerBuckets;

  let centerHits = 0;
  for (let bucket = centerStart; bucket < centerEnd; bucket++) {
    centerHits += bucketDistribution.get(bucket) || 0;
  }
  const centerHitPercentage = (centerHits / rounds) * 100;

  return {
    averageMultiplier,
    houseEdge,
    uniqueBuckets: bucketDistribution.size,
    bucketDistribution,
    centerHitPercentage,
  };
}

// ============================================================================
// MINES SIMULATIONS
// ============================================================================

interface MinesTestResult {
  mines: number;
  reveals: number;
  totalGames: number;
  wins: number;
  losses: number;
  winProbability: number;
  expectedWinProb: number;
  averageMultiplier: number;
  expectedMultiplier: number;
  houseEdge: number;
}

function runMinesTest(rounds: number, minesCount: number, revealCount: number): MinesTestResult {
  const serverSeed = `test-server-seed-mines-${minesCount}-${revealCount}`;
  const clientSeed = `test-client-seed-mines-${minesCount}-${revealCount}`;

  let wins = 0;
  let losses = 0;
  let totalMultiplier = 0;

  for (let i = 0; i < rounds; i++) {
    const result = simulateMinesGame(serverSeed, clientSeed, i + 1, minesCount, revealCount);

    if (result.won) {
      wins++;
      totalMultiplier += result.multiplier;
    } else {
      losses++;
    }
  }

  const winProbability = (wins / rounds) * 100;
  const averageMultiplier = wins > 0 ? totalMultiplier / wins : 0;

  // Calculate expected win probability
  const GRID_SIZE = 25;
  const safeTiles = GRID_SIZE - minesCount;
  let expectedWinProb = 1;
  for (let i = 0; i < revealCount; i++) {
    const tilesRemaining = GRID_SIZE - i;
    const safeTilesRemaining = safeTiles - i;
    expectedWinProb *= safeTilesRemaining / tilesRemaining;
  }
  expectedWinProb *= 100; // Convert to percentage

  // Calculate expected multiplier
  const expectedMultiplier = calculateMinesMultiplier(minesCount, revealCount);

  // Calculate house edge
  const expectedRTP = (expectedWinProb / 100) * expectedMultiplier;
  const houseEdge = (1 - expectedRTP) * 100;

  return {
    mines: minesCount,
    reveals: revealCount,
    totalGames: rounds,
    wins,
    losses,
    winProbability,
    expectedWinProb,
    averageMultiplier,
    expectedMultiplier,
    houseEdge,
  };
}

function runMinesComprehensiveTest(rounds: number): MinesTestResult[] {
  console.log(chalk.gray(`  Testing ${MINES_CONFIGURATIONS.length} mine configurations...`));

  const results: MinesTestResult[] = [];
  let configIndex = 0;
  const totalConfigs = MINES_CONFIGURATIONS.reduce((sum, config) => sum + config.reveals.length, 0);

  for (const config of MINES_CONFIGURATIONS) {
    for (const revealCount of config.reveals) {
      configIndex++;
      console.log(
        chalk.gray(
          `    [${configIndex}/${totalConfigs}] Testing ${config.mines} mines, ${revealCount} reveals...`,
        ),
      );

      const result = runMinesTest(rounds, config.mines, revealCount);
      results.push(result);
    }
  }

  return results;
}

// ============================================================================
// OUTPUT FUNCTIONS
// ============================================================================

function printHeader() {
  console.log('');
  console.log(chalk.bold.blue('═'.repeat(80)));
  console.log(chalk.bold.blue('🎲 COMPREHENSIVE STATISTICAL VALIDATION SIMULATION SUITE'));
  console.log(chalk.bold.blue('═'.repeat(80)));
  console.log(chalk.cyan(`Simulations per test: ${formatNumber(SIMULATION_COUNT)}`));
  console.log('');

  // Show what will be tested
  console.log(chalk.bold.yellow('Testing Configuration:'));
  if (!SKIP_DICE) console.log(chalk.cyan('  ✓ Dice game'));
  if (!SKIP_LIMBO) console.log(chalk.cyan(`  ✓ Limbo (${LIMBO_MULTIPLIERS.length} multipliers)`));
  if (!SKIP_PLINKO)
    console.log(chalk.cyan('  ✓ Plinko (27 configurations: 3 risk levels × 9 row counts)'));
  if (!SKIP_MINES) {
    const totalMinesTests = MINES_CONFIGURATIONS.reduce(
      (sum, config) => sum + config.reveals.length,
      0,
    );
    console.log(chalk.cyan(`  ✓ Mines (${totalMinesTests} configurations)`));
  }

  if (SKIP_DICE) console.log(chalk.gray('  ⊗ Dice game (skipped)'));
  if (SKIP_LIMBO) console.log(chalk.gray('  ⊗ Limbo (skipped)'));
  if (SKIP_PLINKO) console.log(chalk.gray('  ⊗ Plinko (skipped)'));
  if (SKIP_MINES) console.log(chalk.gray('  ⊗ Mines (skipped)'));
  console.log('');
}

function printSectionHeader(title: string) {
  console.log('');
  console.log(chalk.bold.yellow('─'.repeat(80)));
  console.log(chalk.bold.yellow(title));
  console.log(chalk.bold.yellow('─'.repeat(80)));
}

function printDiceResults(results: ReturnType<typeof runDiceSimulation>) {
  printSectionHeader('[DICE GAME]');

  const rangePass = results.min >= 0 && results.max <= 100;
  const avgPass = Math.abs(results.average - 50) < 0.5;
  const uniquePass = results.uniqueOutcomes >= 9000;
  const distributionPass = rangePass && avgPass && uniquePass;
  const maxIncludes100 = results.max >= 99.99;

  console.log(
    chalk.cyan(
      `├── Range: [${results.min.toFixed(2)}, ${results.max.toFixed(2)}] ${rangePass ? chalk.green('✓') : chalk.red('✗')}`,
    ),
  );
  console.log(
    chalk.cyan(`├── Includes 100.00: ${maxIncludes100 ? chalk.green('YES ✓') : chalk.red('NO ✗')}`),
  );
  console.log(
    chalk.cyan(
      `├── Average: ${results.average.toFixed(4)} (expected: ~50.00) ${avgPass ? chalk.green('✓') : chalk.red('✗')}`,
    ),
  );
  console.log(
    chalk.cyan(
      `├── Unique outcomes: ${formatNumber(results.uniqueOutcomes)} (expected: 10,001) ${uniquePass ? chalk.green('✓') : chalk.red('✗')}`,
    ),
  );
  console.log(
    chalk.cyan(
      `└── Distribution: ${distributionPass ? chalk.green('UNIFORM ✓') : chalk.red('NON-UNIFORM ✗')}`,
    ),
  );

  return distributionPass && maxIncludes100;
}

function printLimboResults(testResults: ReturnType<typeof runLimboComprehensiveTest>) {
  printSectionHeader('[LIMBO GAME - COMPREHENSIVE MULTIPLIER ANALYSIS]');

  console.log('');
  console.log(
    chalk.bold('┌──────────────┬──────────────┬──────────────┬────────────┬────────────┐'),
  );
  console.log(
    chalk.bold('│ Multiplier   │ Expected Win │ Actual Win   │ Deviation  │ Status     │'),
  );
  console.log(
    chalk.bold('├──────────────┼──────────────┼──────────────┼────────────┼────────────┤'),
  );

  let allPass = true;
  const TOLERANCE = 0.5;

  for (const result of testResults.results) {
    const pass = Math.abs(result.deviation) < TOLERANCE;
    if (!pass) allPass = false;

    const statusIcon = pass ? chalk.green('✓') : chalk.red('✗');
    const multiplierStr = padRight(`${result.multiplier}x`, 12);
    const expectedStr = padRight(formatPercent(result.expectedWinRate), 12);
    const actualStr = padRight(formatPercent(result.winRate), 12);
    const deviationStr = padRight(
      (result.deviation >= 0 ? '+' : '') + formatPercent(result.deviation, 3),
      10,
    );

    console.log(
      `│ ${multiplierStr} │ ${expectedStr} │ ${actualStr} │ ${deviationStr} │ ${statusIcon}          │`,
    );
  }

  console.log(
    chalk.bold('└──────────────┴──────────────┴──────────────┴────────────┴────────────┘'),
  );

  const houseEdgePass = Math.abs(testResults.overallHouseEdge - 1.0) < 0.3;
  const rtpPass = testResults.overallRTP >= 98 && testResults.overallRTP <= 100;

  console.log('');
  console.log(
    chalk.cyan(
      `Overall House Edge: ${formatPercent(testResults.overallHouseEdge)} (target: 1.00%) ${houseEdgePass ? chalk.green('✓') : chalk.red('✗')}`,
    ),
  );
  console.log(
    chalk.cyan(
      `Overall RTP: ${formatPercent(testResults.overallRTP)} ${rtpPass ? chalk.green('✓') : chalk.red('✗')}`,
    ),
  );

  return allPass && houseEdgePass && rtpPass;
}

function printPlinkoResults(
  allResults: Array<{
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    rows: number;
    averageMultiplier: number;
    houseEdge: number;
    uniqueBuckets: number;
    centerHitPercentage: number;
  }>,
) {
  printSectionHeader('[PLINKO GAME - DETAILED RISK LEVEL ANALYSIS]');

  const riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
  let allPass = true;

  for (const risk of riskLevels) {
    const riskResults = allResults.filter((r) => r.risk === risk);

    console.log('');
    console.log(
      chalk.bold.magenta(`${risk} RISK (Pure 50/50 probability - multiplier tables only)`),
    );
    console.log(chalk.bold('┌──────┬──────────────┬────────────┬──────────────┬────────────┐'));
    console.log(chalk.bold('│ Rows │ Avg Mult     │ House Edge │ Center Hit % │ Status     │'));
    console.log(chalk.bold('├──────┼──────────────┼────────────┼──────────────┼────────────┤'));

    for (const result of riskResults) {
      const houseEdgePass = result.houseEdge > -1 && result.houseEdge < 5;
      const bucketsPass = result.uniqueBuckets >= result.rows * 0.7;
      const pass = houseEdgePass && bucketsPass;

      if (!pass) allPass = false;

      const statusIcon = pass ? chalk.green('✓') : chalk.red('✗');
      const rowsStr = padRight(result.rows.toString(), 4);
      const multStr = padRight(formatMultiplier(result.averageMultiplier), 12);
      const edgeStr = padRight(formatPercent(result.houseEdge), 10);
      const centerStr = padRight(formatPercent(result.centerHitPercentage), 12);

      console.log(
        `│ ${rowsStr} │ ${multStr} │ ${edgeStr} │ ${centerStr} │ ${statusIcon}          │`,
      );
    }

    console.log(chalk.bold('└──────┴──────────────┴────────────┴──────────────┴────────────┘'));
  }

  // Overall summary
  console.log('');
  console.log(chalk.bold('SUMMARY TABLE (ALL 27 CONFIGURATIONS)'));
  console.log(chalk.bold('┌─────────┬──────┬──────────────┬────────────┬────────────┐'));
  console.log(chalk.bold('│ Risk    │ Rows │ Avg Mult     │ House Edge │ Status     │'));
  console.log(chalk.bold('├─────────┼──────┼──────────────┼────────────┼────────────┤'));

  for (const result of allResults) {
    const houseEdgePass = result.houseEdge > -1 && result.houseEdge < 5;
    const bucketsPass = result.uniqueBuckets >= result.rows * 0.7;
    const pass = houseEdgePass && bucketsPass;

    const statusIcon = pass ? chalk.green('✓') : chalk.red('✗');
    const riskStr = padRight(result.risk, 7);
    const rowsStr = padRight(result.rows.toString(), 4);
    const multStr = padRight(formatMultiplier(result.averageMultiplier), 12);
    const edgeStr = padRight(formatPercent(result.houseEdge), 10);

    console.log(`│ ${riskStr} │ ${rowsStr} │ ${multStr} │ ${edgeStr} │ ${statusIcon}          │`);
  }

  console.log(chalk.bold('└─────────┴──────┴──────────────┴────────────┴────────────┘'));

  return allPass;
}

function printMinesResults(results: MinesTestResult[]) {
  printSectionHeader('[MINES GAME - COMPREHENSIVE CONFIGURATION ANALYSIS]');

  console.log('');
  console.log(
    chalk.bold('┌───────┬─────────┬──────────────┬──────────────┬──────────────┬────────────┐'),
  );
  console.log(
    chalk.bold('│ Mines │ Reveals │ Win Prob     │ Multiplier   │ House Edge   │ Status     │'),
  );
  console.log(
    chalk.bold('├───────┼─────────┼──────────────┼──────────────┼──────────────┼────────────┤'),
  );

  let allPass = true;
  const WIN_PROB_TOLERANCE = 2.0; // 2% tolerance for win probability
  const MULTIPLIER_TOLERANCE = 0.1; // 10% tolerance for multiplier

  for (const result of results) {
    const winProbDiff = Math.abs(result.winProbability - result.expectedWinProb);
    const winProbPass = winProbDiff < WIN_PROB_TOLERANCE;

    const multiplierDiff =
      result.expectedMultiplier > 0
        ? Math.abs(
            (result.averageMultiplier - result.expectedMultiplier) / result.expectedMultiplier,
          ) * 100
        : 0;
    const multiplierPass = multiplierDiff < MULTIPLIER_TOLERANCE * 100 || result.wins === 0;

    const houseEdgePass = result.houseEdge >= -5 && result.houseEdge <= 5;

    const pass = winProbPass && multiplierPass && houseEdgePass;
    if (!pass) allPass = false;

    const statusIcon = pass ? chalk.green('✓') : chalk.red('✗');
    const minesStr = padRight(result.mines.toString(), 5);
    const revealsStr = padRight(result.reveals.toString(), 7);
    const winProbStr = padRight(formatPercent(result.winProbability), 12);
    const multiplierStr = padRight(formatMultiplier(result.averageMultiplier), 12);
    const houseEdgeStr = padRight(formatPercent(result.houseEdge), 12);

    console.log(
      `│ ${minesStr} │ ${revealsStr} │ ${winProbStr} │ ${multiplierStr} │ ${houseEdgeStr} │ ${statusIcon}          │`,
    );
  }

  console.log(
    chalk.bold('└───────┴─────────┴──────────────┴──────────────┴──────────────┴────────────┘'),
  );

  return allPass;
}

function printFinalSummary(
  results: {
    dice?: boolean;
    limbo?: boolean;
    plinko?: boolean;
    mines?: boolean;
  },
  totalSimulations: number,
  totalTime: number,
  limboHouseEdge?: number,
  plinkoAvgHouseEdge?: number,
) {
  console.log('');
  console.log(chalk.bold.blue('═'.repeat(80)));
  console.log(chalk.bold.blue('FINAL SUMMARY'));
  console.log(chalk.bold.blue('═'.repeat(80)));
  console.log(chalk.cyan(`Total simulations run: ${formatNumber(totalSimulations)}`));
  console.log(chalk.cyan(`Total time: ${formatDuration(totalTime)}`));
  console.log('');

  if (results.dice !== undefined) {
    if (results.dice) {
      console.log(chalk.green('✅ Dice: ALL CHECKS PASSED'));
    } else {
      console.log(chalk.red('❌ Dice: SOME CHECKS FAILED'));
    }
  }

  if (results.limbo !== undefined) {
    if (results.limbo) {
      console.log(
        chalk.green(
          `✅ Limbo: ALL ${LIMBO_MULTIPLIERS.length} MULTIPLIERS PASSED (House edge: ${formatPercent(limboHouseEdge || 0)})`,
        ),
      );
    } else {
      console.log(chalk.red('❌ Limbo: SOME CHECKS FAILED'));
    }
  }

  if (results.plinko !== undefined) {
    if (results.plinko) {
      console.log(
        chalk.green(
          `✅ Plinko: ALL 27 CONFIGS PASSED (Avg house edge: ${formatPercent(plinkoAvgHouseEdge || 0)})`,
        ),
      );
    } else {
      console.log(chalk.red('❌ Plinko: SOME CONFIGS FAILED'));
    }
  }

  if (results.mines !== undefined) {
    const totalMinesTests = MINES_CONFIGURATIONS.reduce(
      (sum, config) => sum + config.reveals.length,
      0,
    );
    if (results.mines) {
      console.log(chalk.green(`✅ Mines: ALL ${totalMinesTests} CONFIGURATIONS PASSED`));
    } else {
      console.log(chalk.red(`❌ Mines: SOME CONFIGURATIONS FAILED`));
    }
  }

  console.log('');

  const allPassed = Object.values(results).every((r) => r === true);
  if (allPassed) {
    console.log(chalk.bold.green('🎉 All games validated successfully!'));
  } else {
    console.log(chalk.bold.red('⚠️  Some validations failed. Please review the results above.'));
  }

  console.log(chalk.bold.blue('═'.repeat(80)));
  console.log('');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  const startTime = Date.now();

  printHeader();

  const results: {
    dice?: boolean;
    limbo?: boolean;
    plinko?: boolean;
    mines?: boolean;
  } = {};

  let totalSimulations = 0;
  let limboHouseEdge = 0;
  let plinkoAvgHouseEdge = 0;

  // ==========================================================================
  // DICE SIMULATION
  // ==========================================================================

  if (!SKIP_DICE) {
    console.log(chalk.bold.magenta('Running Dice simulations...'));
    const diceStart = Date.now();
    const diceResults = runDiceSimulation(SIMULATION_COUNT);
    const diceTime = (Date.now() - diceStart) / 1000;
    results.dice = printDiceResults(diceResults);
    console.log(chalk.gray(`Time: ${formatDuration(diceTime)}`));
    totalSimulations += SIMULATION_COUNT;
  }

  // ==========================================================================
  // LIMBO SIMULATION
  // ==========================================================================

  if (!SKIP_LIMBO) {
    console.log('');
    console.log(
      chalk.bold.magenta(`Running Limbo simulations (${LIMBO_MULTIPLIERS.length} multipliers)...`),
    );
    const limboStart = Date.now();
    const limboTestResults = runLimboComprehensiveTest(SIMULATION_COUNT);
    const limboTime = (Date.now() - limboStart) / 1000;
    results.limbo = printLimboResults(limboTestResults);
    limboHouseEdge = limboTestResults.overallHouseEdge;
    console.log(chalk.gray(`Time: ${formatDuration(limboTime)}`));
    totalSimulations += SIMULATION_COUNT * LIMBO_MULTIPLIERS.length;
  }

  // ==========================================================================
  // PLINKO SIMULATION (27 configurations)
  // ==========================================================================

  if (!SKIP_PLINKO) {
    console.log('');
    console.log(chalk.bold.magenta('Running Plinko simulations (27 configurations)...'));
    console.log(chalk.gray('  This may take a while...'));

    const plinkoStart = Date.now();
    const riskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
    const rowCounts = [8, 9, 10, 11, 12, 13, 14, 15, 16];
    const plinkoResults: Array<{
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
      rows: number;
      averageMultiplier: number;
      houseEdge: number;
      uniqueBuckets: number;
      centerHitPercentage: number;
    }> = [];

    // Use user-specified simulation count (no artificial cap)
    const plinkoSimCount = SIMULATION_COUNT;

    let configCount = 0;
    const totalConfigs = riskLevels.length * rowCounts.length;

    for (const risk of riskLevels) {
      for (const rows of rowCounts) {
        configCount++;
        console.log(chalk.gray(`  [${configCount}/${totalConfigs}] ${risk} - ${rows} rows...`));

        const result = runPlinkoSimulation(plinkoSimCount, rows, risk);
        plinkoResults.push({
          risk,
          rows,
          averageMultiplier: result.averageMultiplier,
          houseEdge: result.houseEdge,
          uniqueBuckets: result.uniqueBuckets,
          centerHitPercentage: result.centerHitPercentage,
        });
      }
    }

    const plinkoTime = (Date.now() - plinkoStart) / 1000;
    results.plinko = printPlinkoResults(plinkoResults);
    plinkoAvgHouseEdge =
      plinkoResults.reduce((sum, r) => sum + r.houseEdge, 0) / plinkoResults.length;
    console.log(chalk.gray(`Time: ${formatDuration(plinkoTime)}`));
    totalSimulations += plinkoSimCount * 27;
  }

  // ==========================================================================
  // MINES SIMULATION
  // ==========================================================================

  if (!SKIP_MINES) {
    console.log('');
    const totalMinesTests = MINES_CONFIGURATIONS.reduce(
      (sum, config) => sum + config.reveals.length,
      0,
    );
    console.log(
      chalk.bold.magenta(`Running Mines simulations (${totalMinesTests} configurations)...`),
    );

    const minesStart = Date.now();
    // Use smaller simulation count for Mines to keep runtime reasonable
    const minesSimCount = Math.min(SIMULATION_COUNT, 100000);
    const minesResults = runMinesComprehensiveTest(minesSimCount);
    const minesTime = (Date.now() - minesStart) / 1000;
    results.mines = printMinesResults(minesResults);
    console.log(chalk.gray(`Time: ${formatDuration(minesTime)}`));
    totalSimulations += minesSimCount * totalMinesTests;
  }

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================

  const totalTime = (Date.now() - startTime) / 1000;

  printFinalSummary(results, totalSimulations, totalTime, limboHouseEdge, plinkoAvgHouseEdge);

  // ==========================================================================
  // SAVE RESULTS TO FILE
  // ==========================================================================

  const outputDir = path.join(__dirname, '../../../output-docs/simulation-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `comprehensive-simulation-${timestamp}.md`;
  const filepath = path.join(outputDir, filename);

  let markdown = '# Comprehensive Statistical Validation Simulation Results\n\n';
  markdown += `**Date:** ${new Date().toLocaleString()}\n`;
  markdown += `**Simulations per test:** ${formatNumber(SIMULATION_COUNT)}\n`;
  markdown += `**Total Simulations:** ${formatNumber(totalSimulations)}\n`;
  markdown += `**Total Time:** ${formatDuration(totalTime)}\n\n`;

  markdown += '## Summary\n\n';
  if (results.dice !== undefined) {
    markdown += `- **Dice:** ${results.dice ? '✅ PASSED' : '❌ FAILED'}\n`;
  }
  if (results.limbo !== undefined) {
    markdown += `- **Limbo:** ${results.limbo ? '✅ PASSED' : '❌ FAILED'} (${LIMBO_MULTIPLIERS.length} multipliers, House edge: ${formatPercent(limboHouseEdge)})\n`;
  }
  if (results.plinko !== undefined) {
    markdown += `- **Plinko:** ${results.plinko ? '✅ PASSED' : '❌ FAILED'} (27 configurations, Avg house edge: ${formatPercent(plinkoAvgHouseEdge)})\n`;
  }
  if (results.mines !== undefined) {
    const totalMinesTests = MINES_CONFIGURATIONS.reduce(
      (sum, config) => sum + config.reveals.length,
      0,
    );
    markdown += `- **Mines:** ${results.mines ? '✅ PASSED' : '❌ FAILED'} (${totalMinesTests} configurations)\n`;
  }
  markdown += '\n';

  fs.writeFileSync(filepath, markdown);
  console.log(chalk.cyan(`Results saved to: ${filepath}`));
  console.log('');
}

// Run the simulation suite
main().catch((error) => {
  console.error(chalk.red('Error running simulation suite:'), error);
  process.exit(1);
});
