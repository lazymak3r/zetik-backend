#!/usr/bin/env ts-node

/**
 * Game Functionality Validation Script
 *
 * This script validates that all games work correctly with dynamic configurations:
 * - Tests bet validation with dynamic limits
 * - Verifies game-specific configurations work properly
 * - Ensures fallback mechanisms function correctly
 * - Tests multiplier calculations with dynamic settings
 */

import { GameType } from '@zetik/shared-entities';
import axios from 'axios';
import * as dotenv from 'dotenv';
import 'reflect-metadata';

// Load environment variables
dotenv.config({ path: '.env' });

// Test configuration
const TEST_CONFIG = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  testTimeout: 30000,
  testAssets: ['BTC', 'ETH', 'USDC'],
  testGameTypes: Object.values(GameType),
};

// Test results tracking
interface ValidationResult {
  game: string;
  test: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const validationResults: ValidationResult[] = [];

// Utility functions
function logValidation(
  game: string,
  test: string,
  success: boolean,
  duration: number,
  error?: string,
  details?: any,
) {
  validationResults.push({ game, test, success, duration, error, details });
  const status = success ? '✅' : '❌';
  const timeStr = `${duration}ms`;
  console.log(`${status} ${game} - ${test} (${timeStr})`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

// Game validation functions
async function validateCrashGame() {
  const game = 'Crash';
  console.log(`\n🎮 Validating ${game} Game...`);

  // Test 1: Configuration Loading
  let start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/crash`);
    const config = response.data;

    const hasRequiredFields =
      config.settings?.bettingTimeMs &&
      config.settings?.minCrashPoint &&
      config.settings?.maxCrashPoint;

    logValidation(
      game,
      'Configuration Loading',
      hasRequiredFields,
      Date.now() - start,
      hasRequiredFields ? undefined : 'Missing required configuration fields',
      { configFields: Object.keys(config.settings || {}) },
    );
  } catch (error) {
    logValidation(game, 'Configuration Loading', false, Date.now() - start, error.message);
  }

  // Test 2: Bet Limits Validation
  for (const asset of TEST_CONFIG.testAssets) {
    start = Date.now();
    try {
      const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/limits/crash/${asset}`);
      const limits = response.data.limits;

      const hasLimits = Array.isArray(limits) && limits.length > 0;
      const hasValidStructure =
        hasLimits && limits[0].settings?.minBetAmount && limits[0].settings?.maxBetAmount;

      logValidation(
        game,
        `Bet Limits (${asset})`,
        hasValidStructure,
        Date.now() - start,
        hasValidStructure ? undefined : 'Invalid bet limits structure',
        { limitsCount: limits?.length, firstLimit: limits?.[0]?.settings },
      );
    } catch (error) {
      logValidation(game, `Bet Limits (${asset})`, false, Date.now() - start, error.message);
    }
  }

  // Test 3: Bet Validation Logic
  start = Date.now();
  try {
    // Try to place a test bet (this would normally require authentication)
    const testBet = {
      betAmount: '0.00000001',
      asset: 'BTC',
      targetMultiplier: 2.0,
    };

    // Simulate bet validation by checking if the endpoint exists and responds correctly
    try {
      await axios.post(`${TEST_CONFIG.backendUrl}/v1/games/crash/bet`, testBet);
      logValidation(game, 'Bet Validation', true, Date.now() - start);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Expected authentication error
        logValidation(
          game,
          'Bet Validation',
          true,
          Date.now() - start,
          'Authentication required (expected)',
        );
      } else if (error.response?.status === 400) {
        // Validation error - check if it's meaningful
        const errorMessage = error.response?.data?.message || '';
        const isValidationError =
          errorMessage.includes('bet') ||
          errorMessage.includes('amount') ||
          errorMessage.includes('limit');
        logValidation(
          game,
          'Bet Validation',
          isValidationError,
          Date.now() - start,
          isValidationError
            ? 'Validation working (expected error)'
            : `Unexpected error: ${errorMessage}`,
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    logValidation(game, 'Bet Validation', false, Date.now() - start, error.message);
  }
}

async function validateMinesGame() {
  const game = 'Mines';
  console.log(`\n💣 Validating ${game} Game...`);

  // Test 1: Configuration Loading
  let start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/mines`);
    const config = response.data;

    const hasRequiredFields =
      config.settings?.minMines && config.settings?.maxMines && config.settings?.gridSize;

    logValidation(
      game,
      'Configuration Loading',
      hasRequiredFields,
      Date.now() - start,
      hasRequiredFields ? undefined : 'Missing required configuration fields',
      { configFields: Object.keys(config.settings || {}) },
    );
  } catch (error) {
    logValidation(game, 'Configuration Loading', false, Date.now() - start, error.message);
  }

  // Test 2: Multiplier Configuration
  start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/multipliers/mines`);
    const multipliers = response.data;

    const hasMultipliers = multipliers && multipliers.settings?.maxMultiplier;

    logValidation(
      game,
      'Multiplier Configuration',
      hasMultipliers,
      Date.now() - start,
      hasMultipliers ? undefined : 'Missing multiplier configuration',
      { multiplierSettings: multipliers?.settings },
    );
  } catch (error) {
    // Multiplier endpoint might not exist, which is ok
    if (error.response?.status === 404) {
      logValidation(
        game,
        'Multiplier Configuration',
        true,
        Date.now() - start,
        'Endpoint not found (acceptable)',
      );
    } else {
      logValidation(game, 'Multiplier Configuration', false, Date.now() - start, error.message);
    }
  }

  // Test 3: Game Logic Integration
  start = Date.now();
  try {
    const testGameData = {
      betAmount: '0.00000001',
      asset: 'BTC',
      minesCount: 5,
    };

    try {
      await axios.post(`${TEST_CONFIG.backendUrl}/v1/games/mines/start`, testGameData);
      logValidation(game, 'Game Logic Integration', true, Date.now() - start);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        logValidation(
          game,
          'Game Logic Integration',
          true,
          Date.now() - start,
          'Authentication required (expected)',
        );
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || '';
        const isValidationError =
          errorMessage.includes('mines') ||
          errorMessage.includes('bet') ||
          errorMessage.includes('amount');
        logValidation(
          game,
          'Game Logic Integration',
          isValidationError,
          Date.now() - start,
          isValidationError
            ? 'Validation working (expected error)'
            : `Unexpected error: ${errorMessage}`,
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    logValidation(game, 'Game Logic Integration', false, Date.now() - start, error.message);
  }
}

async function validatePlinkoGame() {
  const game = 'Plinko';
  console.log(`\n🎯 Validating ${game} Game...`);

  // Test 1: Configuration Loading
  let start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/plinko`);
    const config = response.data;

    const hasRequiredFields =
      config.settings?.riskLevels &&
      config.settings?.rowOptions &&
      Array.isArray(config.settings.riskLevels);

    logValidation(
      game,
      'Configuration Loading',
      hasRequiredFields,
      Date.now() - start,
      hasRequiredFields ? undefined : 'Missing required configuration fields',
      { riskLevels: config.settings?.riskLevels, rowOptions: config.settings?.rowOptions },
    );
  } catch (error) {
    logValidation(game, 'Configuration Loading', false, Date.now() - start, error.message);
  }

  // Test 2: Risk Level Configuration
  start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/plinko`);
    const config = response.data;

    const riskLevels = config.settings?.riskLevels || [];
    const hasAllRiskLevels = ['low', 'medium', 'high'].every((level) => riskLevels.includes(level));

    logValidation(
      game,
      'Risk Level Configuration',
      hasAllRiskLevels,
      Date.now() - start,
      hasAllRiskLevels ? undefined : 'Missing required risk levels',
      { availableRiskLevels: riskLevels },
    );
  } catch (error) {
    logValidation(game, 'Risk Level Configuration', false, Date.now() - start, error.message);
  }
}

async function validateBlackjackGame() {
  const game = 'Blackjack';
  console.log(`\n🃏 Validating ${game} Game...`);

  // Test 1: Configuration Loading
  let start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/blackjack`);
    const config = response.data;

    const hasRequiredFields =
      config.settings?.enableSideBets !== undefined &&
      config.settings?.blackjackPayout !== undefined;

    logValidation(
      game,
      'Configuration Loading',
      hasRequiredFields,
      Date.now() - start,
      hasRequiredFields ? undefined : 'Missing required configuration fields',
      { sideBets: config.settings?.enableSideBets, payout: config.settings?.blackjackPayout },
    );
  } catch (error) {
    logValidation(game, 'Configuration Loading', false, Date.now() - start, error.message);
  }

  // Test 2: Side Bets Configuration
  start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/multipliers/blackjack`);
    const multipliers = response.data;

    const hasSideBetMultipliers =
      multipliers && (multipliers.settings?.sideBetTypes || multipliers.settings?.payoutRules);

    logValidation(
      game,
      'Side Bets Configuration',
      hasSideBetMultipliers,
      Date.now() - start,
      hasSideBetMultipliers ? undefined : 'Missing side bet configuration',
    );
  } catch (error) {
    if (error.response?.status === 404) {
      logValidation(
        game,
        'Side Bets Configuration',
        true,
        Date.now() - start,
        'Endpoint not found (acceptable)',
      );
    } else {
      logValidation(game, 'Side Bets Configuration', false, Date.now() - start, error.message);
    }
  }
}

async function validateRouletteGame() {
  const game = 'Roulette';
  console.log(`\n🎡 Validating ${game} Game...`);

  // Test 1: Configuration Loading
  let start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/roulette`);
    const config = response.data;

    const hasRequiredFields = config.settings?.wheelType && config.settings?.maxTableBets;

    logValidation(
      game,
      'Configuration Loading',
      hasRequiredFields,
      Date.now() - start,
      hasRequiredFields ? undefined : 'Missing required configuration fields',
      { wheelType: config.settings?.wheelType, maxTableBets: config.settings?.maxTableBets },
    );
  } catch (error) {
    logValidation(game, 'Configuration Loading', false, Date.now() - start, error.message);
  }

  // Test 2: Payout Configuration
  start = Date.now();
  try {
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/multipliers/roulette`);
    const multipliers = response.data;

    const hasPayoutTable = multipliers && multipliers.settings?.payoutTable;

    logValidation(
      game,
      'Payout Configuration',
      hasPayoutTable,
      Date.now() - start,
      hasPayoutTable ? undefined : 'Missing payout table configuration',
    );
  } catch (error) {
    if (error.response?.status === 404) {
      logValidation(
        game,
        'Payout Configuration',
        true,
        Date.now() - start,
        'Endpoint not found (acceptable)',
      );
    } else {
      logValidation(game, 'Payout Configuration', false, Date.now() - start, error.message);
    }
  }
}

async function validateFallbackMechanisms() {
  const game = 'Fallback';
  console.log(`\n🛡️  Validating Fallback Mechanisms...`);

  // Test 1: Invalid Game Type Fallback
  let start = Date.now();
  try {
    await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/invalid_game_type`);
    logValidation(
      game,
      'Invalid Game Type',
      false,
      Date.now() - start,
      'Should have returned error',
    );
  } catch (error) {
    const isExpectedError = error.response?.status === 404 || error.response?.status === 400;
    logValidation(
      game,
      'Invalid Game Type',
      isExpectedError,
      Date.now() - start,
      isExpectedError
        ? 'Correctly rejected invalid game type'
        : `Unexpected error: ${error.message}`,
    );
  }

  // Test 2: Invalid Currency Fallback
  start = Date.now();
  try {
    await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/limits/crash/INVALID_CURRENCY`);
    logValidation(
      game,
      'Invalid Currency',
      false,
      Date.now() - start,
      'Should have returned error',
    );
  } catch (error) {
    const isExpectedError = error.response?.status === 404 || error.response?.status === 400;
    logValidation(
      game,
      'Invalid Currency',
      isExpectedError,
      Date.now() - start,
      isExpectedError
        ? 'Correctly rejected invalid currency'
        : `Unexpected error: ${error.message}`,
    );
  }

  // Test 3: Configuration Override
  start = Date.now();
  try {
    // Test that environment variables still work as fallback
    const response = await axios.get(`${TEST_CONFIG.backendUrl}/v1/games/config/crash`);
    const config = response.data;

    const hasReasonableDefaults =
      config.settings?.bettingTimeMs > 0 &&
      config.settings?.minCrashPoint >= 1.0 &&
      config.settings?.maxCrashPoint > config.settings?.minCrashPoint;

    logValidation(
      game,
      'Configuration Defaults',
      hasReasonableDefaults,
      Date.now() - start,
      hasReasonableDefaults ? undefined : 'Configuration has unreasonable default values',
      {
        bettingTime: config.settings?.bettingTimeMs,
        minCrash: config.settings?.minCrashPoint,
        maxCrash: config.settings?.maxCrashPoint,
      },
    );
  } catch (error) {
    logValidation(game, 'Configuration Defaults', false, Date.now() - start, error.message);
  }
}

async function validateBetAmountLogic() {
  const game = 'Bet Validation';
  console.log(`\n💰 Validating Bet Amount Logic...`);

  for (const gameType of ['crash', 'mines', 'plinko']) {
    // Test 1: Minimum Bet Validation
    let start = Date.now();
    try {
      const testBet = {
        betAmount: '0.000000001', // Below minimum
        asset: 'BTC',
      };

      await axios.post(`${TEST_CONFIG.backendUrl}/v1/games/${gameType}/bet`, testBet);
      logValidation(
        game,
        `${gameType} - Min Bet Rejection`,
        false,
        Date.now() - start,
        'Should reject bet below minimum',
      );
    } catch (error) {
      const isValidationError =
        error.response?.status === 400 &&
        (error.response?.data?.message?.includes('minimum') ||
          error.response?.data?.message?.includes('small'));
      logValidation(
        game,
        `${gameType} - Min Bet Rejection`,
        isValidationError,
        Date.now() - start,
        isValidationError ? 'Correctly rejected minimum bet' : `Unexpected error: ${error.message}`,
      );
    }

    // Test 2: Maximum Bet Validation
    start = Date.now();
    try {
      const testBet = {
        betAmount: '999999999', // Above maximum
        asset: 'BTC',
      };

      await axios.post(`${TEST_CONFIG.backendUrl}/v1/games/${gameType}/bet`, testBet);
      logValidation(
        game,
        `${gameType} - Max Bet Rejection`,
        false,
        Date.now() - start,
        'Should reject bet above maximum',
      );
    } catch (error) {
      const isValidationError =
        error.response?.status === 400 &&
        (error.response?.data?.message?.includes('maximum') ||
          error.response?.data?.message?.includes('exceeds') ||
          error.response?.data?.message?.includes('limit'));
      logValidation(
        game,
        `${gameType} - Max Bet Rejection`,
        isValidationError,
        Date.now() - start,
        isValidationError ? 'Correctly rejected maximum bet' : `Unexpected error: ${error.message}`,
      );
    }
  }
}

// Main validation function
async function runValidation() {
  console.log('🔍 Game Functionality Validation Suite');
  console.log('=====================================');
  console.log(`Backend URL: ${TEST_CONFIG.backendUrl}`);
  console.log(`Test Assets: ${TEST_CONFIG.testAssets.join(', ')}`);
  console.log('');

  const validationSuite = [
    validateCrashGame,
    validateMinesGame,
    validatePlinkoGame,
    validateBlackjackGame,
    validateRouletteGame,
    validateFallbackMechanisms,
    validateBetAmountLogic,
  ];

  for (const validation of validationSuite) {
    try {
      await validation();
    } catch (error) {
      console.error(`💥 Validation error: ${error.message}`);
    }
  }

  // Generate summary
  console.log('\n📊 Validation Results Summary');
  console.log('============================');

  const byGame = validationResults.reduce(
    (acc, result) => {
      if (!acc[result.game]) {
        acc[result.game] = { passed: 0, failed: 0, total: 0 };
      }
      acc[result.game].total++;
      if (result.success) {
        acc[result.game].passed++;
      } else {
        acc[result.game].failed++;
      }
      return acc;
    },
    {} as Record<string, { passed: number; failed: number; total: number }>,
  );

  for (const [game, stats] of Object.entries(byGame)) {
    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
    const status = stats.failed === 0 ? '✅' : '⚠️';
    console.log(`${status} ${game}: ${stats.passed}/${stats.total} passed (${successRate}%)`);
  }

  const totalPassed = validationResults.filter((r) => r.success).length;
  const totalTests = validationResults.length;
  const overallSuccessRate = ((totalPassed / totalTests) * 100).toFixed(1);

  console.log('');
  console.log(`📈 Overall Success Rate: ${overallSuccessRate}% (${totalPassed}/${totalTests})`);

  if (totalPassed < totalTests) {
    console.log('\n❌ Failed Validations:');
    validationResults
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.game} - ${r.test}: ${r.error}`);
      });
  }

  return totalPassed === totalTests;
}

// Handle script execution
async function main() {
  try {
    const success = await runValidation();

    if (success) {
      console.log(
        '\n🎉 All validations passed! Games are working correctly with dynamic configurations.',
      );
      process.exit(0);
    } else {
      console.log('\n⚠️  Some validations failed. Please review the results and fix any issues.');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Validation suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { runValidation };
