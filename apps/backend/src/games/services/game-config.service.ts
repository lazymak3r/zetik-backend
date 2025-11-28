import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, BetTypeCategory, GameBetTypeLimitsEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { FiatRateService } from '../../balance/services/fiat-rate.service';
import { RedisService } from '../../common/services/redis.service';
import { GameBetLimitsEntity } from '../entities/game-bet-limits.entity';
import { GameConfigEntity, GameStatus, GameType } from '../entities/game-config.entity';
import { BetLimitsResponse, BetValidationResponse } from '../types/game-config.types';

@Injectable()
export class GameConfigService implements OnModuleInit {
  private readonly logger = new Logger(GameConfigService.name);
  private readonly cacheEnabled = true;
  private readonly cacheTtl = 300; // 5 minutes cache

  // In-memory fallback cache for when Redis is unavailable
  private readonly memoryCache = new Map<string, { data: any; expiry: number }>();

  constructor(
    @InjectRepository(GameConfigEntity)
    private readonly gameConfigRepo: Repository<GameConfigEntity>,
    @InjectRepository(GameBetLimitsEntity)
    private readonly betLimitsRepo: Repository<GameBetLimitsEntity>,
    @InjectRepository(GameBetTypeLimitsEntity)
    private readonly betTypeLimitsRepo: Repository<GameBetTypeLimitsEntity>,
    private readonly redisService: RedisService,
    private readonly cryptoConverterService: CryptoConverterService,
    private readonly fiatRateService: FiatRateService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing simplified GameConfigService...');

    // Preload bet limits
    await this.preloadBetLimits();

    this.logger.log('GameConfigService initialized successfully');
  }

  /**
   * Check if a game is enabled
   */
  async isGameEnabled(gameType: GameType): Promise<boolean> {
    const cacheKey = `game_enabled:${gameType}`;

    try {
      // Try cache first
      const cached = await this.getCachedData<boolean>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Fetch from database
      const config = await this.gameConfigRepo.findOne({
        where: { gameType },
        select: ['status'],
      });

      const isEnabled = config?.status === GameStatus.ENABLED;

      // Cache the result
      await this.setCachedData(cacheKey, isEnabled);

      return isEnabled;
    } catch (error) {
      this.logger.error(`Error checking if game ${gameType} is enabled:`, error);
      throw error; // Throw error instead of fallback
    }
  }

  /**
   * Get USD-based bet limits for a specific game type
   */
  async getBetLimitsUsd(gameType: GameType): Promise<BetLimitsResponse> {
    const cacheKey = `bet_limits_usd:${gameType}`;

    try {
      // Try cache first
      const cached = await this.getCachedData<BetLimitsResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const limits = await this.betLimitsRepo.findOne({
        where: {
          gameType,
          isActive: true,
        },
      });

      if (!limits) {
        throw new Error(`No bet limits found for game type: ${gameType}`);
      }

      const response: BetLimitsResponse = {
        gameType: limits.gameType,
        minBetUsd: Number(limits.minBetUsd),
        maxBetUsd: Number(limits.maxBetUsd),
        maxPayoutUsd: Number(limits.maxPayoutUsd),
        isActive: limits.isActive,
      };

      // Cache the result
      await this.setCachedData(cacheKey, response);

      return response;
    } catch (error) {
      this.logger.error(`Error getting bet limits for ${gameType}:`, error);
      throw error; // Throw error instead of fallback
    }
  }

  /**
   * Validate bet amount in USD equivalent
   */
  async validateBetAmount(
    gameType: GameType,
    betAmount: string,
    asset: AssetTypeEnum,
  ): Promise<BetValidationResponse>;
  async validateBetAmount(
    gameType: GameType,
    betAmount: string,
    asset: AssetTypeEnum,
    userCurrency: CurrencyEnum,
  ): Promise<BetValidationResponse>;
  async validateBetAmount(
    gameType: GameType,
    betAmount: string,
    asset: AssetTypeEnum,
    userCurrency?: CurrencyEnum,
  ): Promise<BetValidationResponse> {
    try {
      const betAmountNum = parseFloat(betAmount);
      if (isNaN(betAmountNum) || betAmountNum < 0) {
        return { isValid: false, error: 'Invalid bet amount' };
      }

      // Allow 0 amount bets for demo mode
      if (betAmountNum === 0) {
        return { isValid: true, usdAmount: 0 };
      }

      // Convert bet amount to USD
      const usdAmount = this.cryptoConverterService.convertToUsd(betAmountNum, asset);
      if (usdAmount === null) {
        return { isValid: false, error: 'Failed to convert bet amount to USD' };
      }

      // Get bet limits
      const limits = await this.getBetLimitsUsd(gameType);

      if (usdAmount < limits.minBetUsd) {
        // Convert USD limits back to user's asset for clearer error messages
        const minBetInAsset = this.cryptoConverterService.convertFromUsd(limits.minBetUsd, asset);
        const assetSymbol = asset.toUpperCase();

        // If user has a fiat currency preference, show limit in that currency too
        let fiatLimitDisplay = '';
        if (userCurrency && userCurrency !== CurrencyEnum.USD) {
          const minBetInUserCurrency = this.fiatRateService.convertFromUsd(
            limits.minBetUsd,
            userCurrency,
          );
          fiatLimitDisplay = ` (${minBetInUserCurrency.toFixed(2)} ${userCurrency})`;
        }

        return {
          isValid: false,
          error:
            minBetInAsset !== null
              ? `Bet amount too small. Minimum: ${minBetInAsset.toFixed(8)} ${assetSymbol} ($${limits.minBetUsd.toFixed(2)} USD${fiatLimitDisplay})`
              : `Bet amount too small. Minimum: $${limits.minBetUsd.toFixed(2)} USD${fiatLimitDisplay}`,
          usdAmount,
        };
      }

      if (usdAmount > limits.maxBetUsd) {
        // Convert USD limits back to user's asset for clearer error messages
        const maxBetInAsset = this.cryptoConverterService.convertFromUsd(limits.maxBetUsd, asset);
        const assetSymbol = asset.toUpperCase();

        // If user has a fiat currency preference, show limit in that currency too
        let fiatLimitDisplay = '';
        if (userCurrency && userCurrency !== CurrencyEnum.USD) {
          const maxBetInUserCurrency = this.fiatRateService.convertFromUsd(
            limits.maxBetUsd,
            userCurrency,
          );
          fiatLimitDisplay = ` (${maxBetInUserCurrency.toFixed(2)} ${userCurrency})`;
        }

        return {
          isValid: false,
          error:
            maxBetInAsset !== null
              ? `Bet amount too large. Maximum: ${maxBetInAsset.toFixed(8)} ${assetSymbol} ($${limits.maxBetUsd.toFixed(2)} USD${fiatLimitDisplay})`
              : `Bet amount too large. Maximum: $${limits.maxBetUsd.toFixed(2)} USD${fiatLimitDisplay}`,
          usdAmount,
        };
      }

      return { isValid: true, usdAmount };
    } catch (error) {
      this.logger.error(`Error validating bet amount for ${gameType}:`, error);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Get all bet limits
   */
  async getAllBetLimits(): Promise<BetLimitsResponse[]> {
    const cacheKey = 'all_bet_limits';

    try {
      // Try cache first
      const cached = await this.getCachedData<BetLimitsResponse[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      this.logger.debug('Cache miss for all bet limits, fetching from DB');
      const limits = await this.betLimitsRepo.find({
        where: { isActive: true },
        order: { gameType: 'ASC' },
      });

      const response = limits.map((limit) => ({
        gameType: limit.gameType,
        minBetUsd: Number(limit.minBetUsd),
        maxBetUsd: Number(limit.maxBetUsd),
        maxPayoutUsd: Number(limit.maxPayoutUsd),
        isActive: limit.isActive,
      }));

      // Cache the result
      await this.setCachedData(cacheKey, response);

      return response;
    } catch (error) {
      this.logger.error('Error getting all bet limits:', error);
      throw error; // Throw error instead of fallback
    }
  }

  /**
   * Update bet limits for a game type
   */
  async updateBetLimits(
    gameType: GameType,
    minBetUsd: number,
    maxBetUsd: number,
    updatedBy?: string,
  ): Promise<void> {
    try {
      await this.betLimitsRepo.update(
        { gameType },
        {
          minBetUsd,
          maxBetUsd,
          updatedBy,
        },
      );

      // Clear cache
      await this.clearBetLimitsCache(gameType);

      this.logger.log(`Updated bet limits for ${gameType}: $${minBetUsd} - $${maxBetUsd}`);
    } catch (error) {
      this.logger.error(`Error updating bet limits for ${gameType}:`, error);
      throw error;
    }
  }

  /**
   * Clear bet limits cache for a specific game type
   */
  private async clearBetLimitsCache(gameType: GameType): Promise<void> {
    const keys = [`bet_limits_usd:${gameType}`, 'all_bet_limits'];

    await Promise.all(keys.map((key) => this.redisService.del(key)));

    // Also clear from memory cache
    keys.forEach((key) => this.memoryCache.delete(key));
  }

  /**
   * Refresh cache for specific game type or all bet limits
   */
  async refreshCache(gameType?: GameType): Promise<void> {
    this.logger.log(`Refreshing cache${gameType ? ` for ${gameType}` : ' for all games'}`);

    try {
      if (gameType) {
        // Clear specific game cache
        await this.clearBetLimitsCache(gameType);

        // Preload specific game configuration
        await this.getBetLimitsUsd(gameType);
      } else {
        // Clear all cache
        await this.clearAllCache();

        // Preload all configurations
        await this.preloadBetLimits();
      }

      this.logger.log(`Cache refresh completed${gameType ? ` for ${gameType}` : ' for all games'}`);
    } catch (error) {
      this.logger.error(`Error refreshing cache${gameType ? ` for ${gameType}` : ''}:`, error);
    }
  }

  /**
   * Preload bet limits into cache
   */
  private async preloadBetLimits(): Promise<void> {
    const gameTypes = Object.values(GameType);

    this.logger.log(`Preloading bet limits for ${gameTypes.length} game types`);

    const preloadPromises = gameTypes.map(async (gameType) => {
      try {
        await this.getBetLimitsUsd(gameType);
      } catch (error) {
        this.logger.warn(`Failed to preload bet limits for ${gameType}:`, error);
      }
    });

    await Promise.all(preloadPromises);
    this.logger.log('Bet limits preloading completed');
  }

  /**
   * Get cached data with fallback to memory cache
   */
  private async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.cacheEnabled) {
      return null;
    }

    try {
      // Try Redis first
      const redisData = await this.redisService.get(key);
      if (redisData) {
        return JSON.parse(redisData);
      }
    } catch (error) {
      this.logger.warn(`Redis cache read error for key ${key}:`, error);
    }

    // Fallback to memory cache
    const memoryData = this.memoryCache.get(key);
    if (memoryData && memoryData.expiry > Date.now()) {
      return memoryData.data;
    }

    return null;
  }

  /**
   * Set cached data with fallback to memory cache
   */
  private async setCachedData<T>(key: string, data: T): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    const serialized = JSON.stringify(data);

    try {
      // Try Redis first
      await this.redisService.set(key, serialized, this.cacheTtl);
    } catch (error) {
      this.logger.warn(`Redis cache write error for key ${key}:`, error);
    }

    // Always set in memory cache as fallback
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + this.cacheTtl * 1000,
    });

    // Clean up expired memory cache entries periodically
    this.cleanMemoryCache();
  }

  /**
   * Clear all cache
   */
  private async clearAllCache(): Promise<void> {
    try {
      // Clear Redis cache with game config pattern
      const keys = await this.redisService.keys('bet_limits_*');
      keys.push('all_bet_limits');

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redisService.del(key)));
      }
    } catch (error) {
      this.logger.warn(`Error clearing cache:`, error);
    }

    // Clear memory cache
    this.memoryCache.clear();
  }

  /**
   * Clean expired memory cache entries
   */
  private cleanMemoryCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.memoryCache.forEach((value, key) => {
      if (value.expiry < now) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => this.memoryCache.delete(key));
  }

  /**
   * Get bet type limits for a specific game and bet type category
   */
  async getBetTypeLimits(
    gameType: GameType,
    betTypeCategory: BetTypeCategory,
  ): Promise<{
    minBetUsd: number;
    maxBetUsd: number;
    description: string;
  } | null> {
    const cacheKey = `bet_type_limits:${gameType}:${betTypeCategory}`;

    try {
      // Try cache first
      const cached = await this.getCachedData<any>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      this.logger.debug(
        `Cache miss for bet type limits: ${gameType}:${betTypeCategory}, fetching from DB`,
      );
      const limits = await this.betTypeLimitsRepo.findOne({
        where: {
          gameType,
          betTypeCategory,
          isActive: true,
        },
      });

      if (!limits) {
        return null;
      }

      const response = {
        minBetUsd: Number(limits.minBetUsd),
        maxBetUsd: Number(limits.maxBetUsd),
        description: limits.description,
      };

      // Cache the result
      await this.setCachedData(cacheKey, response);

      return response;
    } catch (error) {
      this.logger.error(`Error getting bet type limits for ${gameType}:${betTypeCategory}:`, error);
      return null;
    }
  }

  /**
   * Validate bet amount against bet type limits
   */
  async validateBetTypeAmount(
    gameType: GameType,
    betTypeCategory: BetTypeCategory,
    betAmount: string,
    asset: AssetTypeEnum,
  ): Promise<BetValidationResponse>;
  async validateBetTypeAmount(
    gameType: GameType,
    betTypeCategory: BetTypeCategory,
    betAmount: string,
    asset: AssetTypeEnum,
    userCurrency: CurrencyEnum,
  ): Promise<BetValidationResponse>;
  async validateBetTypeAmount(
    gameType: GameType,
    betTypeCategory: BetTypeCategory,
    betAmount: string,
    asset: AssetTypeEnum,
    userCurrency?: CurrencyEnum,
  ): Promise<BetValidationResponse> {
    try {
      const betAmountNum = parseFloat(betAmount);
      if (isNaN(betAmountNum) || betAmountNum < 0) {
        return { isValid: false, error: 'Invalid bet amount' };
      }

      // Allow 0 amount bets for demo mode
      if (betAmountNum === 0) {
        return { isValid: true, usdAmount: 0 };
      }

      // Convert bet amount to USD
      const usdAmount = this.cryptoConverterService.convertToUsd(betAmountNum, asset);
      if (usdAmount === null) {
        return { isValid: false, error: 'Failed to convert bet amount to USD' };
      }

      // Get bet type limits
      const limits = await this.getBetTypeLimits(gameType, betTypeCategory);
      if (!limits) {
        // Fall back to general game limits if no bet type limits exist
        return userCurrency
          ? this.validateBetAmount(gameType, betAmount, asset, userCurrency)
          : this.validateBetAmount(gameType, betAmount, asset);
      }

      if (usdAmount < limits.minBetUsd) {
        // Convert USD limits back to user's asset for clearer error messages
        const minBetInAsset = this.cryptoConverterService.convertFromUsd(limits.minBetUsd, asset);
        const assetSymbol = asset.toUpperCase();

        // If user has a fiat currency preference, show limit in that currency too
        let fiatLimitDisplay = '';
        if (userCurrency && userCurrency !== CurrencyEnum.USD) {
          const minBetInUserCurrency = this.fiatRateService.convertFromUsd(
            limits.minBetUsd,
            userCurrency,
          );
          fiatLimitDisplay = ` (${minBetInUserCurrency.toFixed(2)} ${userCurrency})`;
        }

        return {
          isValid: false,
          error:
            minBetInAsset !== null
              ? `${limits.description}: Bet amount too small. Minimum: ${minBetInAsset.toFixed(8)} ${assetSymbol} ($${limits.minBetUsd.toFixed(2)} USD${fiatLimitDisplay})`
              : `${limits.description}: Bet amount too small. Minimum: $${limits.minBetUsd.toFixed(2)} USD${fiatLimitDisplay}`,
          usdAmount,
        };
      }

      if (usdAmount > limits.maxBetUsd) {
        // Convert USD limits back to user's asset for clearer error messages
        const maxBetInAsset = this.cryptoConverterService.convertFromUsd(limits.maxBetUsd, asset);
        const assetSymbol = asset.toUpperCase();

        // If user has a fiat currency preference, show limit in that currency too
        let fiatLimitDisplay = '';
        if (userCurrency && userCurrency !== CurrencyEnum.USD) {
          const maxBetInUserCurrency = this.fiatRateService.convertFromUsd(
            limits.maxBetUsd,
            userCurrency,
          );
          fiatLimitDisplay = ` (${maxBetInUserCurrency.toFixed(2)} ${userCurrency})`;
        }

        return {
          isValid: false,
          error:
            maxBetInAsset !== null
              ? `${limits.description}: Bet amount too large. Maximum: ${maxBetInAsset.toFixed(8)} ${assetSymbol} ($${limits.maxBetUsd.toFixed(2)} USD${fiatLimitDisplay})`
              : `${limits.description}: Bet amount too large. Maximum: $${limits.maxBetUsd.toFixed(2)} USD${fiatLimitDisplay}`,
          usdAmount,
        };
      }

      return { isValid: true, usdAmount };
    } catch (error) {
      this.logger.error(
        `Error validating bet type amount for ${gameType}:${betTypeCategory}:`,
        error,
      );
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Get all bet type limits for a game
   */
  async getAllBetTypeLimitsForGame(gameType: GameType): Promise<
    Partial<
      Record<
        BetTypeCategory,
        {
          minBetUsd: number;
          maxBetUsd: number;
          description: string;
        }
      >
    >
  > {
    const cacheKey = `all_bet_type_limits:${gameType}`;

    try {
      // Try cache first
      const cached = await this.getCachedData<any>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const limits = await this.betTypeLimitsRepo.find({
        where: { gameType, isActive: true },
      });

      const response: Record<string, any> = {};
      limits.forEach((limit) => {
        response[limit.betTypeCategory] = {
          minBetUsd: Number(limit.minBetUsd),
          maxBetUsd: Number(limit.maxBetUsd),
          description: limit.description,
        };
      });

      // Cache the result
      await this.setCachedData(cacheKey, response);

      return response;
    } catch (error) {
      this.logger.error(`Error getting all bet type limits for ${gameType}:`, error);
      return {};
    }
  }
}
