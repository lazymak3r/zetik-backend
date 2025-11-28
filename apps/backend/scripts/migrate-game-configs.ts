#!/usr/bin/env ts-node

/**
 * Game Configuration Migration Script
 *
 * This script migrates existing hardcoded game configurations to the database
 * and creates comprehensive production-ready configurations for all games.
 *
 * Features:
 * - Extracts hardcoded values from environment variables and game services
 * - Creates configurations for all supported games
 * - Sets up bet limits for multiple currencies and tiers
 * - Configures multipliers and payout settings
 * - Handles different environments (development, staging, production)
 */

import * as dotenv from 'dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { GameBetLimitsEntity } from '../src/games/entities/game-bet-limits.entity';
import { GameConfigEntity } from '../src/games/entities/game-config.entity';
import { GameMultipliersEntity } from '../src/games/entities/game-multipliers.entity';
// Import GameType enum directly since the shared entities may not be available
enum GameType {
  CRASH = 'crash',
  MINES = 'mines',
  PLINKO = 'plinko',
  LIMBO = 'limbo',
  KENO = 'keno',
  BLACKJACK = 'blackjack',
  ROULETTE = 'roulette',
  DICE = 'dice',
  SLOTS = 'slots',
}

// Load environment variables
dotenv.config({ path: '.env' });

// Database configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'postgres',
  schema: process.env.DB_GAMES_SCHEMA || 'games',
  entities: [GameConfigEntity, GameBetLimitsEntity, GameMultipliersEntity],
  synchronize: false,
  logging: true,
});

// Environment-specific configurations
const ENVIRONMENTS = {
  development: {
    maxConcurrentGames: 100,
    multiplier: 0.1, // Smaller limits for dev
    enableDebug: true,
  },
  staging: {
    maxConcurrentGames: 500,
    multiplier: 0.5, // Half production limits
    enableDebug: false,
  },
  production: {
    maxConcurrentGames: 2000,
    multiplier: 1.0, // Full production limits
    enableDebug: false,
  },
};

// Currency configurations with realistic production values
const CURRENCY_CONFIGS = {
  BTC: {
    crypto: {
      standard: {
        minBetAmount: '0.00000001', // 1 satoshi
        maxBetAmount: '1.0',
        maxBetPerSession: '10.0',
        maxBetPerDay: '100.0',
      },
      vip: {
        minBetAmount: '0.00000001',
        maxBetAmount: '5.0',
        maxBetPerSession: '50.0',
        maxBetPerDay: '500.0',
      },
      high_roller: {
        minBetAmount: '0.0001',
        maxBetAmount: '25.0',
        maxBetPerSession: '250.0',
        maxBetPerDay: '2500.0',
      },
    },
  },
  ETH: {
    crypto: {
      standard: {
        minBetAmount: '0.000001', // ~$0.01
        maxBetAmount: '10.0',
        maxBetPerSession: '100.0',
        maxBetPerDay: '1000.0',
      },
      vip: {
        minBetAmount: '0.000001',
        maxBetAmount: '50.0',
        maxBetPerSession: '500.0',
        maxBetPerDay: '5000.0',
      },
      high_roller: {
        minBetAmount: '0.001',
        maxBetAmount: '250.0',
        maxBetPerSession: '2500.0',
        maxBetPerDay: '25000.0',
      },
    },
  },
  USDC: {
    crypto: {
      standard: {
        minBetAmount: '0.01',
        maxBetAmount: '1000.0',
        maxBetPerSession: '10000.0',
        maxBetPerDay: '100000.0',
      },
      vip: {
        minBetAmount: '0.01',
        maxBetAmount: '5000.0',
        maxBetPerSession: '50000.0',
        maxBetPerDay: '500000.0',
      },
      high_roller: {
        minBetAmount: '1.0',
        maxBetAmount: '25000.0',
        maxBetPerSession: '250000.0',
        maxBetPerDay: '2500000.0',
      },
    },
  },
  USDT: {
    crypto: {
      standard: {
        minBetAmount: '0.01',
        maxBetAmount: '1000.0',
        maxBetPerSession: '10000.0',
        maxBetPerDay: '100000.0',
      },
      vip: {
        minBetAmount: '0.01',
        maxBetAmount: '5000.0',
        maxBetPerSession: '50000.0',
        maxBetPerDay: '500000.0',
      },
      high_roller: {
        minBetAmount: '1.0',
        maxBetAmount: '25000.0',
        maxBetPerSession: '250000.0',
        maxBetPerDay: '2500000.0',
      },
    },
  },
};

// Extract hardcoded values from environment
function extractEnvironmentConfigs() {
  const currentEnv = process.env.NODE_ENV || 'development';
  const envConfig = ENVIRONMENTS[currentEnv] || ENVIRONMENTS.development;

  return {
    environment: currentEnv,
    ...envConfig,
    houseEdge: {
      crash: parseFloat(process.env.GAME_HOUSE_EDGE_CRASH || '2.0'),
      mines: parseFloat(process.env.GAME_HOUSE_EDGE_MINES || '1.0'),
      plinko: parseFloat(process.env.GAME_HOUSE_EDGE_PLINKO || '2.0'),
      limbo: parseFloat(process.env.GAME_HOUSE_EDGE_LIMBO || '2.0'),
      keno: parseFloat(process.env.GAME_HOUSE_EDGE_KENO || '5.0'),
      blackjack: 0.52, // Mathematical edge
      roulette: 2.7, // Mathematical edge
      dice: 2.0,
    },
    crash: {
      bettingTimeMs: parseInt(process.env.GAME_CRASH_BETTING_TIME || '15000'),
      minCrashPoint: parseFloat(process.env.GAME_CRASH_MIN_CRASH_POINT || '1.0'),
      maxCrashPoint: parseFloat(process.env.GAME_CRASH_MAX_CRASH_POINT || '100.0'),
    },
    limbo: {
      maxMultiplier: parseFloat(process.env.GAME_MAX_MULTIPLIER_LIMBO || '1000000'),
    },
  };
}

// Game configuration templates
function getGameConfigs(envConfig: any) {
  return {
    [GameType.CRASH]: {
      name: 'Crash Game Configuration',
      description: 'High-intensity multiplier crash game with real-time betting',
      settings: {
        bettingTimeMs: envConfig.crash.bettingTimeMs,
        minCrashPoint: envConfig.crash.minCrashPoint,
        maxCrashPoint: envConfig.crash.maxCrashPoint,
        maxConcurrentGames: Math.floor(envConfig.maxConcurrentGames * 0.5),
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 1000,
        maxPlayersPerGame: 1000,
        gameStartDelay: 5000, // 5 seconds
        enableSounds: true,
        showGameHistory: true,
        maxGameHistorySize: 100,
      },
      defaultHouseEdge: envConfig.houseEdge.crash,
    },
    [GameType.MINES]: {
      name: 'Mines Game Configuration',
      description: 'Strategic mine-sweeping game with progressive multipliers',
      settings: {
        minMines: 1,
        maxMines: 24,
        gridSize: 25,
        maxConcurrentGames: envConfig.maxConcurrentGames,
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 500,
        enableCashout: true,
        maxPayoutMultiplier: 1000000,
        enableGameHistory: true,
        maxGameHistorySize: 50,
      },
      defaultHouseEdge: envConfig.houseEdge.mines,
    },
    [GameType.PLINKO]: {
      name: 'Plinko Game Configuration',
      description: 'Physics-based ball drop game with multiple risk levels',
      settings: {
        riskLevels: ['low', 'medium', 'high'],
        rowOptions: [8, 12, 16],
        maxConcurrentGames: envConfig.maxConcurrentGames,
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 500,
        enableSounds: true,
        enableAnimations: true,
        ballPhysics: {
          gravity: 0.5,
          bounce: 0.7,
          friction: 0.98,
        },
      },
      defaultHouseEdge: envConfig.houseEdge.plinko,
    },
    [GameType.LIMBO]: {
      name: 'Limbo Game Configuration',
      description: 'Simple yet intense multiplier prediction game',
      settings: {
        maxConcurrentGames: envConfig.maxConcurrentGames,
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 500,
        maxMultiplier: envConfig.limbo.maxMultiplier,
        minMultiplier: 1.01,
        maxPayoutAmount: '1000000',
        enableQuickBet: true,
        quickBetMultipliers: [1.1, 1.5, 2.0, 5.0, 10.0],
      },
      defaultHouseEdge: envConfig.houseEdge.limbo,
    },
    [GameType.KENO]: {
      name: 'Keno Game Configuration',
      description: 'Classic lottery-style number picking game',
      settings: {
        minNumbers: 1,
        maxNumbers: 10,
        totalNumbers: 40,
        drawnNumbers: 20,
        maxConcurrentGames: Math.floor(envConfig.maxConcurrentGames * 0.8),
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 1000,
        enableQuickPick: true,
        showDrawAnimation: true,
        gameResultDisplayTime: 3000,
      },
      defaultHouseEdge: envConfig.houseEdge.keno,
    },
    [GameType.BLACKJACK]: {
      name: 'Blackjack Game Configuration',
      description: 'Classic card game with side bets and advanced strategies',
      settings: {
        enableSideBets: true,
        enableDoubleDown: true,
        enableSplit: true,
        enableInsurance: true,
        enableSurrender: false,
        blackjackPayout: 1.5,
        maxSplitHands: 4,
        maxConcurrentGames: Math.floor(envConfig.maxConcurrentGames * 0.3),
        enableAutoplay: false, // Strategy-based game
        cooldownMs: 2000,
        deckCount: 6,
        penetration: 0.75, // 75% deck penetration
        dealerStandsSoft17: true,
      },
      defaultHouseEdge: envConfig.houseEdge.blackjack,
    },
    [GameType.ROULETTE]: {
      name: 'Roulette Game Configuration',
      description: 'European roulette with comprehensive betting options',
      settings: {
        wheelType: 'european', // Single zero
        maxTableBets: 50,
        enableRacetrack: true,
        enableNeighborBets: true,
        maxConcurrentGames: Math.floor(envConfig.maxConcurrentGames * 0.3),
        enableAutoplay: true,
        maxAutoplays: 50,
        cooldownMs: 3000,
        spinDuration: 8000,
        enableCallBets: true,
        enableStatistics: true,
        maxBetsPerRound: 50,
      },
      defaultHouseEdge: envConfig.houseEdge.roulette,
    },
    [GameType.DICE]: {
      name: 'Dice Game Configuration',
      description: 'Customizable dice game with adjustable win chances',
      settings: {
        minWinChance: 0.01,
        maxWinChance: 98.99,
        maxConcurrentGames: envConfig.maxConcurrentGames,
        enableAutoplay: true,
        maxAutoplays: 100,
        cooldownMs: 500,
        enableQuickBets: true,
        quickBetChances: [10, 25, 50, 75, 90],
        enablePresets: true,
        showRollAnimation: true,
      },
      defaultHouseEdge: envConfig.houseEdge.dice,
    },
    [GameType.SLOTS]: {
      name: 'Slots Game Configuration',
      description: 'Third-party slot games integration',
      settings: {
        maxConcurrentGames: envConfig.maxConcurrentGames * 2,
        enableAutoplay: true,
        maxAutoplays: 1000,
        cooldownMs: 100,
        enableTurboMode: true,
        enableProviderGames: true,
        maxProviderSessions: 5000,
        sessionTimeout: 300000, // 5 minutes
      },
      defaultHouseEdge: 3.0, // Provider-dependent
    },
  };
}

// Multiplier configurations for each game
function getMultiplierConfigs() {
  return {
    [GameType.CRASH]: [
      {
        multiplierType: 'crash',
        name: 'Crash Multipliers',
        settings: {
          minMultiplier: 1.0,
          maxMultiplier: 100.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          emergencyStop: 1000.0, // Emergency brake at 1000x
        },
      },
    ],
    [GameType.LIMBO]: [
      {
        multiplierType: 'limbo',
        name: 'Limbo Multipliers',
        settings: {
          minMultiplier: 1.01,
          maxMultiplier: 1000000.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          progressiveScaling: true,
        },
      },
    ],
    [GameType.MINES]: [
      {
        multiplierType: 'mines',
        name: 'Mines Multipliers',
        settings: {
          minMultiplier: 1.0,
          maxMultiplier: 1000000.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          mineConfiguration: {
            minMines: 1,
            maxMines: 24,
            gridSize: 25,
          },
        },
      },
    ],
    [GameType.DICE]: [
      {
        multiplierType: 'dice',
        name: 'Dice Multipliers',
        settings: {
          minMultiplier: 1.01,
          maxMultiplier: 9900.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          diceConfiguration: {
            winChanceRange: { min: 0.01, max: 98.99 },
          },
        },
      },
    ],
    [GameType.PLINKO]: [
      {
        multiplierType: 'payout',
        name: 'Plinko Multipliers',
        settings: {
          minMultiplier: 0.2,
          maxMultiplier: 1000.0,
          decimalPlaces: 1,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          plinkoConfiguration: {
            riskMultipliers: {
              low: [0.5, 1.0, 1.2, 1.4, 1.6, 2.0, 1.6, 1.4, 1.2, 1.0, 0.5],
              medium: [0.2, 0.7, 1.1, 1.4, 1.8, 2.1, 3.0, 2.1, 1.8, 1.4, 1.1, 0.7, 0.2],
              high: [
                0.2, 0.3, 0.5, 0.9, 1.4, 2.4, 3.7, 5.6, 8.1, 11.2, 15.1, 29.6, 58.8, 29.6, 15.1,
                11.2, 8.1, 5.6, 3.7, 2.4, 1.4, 0.9, 0.5, 0.3, 0.2,
              ],
            },
          },
        },
      },
    ],
    [GameType.BLACKJACK]: [
      {
        multiplierType: 'win',
        name: 'Blackjack Win Multipliers',
        settings: {
          minMultiplier: 1.0,
          maxMultiplier: 2.5,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          payoutRules: {
            blackjack: 1.5,
            regularWin: 1.0,
            doubleDown: 1.0,
            split: 1.0,
          },
        },
      },
      {
        multiplierType: 'blackjack_side_bet',
        name: 'Blackjack Side Bet Multipliers',
        settings: {
          minMultiplier: 1.0,
          maxMultiplier: 100.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          sideBetTypes: {
            perfectPairs: { mixed: 5, colored: 10, perfect: 25 },
            twentyOnePlusThree: {
              flush: 5,
              straight: 10,
              threeOfKind: 30,
              straightFlush: 40,
              suitedTrips: 100,
            },
          },
        },
      },
    ],
    [GameType.ROULETTE]: [
      {
        multiplierType: 'payout',
        name: 'Roulette Payout Multipliers',
        settings: {
          minMultiplier: 1.0,
          maxMultiplier: 35.0,
          decimalPlaces: 0,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          payoutTable: {
            straight: 35,
            split: 17,
            street: 11,
            corner: 8,
            sixLine: 5,
            column: 2,
            dozen: 2,
            evenOdd: 1,
            redBlack: 1,
            highLow: 1,
          },
        },
      },
    ],
    [GameType.KENO]: [
      {
        multiplierType: 'payout',
        name: 'Keno Payout Multipliers',
        settings: {
          minMultiplier: 0.0,
          maxMultiplier: 1000.0,
          decimalPlaces: 2,
          roundingMode: 'nearest',
          maxPayoutAmount: '1000000',
          payoutTables: {
            // Payout tables based on numbers selected and hit
            1: { 1: 3.6 },
            2: { 2: 9.0, 1: 0.0 },
            3: { 3: 46.0, 2: 2.5, 1: 0.0 },
            4: { 4: 178.0, 3: 11.0, 2: 1.0, 1: 0.0 },
            5: { 5: 720.0, 4: 50.0, 3: 5.0, 2: 0.0, 1: 0.0 },
            10: { 10: 1000.0, 9: 100.0, 8: 25.0, 7: 5.0, 6: 2.0, 5: 1.0 },
          },
        },
      },
    ],
  };
}

// Migration functions
async function clearExistingData() {
  console.log('🧹 Clearing existing game configuration data...');

  const gameConfigRepo = dataSource.getRepository(GameConfigEntity);
  const betLimitsRepo = dataSource.getRepository(GameBetLimitsEntity);
  const multipliersRepo = dataSource.getRepository(GameMultipliersEntity);

  await multipliersRepo.delete({ createdBy: 'system' });
  await betLimitsRepo.delete({ createdBy: 'system' });
  await gameConfigRepo.delete({ createdBy: 'system' });

  console.log('✅ Existing data cleared');
}

async function migrateGameConfigs(envConfig: any) {
  console.log('🎮 Migrating game configurations...');

  const gameConfigRepo = dataSource.getRepository(GameConfigEntity);
  const configs = getGameConfigs(envConfig);

  for (const [gameType, config] of Object.entries(configs)) {
    console.log(`  - Creating ${gameType} configuration...`);

    const gameConfig = gameConfigRepo.create({
      gameType: gameType as GameType,
      name: config.name,
      description: config.description,
      settings: config.settings,
      defaultHouseEdge: config.defaultHouseEdge,
      isDefault: true,
      version: 1,
      createdBy: 'system',
      updatedBy: 'system',
    });

    await gameConfigRepo.save(gameConfig);
  }

  console.log('✅ Game configurations migrated');
}

async function migrateBetLimits(envConfig: any) {
  console.log('💰 Migrating bet limits...');

  const betLimitsRepo = dataSource.getRepository(GameBetLimitsEntity);
  const activeAssets = (process.env.ACTIVE_ASSETS || 'BTC,ETH,USDC,USDT').split(',');

  const limitTypes = ['standard', 'vip', 'high_roller'] as const;
  const gameTypes = Object.values(GameType);

  for (const currency of activeAssets) {
    const currencyConfig = CURRENCY_CONFIGS[currency];
    if (!currencyConfig) continue;

    for (const limitType of limitTypes) {
      const limits = currencyConfig.crypto[limitType];
      if (!limits) continue;

      for (const gameType of gameTypes) {
        console.log(`  - Creating ${currency} ${limitType} limits for ${gameType}...`);

        // Game-specific limit adjustments
        const gameSpecificSettings = { ...limits };

        // Adjust autoplay settings based on game type
        if (gameType === GameType.BLACKJACK) {
          gameSpecificSettings['allowsAutoplay'] = false;
          gameSpecificSettings['maxAutoplays'] = 0;
        } else if (gameType === GameType.ROULETTE) {
          gameSpecificSettings['allowsAutoplay'] = true;
          gameSpecificSettings['maxAutoplays'] = 50;
          gameSpecificSettings['maxTableBets'] = 25;
        } else {
          gameSpecificSettings['allowsAutoplay'] = true;
          gameSpecificSettings['maxAutoplays'] = 100;
        }

        // Apply environment multiplier
        const multiplier = envConfig.multiplier;
        gameSpecificSettings.maxBetAmount = (
          parseFloat(limits.maxBetAmount) * multiplier
        ).toString();
        gameSpecificSettings.maxBetPerSession = (
          parseFloat(limits.maxBetPerSession) * multiplier
        ).toString();
        gameSpecificSettings.maxBetPerDay = (
          parseFloat(limits.maxBetPerDay) * multiplier
        ).toString();

        const betLimit = betLimitsRepo.create({
          gameType: gameType as GameType,
          currency,
          currencyType: 'crypto',
          limitType: limitType as any,
          name: `${currency} ${limitType.charAt(0).toUpperCase() + limitType.slice(1)} Limits`,
          description: `${limitType} betting limits for ${currency} in ${gameType}`,
          settings: gameSpecificSettings,
          isActive: true,
          priority: limitType === 'standard' ? 1 : limitType === 'vip' ? 2 : 3,
          createdBy: 'system',
          updatedBy: 'system',
        });

        await betLimitsRepo.save(betLimit);
      }
    }
  }

  console.log('✅ Bet limits migrated');
}

async function migrateMultipliers() {
  console.log('📈 Migrating multiplier configurations...');

  const multipliersRepo = dataSource.getRepository(GameMultipliersEntity);
  const multiplierConfigs = getMultiplierConfigs();

  for (const [gameType, configs] of Object.entries(multiplierConfigs)) {
    for (const config of configs) {
      console.log(`  - Creating ${gameType} ${config.multiplierType} multipliers...`);

      const multiplier = multipliersRepo.create({
        gameType: gameType as GameType,
        multiplierType: config.multiplierType as any,
        name: config.name,
        description: `${config.multiplierType} multiplier configuration for ${gameType}`,
        settings: config.settings,
        isActive: true,
        version: 1,
        createdBy: 'system',
        updatedBy: 'system',
      });

      await multipliersRepo.save(multiplier);
    }
  }

  console.log('✅ Multiplier configurations migrated');
}

async function validateMigration() {
  console.log('🔍 Validating migration...');

  const gameConfigRepo = dataSource.getRepository(GameConfigEntity);
  const betLimitsRepo = dataSource.getRepository(GameBetLimitsEntity);
  const multipliersRepo = dataSource.getRepository(GameMultipliersEntity);

  const configCount = await gameConfigRepo.count({ where: { createdBy: 'system' } });
  const limitsCount = await betLimitsRepo.count({ where: { createdBy: 'system' } });
  const multipliersCount = await multipliersRepo.count({ where: { createdBy: 'system' } });

  console.log(`📊 Migration Results:`);
  console.log(`  - Game Configurations: ${configCount}`);
  console.log(`  - Bet Limits: ${limitsCount}`);
  console.log(`  - Multiplier Configs: ${multipliersCount}`);

  // Verify each game type has configurations
  const gameTypes = Object.values(GameType);
  for (const gameType of gameTypes) {
    const hasConfig = await gameConfigRepo.findOne({ where: { gameType, createdBy: 'system' } });
    const hasLimits = await betLimitsRepo.findOne({ where: { gameType, createdBy: 'system' } });

    if (!hasConfig) {
      console.warn(`⚠️  Missing configuration for ${gameType}`);
    }
    if (!hasLimits) {
      console.warn(`⚠️  Missing bet limits for ${gameType}`);
    }
  }

  console.log('✅ Migration validation complete');
}

// Main migration function
async function main() {
  try {
    console.log('🚀 Starting Game Configuration Migration');
    console.log('=====================================');

    // Initialize database connection
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Extract current environment configuration
    const envConfig = extractEnvironmentConfigs();
    console.log(`🌍 Environment: ${envConfig.environment}`);
    console.log(`🔧 Configuration multiplier: ${envConfig.multiplier}x`);

    // Clear existing data (optional - comment out for incremental updates)
    await clearExistingData();

    // Run migrations
    await migrateGameConfigs(envConfig);
    await migrateBetLimits(envConfig);
    await migrateMultipliers();

    // Validate results
    await validateMigration();

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Restart the application to load new configurations');
    console.log('2. Test game functionality with dynamic configurations');
    console.log('3. Monitor performance and adjust limits as needed');
    console.log('4. Update admin panel to manage configurations');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

export { main as migrateGameConfigs };
