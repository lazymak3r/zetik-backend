#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({
  path: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
});

import { CrashGameStateEntity, CrashSeedEntity } from '@zetik/shared-entities';
import { createHash } from 'crypto';
import { AppDataSource } from '../src/data-source-migration';

/**
 * Crash Seed Chain Generation Script
 *
 * This script generates the BACKWARDS seed chain for provably fair crash games.
 * It follows proper provably fair methodology (BACKWARDS CHAINING):
 *
 * 1. Generates a random secret = seed for game #10,000,000 (LAST game)
 * 2. Generates chain BACKWARDS: seed[n-1] = SHA256(seed[n])
 * 3. Calculates terminating hash = SHA256(seed[1]) (does NOT expose any game seeds)
 * 4. Stores seeds in database for game use
 * 5. Publishes terminating hash for public verification (BEFORE seeding event)
 * 6. Keeps secret (game #10M seed) private until reveal time
 *
 * Chain structure (SECURE - BACKWARDS):
 * SECRET = seed[10M] → SHA256 → seed[9,999,999] → SHA256 → ... → seed[2] → SHA256 → seed[1] → SHA256 → TERMINATING_HASH
 *                                                                                                      ↑
 *                                                                                        (published commitment)
 *
 * Security:
 * - Games played 1→10M, but cannot predict earlier games from later games
 * - Revealing secret only exposes final game #10M (already played when revealed)
 * - Terminating hash = SHA256(seed[1]) - does NOT expose any actual game seeds
 *
 * Verification process:
 * - Players hash secret 9,999,999 times to get seed[1]
 * - Players hash seed[1] once more to verify terminating hash
 * - Full verification: SHA256^(10,000,000)(SECRET) == published_terminating_hash
 */

const TOTAL_SEEDS = 10_000_000;
const BATCH_SIZE = 10000;
const STARTING_GAME_INDEX = 10_000_000;

interface SeedGenerationStats {
  totalGenerated: number;
  totalStored: number;
  startTime: Date;
  batchesCompleted: number;
  estimatedTimeRemaining: string;
}

class CrashSeedGenerator {
  private stats: SeedGenerationStats = {
    totalGenerated: 0,
    totalStored: 0,
    startTime: new Date(),
    batchesCompleted: 0,
    estimatedTimeRemaining: 'Calculating...',
  };

  /**
   * Generate and store seeds in batches using BACKWARDS chaining (secure)
   */
  private async generateAndStoreSeedChain(secretFinalSeed: string, count: number): Promise<string> {
    console.log(`🔄 Generating ${count.toLocaleString()} seeds from secret (game #10M seed)`);
    console.log('💾 Generating BACKWARDS chain and storing in batches...');

    let currentHash = secretFinalSeed;
    let batch: Array<{ gameIndex: number; serverSeed: string }> = [];
    let firstGameSeed = '';

    // Generate BACKWARDS from game #10M to game #1
    for (let i = 0; i < count; i++) {
      const gameIndex = STARTING_GAME_INDEX - i; // Start from game #10M, go down to #1

      // Add current seed to batch
      batch.push({
        gameIndex,
        serverSeed: currentHash,
      });

      // Store the first game seed (game #1)
      if (gameIndex === 1) {
        firstGameSeed = currentHash;
      }

      // Generate next seed by hashing current seed (BACKWARDS)
      if (i < count - 1) {
        currentHash = createHash('sha256').update(currentHash).digest('hex');
      }

      this.stats.totalGenerated++;

      // Store batch when full
      if (batch.length >= BATCH_SIZE) {
        await this.storeSeedBatch(batch);
        this.stats.totalStored += batch.length;
        this.stats.batchesCompleted++;
        batch = []; // Clear batch
      }

      // Progress reporting
      if ((i + 1) % 50000 === 0) {
        const progress = (((i + 1) / count) * 100).toFixed(1);
        const elapsed = Date.now() - this.stats.startTime.getTime();
        const rate = (i + 1) / (elapsed / 1000);
        const remaining = (count - i - 1) / rate;
        this.stats.estimatedTimeRemaining = this.formatDuration(remaining * 1000);

        console.log(
          `   Progress: ${(i + 1).toLocaleString()}/${count.toLocaleString()} (${progress}%) - Rate: ${rate.toFixed(0)} seeds/sec - ETA: ${this.stats.estimatedTimeRemaining} - Stored: ${this.stats.totalStored.toLocaleString()}`,
        );
      }
    }

    // Store any remaining seeds in the final batch
    if (batch.length > 0) {
      await this.storeSeedBatch(batch);
      this.stats.totalStored += batch.length;
      this.stats.batchesCompleted++;
    }

    return firstGameSeed;
  }

  /**
   * Store a single batch of seeds in database
   */
  private async storeSeedBatch(
    batch: Array<{ gameIndex: number; serverSeed: string }>,
  ): Promise<void> {
    // Convert to entities
    const entities = batch.map((item) => {
      const entity = new CrashSeedEntity();
      entity.gameIndex = item.gameIndex;
      entity.serverSeed = item.serverSeed;
      return entity;
    });

    // Store batch
    await AppDataSource.manager.save(CrashSeedEntity, entities);

    // Small delay every 10 batches to prevent overwhelming the database
    if (this.stats.batchesCompleted % 10 === 0 && this.stats.batchesCompleted > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Verify seed chain integrity
   */
  private async verifySeedChain(
    secretFinalSeed: string,
    firstGameSeed: string,
    terminatingHash: string,
    sampleSize: number = 1000,
  ): Promise<boolean> {
    console.log(`🔍 Verifying seed chain integrity with ${sampleSize.toLocaleString()} samples...`);

    // First, verify the terminating hash commitment
    const calculatedTerminatingHash = createHash('sha256').update(firstGameSeed).digest('hex');

    if (calculatedTerminatingHash !== terminatingHash) {
      console.log(`❌ Terminating hash verification failed!`);
      console.log(`   Expected: ${terminatingHash}`);
      console.log(`   Calculated: ${calculatedTerminatingHash}`);
      return false;
    }

    // Verify the final seed in database matches our secret
    const finalSeedInDB = await AppDataSource.getRepository(CrashSeedEntity).findOne({
      where: { gameIndex: STARTING_GAME_INDEX },
    });

    if (!finalSeedInDB || finalSeedInDB.serverSeed !== secretFinalSeed) {
      console.log(`❌ Final seed in database doesn't match secret!`);
      console.log(`   Expected: ${secretFinalSeed}`);
      console.log(`   Found: ${finalSeedInDB?.serverSeed || 'null'}`);
      return false;
    }

    // Verify the first seed in database matches our calculated first seed
    const firstSeedInDB = await AppDataSource.getRepository(CrashSeedEntity).findOne({
      where: { gameIndex: 1 },
    });

    if (!firstSeedInDB || firstSeedInDB.serverSeed !== firstGameSeed) {
      console.log(`❌ First seed in database doesn't match calculated first seed!`);
      console.log(`   Expected: ${firstGameSeed}`);
      console.log(`   Found: ${firstSeedInDB?.serverSeed || 'null'}`);
      return false;
    }

    console.log(`✅ Terminating hash commitment verified (SHA256 of first game seed)`);
    console.log(`✅ Final seed in database verified`);
    console.log(`✅ First seed in database verified`);

    // Get random sample of seeds for chain verification
    const sampleSeeds = await AppDataSource.createQueryBuilder(CrashSeedEntity, 'seed')
      .orderBy('RANDOM()')
      .limit(sampleSize)
      .getMany();

    let verified = 0;
    const errors: string[] = [];

    for (const seed of sampleSeeds) {
      try {
        // Verify BACKWARDS chain: SHA256(seed[gameIndex]) should equal seed[gameIndex - 1]
        if (seed.gameIndex === 1) {
          // For first seed, there's no previous seed - just verify it exists
          verified++;
        } else if (seed.gameIndex === STARTING_GAME_INDEX) {
          // For final seed, it should match our secret (already verified above)
          verified++;
        } else {
          // For other seeds, verify they hash to previous seed (backwards)
          const prevSeedHash = createHash('sha256').update(seed.serverSeed).digest('hex');

          // Check if previous seed exists in database
          const prevSeed = await AppDataSource.getRepository(CrashSeedEntity).findOne({
            where: { gameIndex: seed.gameIndex - 1 },
          });

          if (prevSeed && prevSeed.serverSeed === prevSeedHash) {
            verified++;
          } else {
            errors.push(
              `Seed ${seed.gameIndex} does not link correctly to seed ${seed.gameIndex - 1}`,
            );
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Error verifying seed ${seed.gameIndex}: ${errorMessage}`);
      }
    }

    const verificationRate = ((verified / sampleSeeds.length) * 100).toFixed(2);
    console.log(`   Verification rate: ${verified}/${sampleSeeds.length} (${verificationRate}%)`);

    if (errors.length > 0) {
      console.log(`   Errors found:`);
      errors.slice(0, 10).forEach((error) => console.log(`     - ${error}`));
      if (errors.length > 10) {
        console.log(`     ... and ${errors.length - 10} more errors`);
      }
    }

    return verified === sampleSeeds.length;
  }

  /**
   * Generate crash seeds and store in database
   */
  async generateSeeds(): Promise<{
    terminatingHash: string;
    secretFinalSeed: string;
    totalSeeds: number;
  }> {
    try {
      console.log('🚀 Starting crash seed chain generation...');
      console.log(`   Total seeds: ${TOTAL_SEEDS.toLocaleString()}`);
      console.log(`   Batch size: ${BATCH_SIZE.toLocaleString()}`);
      console.log(`   Starting game index: ${STARTING_GAME_INDEX.toLocaleString()}`);
      console.log();

      // Initialize database connection
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('📡 Database connection initialized');
      }

      // Clear existing seeds (if any)
      const existingCount = await AppDataSource.getRepository(CrashSeedEntity).count();
      if (existingCount > 0) {
        console.log(`⚠️  Found ${existingCount.toLocaleString()} existing seeds. Clearing...`);
        await AppDataSource.getRepository(CrashSeedEntity).clear();
        console.log('✅ Existing seeds cleared');
      }

      // Generate secret (seed for game #10M - LAST game)
      const secretFinalSeed = createHash('sha256')
        .update(`crash_secret_final_seed_${Date.now()}_${Math.random()}`)
        .digest('hex');

      console.log(`🔐 Secret final seed (reveal after seeding): ${secretFinalSeed}`);
      console.log('⚠️  IMPORTANT: Keep the secret safe until reveal time!');
      console.log('⚠️  NOTE: Secret is seed for game #10,000,000 (final game)');
      console.log();

      // Generate and store seed chain in batches (BACKWARDS from game #10M)
      const firstGameSeed = await this.generateAndStoreSeedChain(secretFinalSeed, TOTAL_SEEDS);

      // Calculate terminating hash (public commitment) = SHA256(first game seed)
      const terminatingHash = createHash('sha256').update(firstGameSeed).digest('hex');

      console.log(`🎯 Terminating hash (for public announcement): ${terminatingHash}`);
      console.log('⚠️  IMPORTANT: Publish the terminating hash BEFORE seeding event!');
      console.log(
        '⚠️  NOTE: Terminating hash = SHA256(game #1 seed) - does NOT expose any game seeds',
      );
      console.log();
      console.log(
        `✅ Generated and stored ${this.stats.totalStored.toLocaleString()} seeds in database`,
      );
      console.log();

      // Initialize crash game state (start from game #1 and count up)
      console.log('🎯 Initializing crash game state...');
      await AppDataSource.getRepository(CrashGameStateEntity).clear(); // Clear any existing state

      const gameState = new CrashGameStateEntity();
      gameState.id = 1;
      gameState.currentGameIndex = 1; // Start from game #1
      gameState.lastUpdated = new Date();

      await AppDataSource.getRepository(CrashGameStateEntity).save(gameState);
      console.log(`✅ Game state initialized: starting at game index 1`);
      console.log();

      // Verify seed chain
      const isValid = await this.verifySeedChain(secretFinalSeed, firstGameSeed, terminatingHash);
      console.log(
        `${isValid ? '✅' : '❌'} Seed chain verification: ${isValid ? 'PASSED' : 'FAILED'}`,
      );
      console.log();

      // Final statistics
      const totalTime = Date.now() - this.stats.startTime.getTime();
      const rate = this.stats.totalGenerated / (totalTime / 1000);

      console.log('📊 Generation Summary:');
      console.log(`   Seeds generated: ${this.stats.totalGenerated.toLocaleString()}`);
      console.log(`   Seeds stored: ${this.stats.totalStored.toLocaleString()}`);
      console.log(`   Batches completed: ${this.stats.batchesCompleted.toLocaleString()}`);
      console.log(`   Total time: ${this.formatDuration(totalTime)}`);
      console.log(`   Average rate: ${rate.toFixed(0)} seeds/second`);
      console.log(`   Terminating hash (public): ${terminatingHash}`);
      console.log(`   Secret final seed (private): ${secretFinalSeed}`);
      console.log(`   First game seed: ${firstGameSeed}`);
      console.log();

      if (isValid) {
        console.log('🎉 Crash seed generation completed successfully!');
        console.log('📝 Next steps:');
        console.log('   1. Game state initialized - games will start from index 1');
        console.log(
          '   2. Update CRASH_CONSTANTS.TERMINATING_HASH with the terminating hash above',
        );
        console.log(
          '   3. PUBLISH the terminating hash for public verification (before seeding event)',
        );
        console.log('   4. KEEP the secret final seed private until reveal time');
        console.log('   5. Wait for Bitcoin block to be mined for seeding event');
        console.log('   6. Update BITCOIN_BLOCK_HASH and BITCOIN_BLOCK_NUMBER');
        console.log('   7. Set SEEDING_EVENT_DATE to the actual seeding time');
        console.log('   8. After seeding event, reveal the secret for verification');
        console.log();
        console.log('🚀 The crash game service can now be started and will work properly!');
      } else {
        throw new Error('Seed chain verification failed');
      }

      return {
        terminatingHash,
        secretFinalSeed,
        totalSeeds: this.stats.totalStored,
      };
    } catch (error) {
      console.error('❌ Seed generation failed:', error);
      throw error;
    } finally {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Main execution
async function main() {
  const generator = new CrashSeedGenerator();

  try {
    const result = await generator.generateSeeds();
    console.log(`\n🏁 Script completed. Generated ${result.totalSeeds.toLocaleString()} seeds.`);
    console.log(`🔑 Terminating Hash (PUBLIC): ${result.terminatingHash}`);
    console.log(`🔐 Secret Final Seed (PRIVATE): ${result.secretFinalSeed}`);
    console.log(`\n⚠️  Remember: Publish terminating hash BEFORE seeding event!`);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  void main();
}
