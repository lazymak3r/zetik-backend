import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BlackjackGameEntity,
  BlackjackGameStatus,
  CrashBetEntity,
  DiceBetEntity,
  GameTypeEnum,
  KenoGameEntity,
  LimboGameEntity,
  MinesGameEntity,
  MinesGameStatus,
  PlinkoGameEntity,
  RouletteGame,
  SeedPairEntity,
} from '@zetik/shared-entities';
import * as crypto from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { BytesToFloatService } from './bytes-to-float.service';
import { HouseEdgeService } from './house-edge.service';

export interface GameOutcome {
  value: number;
  hash: string;
  nonce: string;
  serverSeed: string;
  clientSeed: string;
}

export interface SeedVerification {
  isValid: boolean;
  calculatedOutcome?: number;
  providedOutcome?: number;
  hash: string;
}

@Injectable()
export class ProvablyFairService {
  private readonly logger = new Logger(ProvablyFairService.name);
  private readonly defaultHouseEdge: number;

  constructor(
    @InjectRepository(SeedPairEntity)
    private readonly seedPairRepository: Repository<SeedPairEntity>,
    @InjectRepository(DiceBetEntity)
    private readonly diceBetRepository: Repository<DiceBetEntity>,
    @InjectRepository(CrashBetEntity)
    private readonly crashBetRepository: Repository<CrashBetEntity>,
    @InjectRepository(BlackjackGameEntity)
    private readonly blackjackGameRepository: Repository<BlackjackGameEntity>,
    @InjectRepository(KenoGameEntity)
    private readonly kenoGameRepository: Repository<KenoGameEntity>,
    @InjectRepository(LimboGameEntity)
    private readonly limboGameRepository: Repository<LimboGameEntity>,
    @InjectRepository(MinesGameEntity)
    private readonly minesGameRepository: Repository<MinesGameEntity>,
    @InjectRepository(PlinkoGameEntity)
    private readonly plinkoGameRepository: Repository<PlinkoGameEntity>,
    @InjectRepository(RouletteGame)
    private readonly rouletteGameRepository: Repository<RouletteGame>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly bytesToFloatService: BytesToFloatService,
    private readonly houseEdgeService: HouseEdgeService,
  ) {
    this.defaultHouseEdge = this.configService.get<number>('games.defaultHouseEdge', 2.0);
  }

  /**
   * Generate a new seed pair for a user
   */
  async generateSeedPair(userId: string, clientSeed?: string): Promise<SeedPairEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Deactivate current active seed pair
      await queryRunner.manager.update(
        SeedPairEntity,
        { userId, isActive: true },
        { isActive: false, revealedAt: new Date() },
      );

      // Generate new server seed and pre-compute next server seed
      const serverSeed = this.generateServerSeed();
      const serverSeedHash = this.hashServerSeed(serverSeed);
      const nextServerSeed = this.generateServerSeed();
      const nextServerSeedHash = this.hashServerSeed(nextServerSeed);

      // Create new seed pair
      const seedPair = new SeedPairEntity();
      seedPair.userId = userId;
      seedPair.serverSeed = serverSeed;
      seedPair.serverSeedHash = serverSeedHash;
      seedPair.clientSeed = clientSeed || this.generateDefaultClientSeed();
      seedPair.nonce = '0';
      seedPair.isActive = true;
      seedPair.nextServerSeed = nextServerSeed;
      seedPair.nextServerSeedHash = nextServerSeedHash;

      const savedSeedPair = await queryRunner.manager.save(SeedPairEntity, seedPair);

      await queryRunner.commitTransaction();

      return savedSeedPair;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate seed pair for user ${userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get current active seed pair for user
   */
  async getActiveSeedPair(userId: string): Promise<SeedPairEntity | null> {
    return this.seedPairRepository.findOne({
      where: { userId, isActive: true },
    });
  }

  /**
   * Update client seed for active seed pair
   */
  async updateClientSeed(
    userId: string,
    newClientSeed: string,
  ): Promise<{
    revealedSeed: string | null;
    oldSeedHash: string | null;
    oldClientSeed: string | null;
    oldNonce: string | null;
    newSeedHash: string;
    newClientSeed: string;
    nextServerSeedHash: string;
  }> {
    // Check for active Mines games before starting transaction
    const hasActiveMines = await this.minesGameRepository.findOne({
      where: { userId, status: MinesGameStatus.ACTIVE },
    });

    // Check for active Blackjack games before starting transaction
    const hasActiveBlackjack = await this.blackjackGameRepository.findOne({
      where: {
        userId,
        status: In([
          BlackjackGameStatus.ACTIVE,
          BlackjackGameStatus.PLAYER_STAND,
          BlackjackGameStatus.DEALER_TURN,
        ]),
      },
    });

    if (hasActiveMines || hasActiveBlackjack) {
      throw new BadRequestException(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current active seed pair
      const activeSeedPair = await queryRunner.manager.findOne(SeedPairEntity, {
        where: { userId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeSeedPair) {
        // Create initial active seed pair
        const serverSeed = this.generateServerSeed();
        const serverSeedHash = this.hashServerSeed(serverSeed);
        const nextServerSeed = this.generateServerSeed();
        const nextServerSeedHash = this.hashServerSeed(nextServerSeed);
        const seedPair = new SeedPairEntity();
        seedPair.userId = userId;
        seedPair.serverSeed = serverSeed;
        seedPair.serverSeedHash = serverSeedHash;
        seedPair.clientSeed = newClientSeed;
        seedPair.nonce = '0';
        seedPair.isActive = true;
        seedPair.nextServerSeed = nextServerSeed;
        seedPair.nextServerSeedHash = nextServerSeedHash;
        await queryRunner.manager.save(SeedPairEntity, seedPair);
        await queryRunner.commitTransaction();
        return {
          revealedSeed: null,
          oldSeedHash: null,
          oldClientSeed: null,
          oldNonce: null,
          newSeedHash: serverSeedHash,
          newClientSeed,
          nextServerSeedHash,
        };
      }

      // Reveal current server seed and rotate to the precomputed next one
      const revealedSeed = activeSeedPair.serverSeed;
      const oldSeedHash = activeSeedPair.serverSeedHash;
      const oldClientSeed = activeSeedPair.clientSeed;
      const oldNonce = activeSeedPair.nonce;

      const rotatedServerSeed = activeSeedPair.nextServerSeed || this.generateServerSeed();
      const rotatedServerSeedHash =
        activeSeedPair.nextServerSeedHash || this.hashServerSeed(rotatedServerSeed);

      // Deactivate old pair
      activeSeedPair.isActive = false;
      activeSeedPair.revealedAt = new Date();
      await queryRunner.manager.save(SeedPairEntity, activeSeedPair);

      // Precompute a brand-new next seed for the newly created pair
      const nextServerSeed = this.generateServerSeed();
      const nextServerSeedHash = this.hashServerSeed(nextServerSeed);

      const newSeedPair = new SeedPairEntity();
      newSeedPair.userId = userId;
      newSeedPair.serverSeed = rotatedServerSeed;
      newSeedPair.serverSeedHash = rotatedServerSeedHash;
      newSeedPair.clientSeed = newClientSeed;
      newSeedPair.nonce = '0';
      newSeedPair.isActive = true;
      newSeedPair.nextServerSeed = nextServerSeed;
      newSeedPair.nextServerSeedHash = nextServerSeedHash;
      await queryRunner.manager.save(SeedPairEntity, newSeedPair);

      await queryRunner.commitTransaction();
      return {
        revealedSeed,
        oldSeedHash,
        oldClientSeed,
        oldNonce,
        newSeedHash: rotatedServerSeedHash,
        newClientSeed,
        nextServerSeedHash,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update client seed for user ${userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate game outcome using provably fair algorithm
   * Automatically creates initial seed pair if user doesn't have one
   *
   * @param userId - The user ID
   * @param gameType - The game type
   * @param betAmount - The bet amount
   * @param isRetry - Internal flag to prevent infinite recursion (DO NOT SET MANUALLY)
   */
  async generateGameOutcome(
    userId: string,
    gameType: GameTypeEnum,
    betAmount: string,
    isRetry: boolean = false,
  ): Promise<GameOutcome> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Atomically increment nonce and get seed data
      // Cast nonce to bigint explicitly to ensure proper arithmetic
      const result = await queryRunner.manager.query(
        `
        UPDATE games.seed_pairs
        SET nonce = nonce::bigint + 1,
            "updatedAt" = NOW()
        WHERE id = (
          SELECT id FROM games.seed_pairs
          WHERE "userId" = $1 AND "isActive" = true
          ORDER BY "createdAt" DESC
          LIMIT 1
        )
        RETURNING
          "serverSeed" as "serverSeed",
          "clientSeed" as "clientSeed",
          "serverSeedHash" as "serverSeedHash",
          nonce::text as nonce
        `,
        [userId],
      );

      // Nonce incremented

      // TypeORM query() returns different formats depending on the query
      // For UPDATE...RETURNING, it returns an array with the first element being the rows
      // When no rows match: result = [[], 0] (empty rows array + affected count)
      // When rows match: result = [[{...data}], 1] (rows array with data + affected count)
      const seedRow = Array.isArray(result[0]) ? result[0][0] : result[0];

      // If no active seed pair exists, create one automatically for seamless first game experience
      if (!seedRow) {
        // Prevent infinite recursion - only allow one retry
        if (isRetry) {
          this.logger.error(
            `Failed to generate game outcome for user ${userId}: ` +
              `Seed pair still missing after creation attempt. This indicates a database constraint ` +
              `or race condition preventing seed pair creation.`,
          );
          throw new Error(
            'Failed to create seed pair for new user. Please try again or contact support.',
          );
        }

        this.logger.log(`No seed pair found for user ${userId}, creating initial seed pair`);

        // Rollback current transaction since we haven't done anything yet
        await queryRunner.rollbackTransaction();
        await queryRunner.release();

        try {
          // Create seed pair using existing method (handles its own transaction)
          const newSeedPair = await this.generateSeedPair(userId);

          // Verify seed pair was actually created
          if (!newSeedPair || !newSeedPair.id) {
            this.logger.error(
              `Failed to create seed pair for user ${userId}: generateSeedPair returned invalid result`,
            );
            throw new Error(
              'Failed to create seed pair for new user. Please try again or contact support.',
            );
          }

          this.logger.log(
            `✅ Created seed pair ${newSeedPair.id} for user ${userId}, retrying once`,
          );

          // Retry the game outcome generation ONCE with retry flag set
          return this.generateGameOutcome(userId, gameType, betAmount, true);
        } catch (error) {
          // Handle race condition: another concurrent request may have created the seed pair
          const err = error as { code?: string; message?: string };
          if (err.code === '23505' || err.message?.includes('unique')) {
            this.logger.log(
              `Seed pair created by concurrent request for user ${userId}, retrying game outcome`,
            );
            return this.generateGameOutcome(userId, gameType, betAmount, true);
          }
          throw error;
        }
      }

      // Seed data parsed (seedRow should exist at this point due to check above)

      // Generate outcome with the new nonce
      const outcome = this.calculateOutcome(
        seedRow.serverSeed,
        seedRow.clientSeed,
        seedRow.nonce,
        gameType,
      );

      await queryRunner.commitTransaction();

      return outcome;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate game outcome for user ${userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reveal server seed and generate new seed pair
   */
  // revealServerSeed removed; rotation handled in updateClientSeed

  /**
   * Verify a game outcome using provided seeds
   */
  verifyGameOutcome(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    gameType: GameTypeEnum,
    providedOutcome: number,
  ): SeedVerification {
    try {
      const calculatedOutcome = this.calculateOutcome(serverSeed, clientSeed, nonce, gameType);

      return {
        isValid: Math.abs(calculatedOutcome.value - providedOutcome) < 0.000001, // Allow for floating point precision
        calculatedOutcome: calculatedOutcome.value,
        providedOutcome,
        hash: calculatedOutcome.hash,
      };
    } catch (error) {
      this.logger.error('Failed to verify game outcome:', error);
      return {
        isValid: false,
        hash: '',
      };
    }
  }

  /**
   * Get seed info for a specific bet with verification
   */
  async getBetSeedInfo(
    userId: string,
    gameType: GameTypeEnum,
    betId: string,
  ): Promise<{
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    outcome: number;
    isValid: boolean;
    calculatedOutcome: number;
    hash: string;
  } | null> {
    try {
      let seedInfo: any = null;
      let gameOutcome: number = 0;

      switch (gameType) {
        case GameTypeEnum.DICE:
          seedInfo = await this.diceBetRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash', 'rollResult'],
          });
          if (seedInfo) {
            gameOutcome = parseFloat(seedInfo.rollResult);
          }
          break;

        case GameTypeEnum.CRASH: {
          // For crash game, we need to join with crash game entity to get seed info
          // Crash games only use server seed + nonce (no client seed needed for global games)
          const crashBetWithGame = await this.crashBetRepository.findOne({
            where: { id: betId, userId },
            relations: ['crashGame'],
          });

          if (crashBetWithGame && crashBetWithGame.crashGame) {
            seedInfo = {
              serverSeed: crashBetWithGame.crashGame.serverSeed,
              clientSeed: null, // Crash games don't use client seeds
              nonce: parseInt(crashBetWithGame.crashGame.nonce, 10),
            };
            // For crash game, use the crash point as the outcome
            gameOutcome = parseFloat(crashBetWithGame.crashGame.crashPoint);
          }
          break;
        }

        case GameTypeEnum.BLACKJACK:
          seedInfo = await this.blackjackGameRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash'],
          });
          if (seedInfo) {
            // For blackjack, calculate the provably fair outcome used for deck shuffling
            const blackjackOutcome = this.calculateOutcome(
              seedInfo.serverSeed,
              seedInfo.clientSeed,
              seedInfo.nonce.toString(),
              GameTypeEnum.BLACKJACK,
            );
            gameOutcome = blackjackOutcome.value;
          }
          break;

        case GameTypeEnum.KENO:
          seedInfo = await this.kenoGameRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash', 'matches'],
          });
          if (seedInfo) {
            gameOutcome = seedInfo.matches || 0;
          }
          break;

        case GameTypeEnum.LIMBO:
          seedInfo = await this.limboGameRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash', 'resultMultiplier'],
          });
          if (seedInfo) {
            gameOutcome = parseFloat(seedInfo.resultMultiplier) || 0;
          }
          break;

        case GameTypeEnum.MINES:
          seedInfo = await this.minesGameRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash', 'revealedTiles'],
          });
          if (seedInfo) {
            // For mines, we need to calculate the normalized outcome using the same algorithm
            // as calculateOutcome, not use the revealed tiles length
            const minesOutcome = this.calculateOutcome(
              seedInfo.serverSeed,
              seedInfo.clientSeed,
              seedInfo.nonce.toString(),
              GameTypeEnum.MINES,
            );
            gameOutcome = minesOutcome.value;
          }
          break;

        case GameTypeEnum.PLINKO:
          seedInfo = await this.plinkoGameRepository.findOne({
            where: { id: betId, userId },
            select: ['serverSeed', 'clientSeed', 'nonce', 'serverSeedHash', 'bucketIndex'],
          });
          if (seedInfo) {
            // For plinko, we need to calculate the normalized outcome using the same algorithm
            // as calculateOutcome, not use the bucket index
            const plinkoOutcome = this.calculateOutcome(
              seedInfo.serverSeed,
              seedInfo.clientSeed,
              seedInfo.nonce.toString(),
              GameTypeEnum.PLINKO,
            );
            gameOutcome = plinkoOutcome.value;
          }
          break;

        case GameTypeEnum.ROULETTE: {
          const rouletteGame = await this.rouletteGameRepository.findOne({
            where: { id: betId, userId },
            select: ['seedPairId', 'clientSeed', 'nonce', 'winningNumber'],
          });

          if (rouletteGame) {
            // Get seed pair by seedPairId
            const seedPair = await this.seedPairRepository.findOne({
              where: { id: rouletteGame.seedPairId },
              select: ['serverSeed'],
            });

            if (seedPair) {
              seedInfo = {
                serverSeed: seedPair.serverSeed,
                clientSeed: rouletteGame.clientSeed,
                nonce: rouletteGame.nonce,
              };
              // Use the winning number from the database for verification
              gameOutcome = rouletteGame.winningNumber || 0;
            }
          }
          break;
        }

        default:
          this.logger.warn(`Unsupported game type: ${gameType}`);
          return null;
      }

      if (!seedInfo) {
        this.logger.warn(`Bet not found: ${betId} for user: ${userId} in game: ${gameType}`);
        return null;
      }

      // Perform provably fair verification
      const nonce = typeof seedInfo.nonce === 'string' ? parseInt(seedInfo.nonce) : seedInfo.nonce;
      const verification = this.verifyGameOutcome(
        seedInfo.serverSeed,
        seedInfo.clientSeed,
        nonce.toString(),
        gameType,
        gameOutcome,
      );

      return {
        serverSeed: seedInfo.serverSeed,
        serverSeedHash: seedInfo.serverSeedHash,
        clientSeed: seedInfo.clientSeed,
        nonce,
        outcome: gameOutcome,
        isValid: verification.isValid,
        calculatedOutcome: verification.calculatedOutcome || 0,
        hash: verification.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to get bet seed info for bet ${betId}:`, error);
      return null;
    }
  }

  /**
   * Generate cryptographically secure server seed
   */
  private generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate default client seed
   */
  private generateDefaultClientSeed(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hash server seed for client display
   */
  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate Limbo game outcome with custom house edge (casino standard)
   * Automatically creates initial seed pair if user doesn't have one
   *
   * @param userId - The user ID
   * @param betAmount - The bet amount
   * @param houseEdge - Custom house edge for Limbo
   * @param isRetry - Internal flag to prevent infinite recursion (DO NOT SET MANUALLY)
   */
  async generateLimboOutcome(
    userId: string,
    betAmount: string,
    houseEdge: number,
    isRetry: boolean = false,
  ): Promise<GameOutcome> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get active seed pair and increment nonce
      const result = await queryRunner.manager.query(
        `
        UPDATE games.seed_pairs
        SET nonce = nonce + 1
        WHERE "userId" = $1 AND "isActive" = true
        RETURNING "serverSeed", "clientSeed", nonce, "serverSeedHash"
        `,
        [userId],
      );

      // TypeORM query() returns different formats depending on the query
      // For UPDATE...RETURNING, it returns an array with the first element being the rows
      // When no rows match: result = [[], 0] (empty rows array + affected count)
      // When rows match: result = [[{...data}], 1] (rows array with data + affected count)
      const seedRow = Array.isArray(result[0]) ? result[0][0] : result[0];

      // If no active seed pair exists, create one automatically for seamless first game experience
      if (!seedRow) {
        // Prevent infinite recursion - only allow one retry
        if (isRetry) {
          this.logger.error(
            `Failed to generate Limbo outcome for user ${userId}: ` +
              `Seed pair still missing after creation attempt. This indicates a database constraint ` +
              `or race condition preventing seed pair creation.`,
          );
          throw new Error(
            'Failed to create seed pair for new user. Please try again or contact support.',
          );
        }

        this.logger.log(`No seed pair found for user ${userId}, creating initial seed pair`);

        // Rollback current transaction since we haven't done anything yet
        await queryRunner.rollbackTransaction();
        await queryRunner.release();

        try {
          // Create seed pair using existing method (handles its own transaction)
          const newSeedPair = await this.generateSeedPair(userId);

          // Verify seed pair was actually created
          if (!newSeedPair || !newSeedPair.id) {
            this.logger.error(
              `Failed to create seed pair for user ${userId}: generateSeedPair returned invalid result`,
            );
            throw new Error(
              'Failed to create seed pair for new user. Please try again or contact support.',
            );
          }

          this.logger.log(
            `✅ Created seed pair ${newSeedPair.id} for user ${userId}, retrying once`,
          );

          // Retry the limbo outcome generation ONCE with retry flag set
          return this.generateLimboOutcome(userId, betAmount, houseEdge, true);
        } catch (error) {
          // Handle race condition: another concurrent request may have created the seed pair
          const err = error as { code?: string; message?: string };
          if (err.code === '23505' || err.message?.includes('unique')) {
            this.logger.log(
              `Seed pair created by concurrent request for user ${userId}, retrying Limbo outcome`,
            );
            return this.generateLimboOutcome(userId, betAmount, houseEdge, true);
          }
          throw error;
        }
      }

      const { serverSeed, clientSeed, nonce, serverSeedHash } = seedRow;

      // Validate required fields
      if (!serverSeed || !clientSeed || nonce === undefined || !serverSeedHash) {
        throw new Error(
          `Missing required seed data: serverSeed=${!!serverSeed}, clientSeed=${!!clientSeed}, nonce=${nonce}, serverSeedHash=${!!serverSeedHash}`,
        );
      }

      // Calculate outcome using custom house edge
      const outcome = this.calculateOutcome(
        serverSeed,
        clientSeed,
        nonce.toString(), // Convert bigint to string
        GameTypeEnum.LIMBO,
        houseEdge, // Pass custom house edge
      );

      await queryRunner.commitTransaction();

      return {
        value: outcome.value,
        hash: serverSeedHash,
        nonce: nonce.toString(), // Ensure nonce is string in response
        serverSeed,
        clientSeed,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate Limbo outcome for user ${userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculate game outcome using provably fair algorithm (public for testing)
   */
  public calculateOutcome(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    gameType: GameTypeEnum,
    customHouseEdge?: number,
    cursor?: number,
  ): GameOutcome {
    // Create HMAC using server seed as key
    const hmac = crypto.createHmac('sha512', serverSeed);

    // Update with client seed, nonce, and cursor (if provided)
    const data =
      cursor !== undefined
        ? `${clientSeed}:${nonce}:${cursor}`
        : `${clientSeed}:${nonce}:${gameType}`;
    hmac.update(data);

    const hash = hmac.digest('hex');

    // Convert hash hex to bytes for normalization
    const hashBytes = Buffer.from(hash, 'hex');

    // Use Stake.com's bytes-to-float normalization (first 4 bytes)
    // This algorithm NEVER produces values >= 1.0, preventing division-by-zero in Limbo
    // Formula: Σ(byte[i] / 256^(i+1)) for i = 0 to 3
    // Range: [0, 0.999999999767169) - maximum possible value is ~0.9999999998
    const normalizedValue = this.bytesToFloatService.singleBytesToFloat(hashBytes, 0);

    // Game-specific outcome calculation
    let gameOutcome: number;

    switch (gameType) {
      case GameTypeEnum.CRASH: {
        // Crash game: Use exact same algorithm as CrashService
        // Special hash format for crash: nonce:crash (not clientSeed:nonce:gameType)
        const crashHmac = crypto.createHmac('sha512', serverSeed);
        crashHmac.update(`${nonce}:crash`);
        const crashHash = crashHmac.digest('hex');

        // Use first 8 characters of hash
        const crashHexSubstring = crashHash.substring(0, 8);
        const crashDecimalValue = parseInt(crashHexSubstring, 16);

        // Convert to 0-1 range (using 0xffffffff like CrashService)
        const crashNormalizedValue = crashDecimalValue / 0xffffffff;

        // Get house edge from HouseEdgeService (same as CrashService)
        const houseEdge = this.houseEdgeService.getEdge('crash');
        if (!houseEdge) {
          throw new Error('House edge not found for crash game');
        }

        const houseEdgeDecimal = houseEdge / 100;
        const winProbabilityMultiplier = 1 - houseEdgeDecimal; // (1 - e)

        // Standard CRASH distribution ensuring P(C >= m) = (1 - e) / m
        if (crashNormalizedValue < houseEdgeDecimal) {
          gameOutcome = 1.0;
        } else {
          const adjustedUniform =
            (crashNormalizedValue - houseEdgeDecimal) / winProbabilityMultiplier;
          const safeAdjusted = Math.min(0.9999999999, Math.max(0.0, adjustedUniform));
          gameOutcome = 1 / (1 - safeAdjusted);
          // Cap at same maximum as CrashService (1000x)
          gameOutcome = Math.min(Math.max(gameOutcome, 1.0), 1000);
          // Round to 2 decimal places to match what's stored in database/API
          gameOutcome = Math.round(gameOutcome * 100) / 100;
        }
        break;
      }

      case GameTypeEnum.DICE:
        // Dice game: 0-100.00 range (matches Stake.com exactly)
        // Formula: Math.floor(float × 10001) / 100
        // Range: [0.00, 100.00] with 10,001 possible outcomes
        // This matches Stake.com's official implementation
        gameOutcome = Math.floor(normalizedValue * 10001) / 100;
        break;

      case GameTypeEnum.MINES:
        // Mines: Return the normalized value for grid generation
        gameOutcome = normalizedValue;
        break;

      case GameTypeEnum.PLINKO:
        // Plinko: Return normalized value for path generation
        gameOutcome = normalizedValue;
        break;

      case GameTypeEnum.ROULETTE:
        // Roulette: 0-36 (European roulette)
        gameOutcome = Math.floor(normalizedValue * 37);
        break;

      case GameTypeEnum.BLACKJACK:
        // Blackjack: Return normalized value for card shuffling
        gameOutcome = normalizedValue;
        break;

      case GameTypeEnum.KENO:
        // Keno: Return normalized value for number selection
        gameOutcome = normalizedValue;
        break;

      case GameTypeEnum.LIMBO: {
        // Limbo: Casino-standard exponential distribution with proper house edge
        const houseEdge = customHouseEdge !== undefined ? customHouseEdge : this.defaultHouseEdge;

        // Apply house edge correctly: scale down win probability
        const safeNormalized = Math.max(0.000001, Math.min(0.999999, normalizedValue));

        // Correct formula: outcome = (1 - houseEdge%) / randomValue
        let limboOutcome = (1 - houseEdge / 100) / safeNormalized;

        // Cap at maximum multiplier
        limboOutcome = Math.min(limboOutcome, 1000000);

        // Ensure minimum multiplier
        gameOutcome = Math.max(1.0, limboOutcome);
        break;
      }

      default:
        // Default: return normalized value
        gameOutcome = normalizedValue;
    }

    return {
      value: gameOutcome,
      hash,
      nonce,
      serverSeed,
      clientSeed,
    };
  }

  /**
   * Calculate multiple outcomes using cursor-based provably fair algorithm
   * Useful for games that need multiple random results (Keno, Mines, Blackjack, Plinko)
   */
  public calculateMultipleOutcomes(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    count: number,
    startCursor: number = 0,
  ): number[] {
    const results: number[] = [];

    for (let i = 0; i < count; i++) {
      const cursor = startCursor + i;
      const hmac = crypto.createHmac('sha512', serverSeed);
      const data = `${clientSeed}:${nonce}:${cursor}`;
      hmac.update(data);
      const hash = hmac.digest('hex');

      // Convert hash hex to bytes for normalization
      const hashBytes = Buffer.from(hash, 'hex');

      // Use Stake.com's bytes-to-float normalization (first 4 bytes)
      const normalizedValue = this.bytesToFloatService.singleBytesToFloat(hashBytes, 0);
      results.push(normalizedValue);
    }

    return results;
  }

  /**
   * Generate a single normalized random value using cursor
   * Useful for individual random value generation
   */
  public generateRandomValue(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    cursor: number,
  ): number {
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:${cursor}`;
    hmac.update(data);
    const hash = hmac.digest('hex');

    // Convert hash hex to bytes for normalization
    const hashBytes = Buffer.from(hash, 'hex');

    // Use Stake.com's bytes-to-float normalization (first 4 bytes)
    return this.bytesToFloatService.singleBytesToFloat(hashBytes, 0);
  }

  /**
   * Generate multiple random values efficiently
   */
  public generateMultipleRandomValues(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    count: number,
  ): number[] {
    const values: number[] = [];
    for (let cursor = 0; cursor < count; cursor++) {
      values.push(this.generateRandomValue(serverSeed, clientSeed, nonce, cursor));
    }
    return values;
  }

  /**
   * Verify outcome with cursor
   */
  public verifyOutcome(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: string;
    cursor: number;
    expectedValue: number;
  }): boolean {
    const actualValue = this.generateRandomValue(
      params.serverSeed,
      params.clientSeed,
      params.nonce,
      params.cursor,
    );

    // Use small epsilon for floating point comparison
    const epsilon = 1e-10;
    return Math.abs(actualValue - params.expectedValue) < epsilon;
  }

  /**
   * Verify server seed hash and reveal seed if inactive
   */
  async verifyServerSeedHash(serverSeedHash: string): Promise<{
    isActive: boolean;
    serverSeed?: string;
    error?: string;
  }> {
    try {
      // Find seed pair by server seed hash
      const seedPair = await this.seedPairRepository.findOne({
        where: { serverSeedHash },
      });

      if (!seedPair) {
        return {
          isActive: false,
          error: 'Server seed hash not found',
        };
      }

      if (seedPair.isActive) {
        return {
          isActive: true,
          error: 'Seed is still being used and cannot be revealed',
        };
      }

      return {
        isActive: false,
        serverSeed: seedPair.serverSeed,
      };
    } catch (error) {
      this.logger.error('Failed to verify server seed hash:', error);
      return {
        isActive: false,
        error: 'Failed to verify server seed hash',
      };
    }
  }

  /**
   * Get seed pair history for a user with pagination
   */
  async getSeedPairHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    seedPairs: {
      id: number;
      serverSeed: string;
      serverSeedHash: string;
      clientSeed: string;
      nonce: string;
      createdAt: Date;
      revealedAt: Date;
      totalGames: number;
    }[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  }> {
    const offset = (page - 1) * limit;

    // Get revealed seed pairs with pagination
    const queryBuilder = this.seedPairRepository
      .createQueryBuilder('seedPair')
      .where('seedPair.userId = :userId', { userId })
      .andWhere('seedPair.isActive = :isActive', { isActive: false })
      .andWhere('seedPair.revealedAt IS NOT NULL')
      .orderBy('seedPair.revealedAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [seedPairs, total] = await queryBuilder.getManyAndCount();

    // Transform to response format
    const formattedSeedPairs = seedPairs.map((pair) => ({
      id: pair.id,
      serverSeed: pair.serverSeed,
      serverSeedHash: pair.serverSeedHash,
      clientSeed: pair.clientSeed,
      nonce: pair.nonce,
      createdAt: pair.createdAt,
      revealedAt: pair.revealedAt!,
      totalGames: parseInt(pair.nonce) || 0,
    }));

    const hasNext = offset + limit < total;

    return {
      seedPairs: formattedSeedPairs,
      total,
      page,
      limit,
      hasNext,
    };
  }
}
