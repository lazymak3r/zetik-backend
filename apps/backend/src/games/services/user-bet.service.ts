import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  GAME_DISPLAY_NAMES,
  GameTypeEnum,
  UserBetEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { RedisService } from '../../common/services/redis.service';
import { BetHistorySortEnum } from '../dto/get-user-bet-history-query.dto';

export interface ICreateUserBetInput {
  game: GameTypeEnum;
  betId: string;
  userId: string;
  betAmount: string;
  asset: string;
  multiplier: string;
  payout?: string; // Optional - will be calculated automatically from betAmount and multiplier
  betAmountUsd?: string; // Optional - USD equivalent of bet amount
  payoutUsd?: string; // Optional - USD equivalent of payout
  userName?: string; // Optional - user name for cache
  isPrivate?: boolean; // Optional - is user private for cache
  gameName?: string; // Optional - custom game name (e.g., sport_id for sportsbook)
  // Fiat currency fields for preserving exact user input
  originalFiatAmount?: string; // The exact fiat amount user entered
  originalFiatCurrency?: CurrencyEnum; // The user's selected fiat currency
  fiatToUsdRate?: string; // Exchange rate used at time of bet
}

export interface IGetUserBetsInput {
  userId: string;
  limit?: number;
  offset?: number;
  gameTypes?: GameTypeEnum[];
  gameName?: string;
  sortBy?: BetHistorySortEnum;
}

/**
 * Event payload for 'user-bet.created' event
 * Now includes the full UserBetEntity for bet-feed-service and other consumers
 * Backward compatible: existing listeners can still access userId, betAmountUsd, payoutUsd
 */
export interface IUserBetCreatedEvent extends Partial<UserBetEntity> {
  // Required fields for backward compatibility
  userId: string;
  betAmountUsd: string;
  payoutUsd: string;

  // Full entity fields available (from UserBetEntity):
  // game, gameName, betId, betAmount, asset, multiplier, payout, createdAt, etc.
}

@Injectable()
export class UserBetService {
  private readonly logger = new Logger(UserBetService.name);

  constructor(
    @InjectRepository(UserBetEntity)
    private readonly userBetRepository: Repository<UserBetEntity>,
    private readonly cryptoConverterService: CryptoConverterService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {}

  async createUserBet(input: ICreateUserBetInput): Promise<UserBetEntity> {
    // Calculate USD values if not provided
    const betAmountUsd =
      input.betAmountUsd ||
      this.cryptoConverterService.toUsd(input.betAmount, input.asset as AssetTypeEnum);

    const payoutAmount = input.payout || '0';
    const payoutUsd =
      input.payoutUsd ||
      this.cryptoConverterService.toUsd(payoutAmount, input.asset as AssetTypeEnum);

    // Use values as provided by game services (they now calculate correct display values)
    const userBet = this.userBetRepository.create({
      game: input.game,
      gameName: input.gameName || GAME_DISPLAY_NAMES[input.game] || input.game,
      betId: input.betId,
      userId: input.userId,
      betAmount: input.betAmount,
      asset: input.asset as AssetTypeEnum,
      multiplier: input.multiplier, // Use multiplier as provided by game service
      payout: payoutAmount, // Use payout as provided, fallback to '0'
      betAmountUsd,
      payoutUsd,
      // Fiat currency fields for preserving exact user input
      originalFiatAmount: input.originalFiatAmount,
      originalFiatCurrency: input.originalFiatCurrency,
      fiatToUsdRate: input.fiatToUsdRate,
    });

    await this.userBetRepository.save(userBet);

    // Emit event with full bet entity for bet-feed-service
    // Includes all entity fields plus USD values for backward compatibility
    this.eventEmitter.emit('user-bet.created', {
      ...userBet, // Spread full UserBetEntity with all fields
      betAmountUsd, // Add USD values for backward compatibility
      payoutUsd, // Existing listeners (UserBetCacheService) only use userId, betAmountUsd, payoutUsd
    });

    // Publish raw bet entity to Redis pub/sub for bet-feed-service
    // BetFeedService (single-instance microservice) will handle all feed-specific logic:
    // - Tab qualification (all-bets, lucky-winners, zetiks)
    // - Feed item conversion (user info, VIP status, etc.)
    // - Redis cache updates
    // - WebSocket broadcasting
    await this.publishRawBetToRedis(userBet, betAmountUsd, payoutUsd).catch((error) => {
      this.logger.error(`Failed to publish bet ${input.betId} to Redis:`, error);
      // Don't throw - graceful degradation
    });

    this.logger.log(
      `Created user bet: ${input.game}:${input.betId} for user ${input.userId} ` +
        `(${GAME_DISPLAY_NAMES[input.game]}) - Bet: ${input.betAmount} (${betAmountUsd} USD), ` +
        `Multiplier: ${input.multiplier}x, Payout: ${payoutAmount} (${payoutUsd} USD)`,
    );

    return userBet;
  }

  async getUserBets(input: IGetUserBetsInput): Promise<{
    bets: UserBetEntity[];
    total: number;
  }> {
    const query = this.userBetRepository
      .createQueryBuilder('bet')
      .where('bet.userId = :userId', { userId: input.userId });

    // Filtering by game types and game name
    if (input.gameTypes && input.gameTypes.length > 0) {
      query.andWhere('bet.game IN (:...gameTypes)', { gameTypes: input.gameTypes });
    }
    if (input.gameName) {
      query.andWhere('bet.gameName = :gameName', { gameName: input.gameName });
    }

    // Sorting by date or amount
    if (input.sortBy === BetHistorySortEnum.AMOUNT) {
      query.orderBy('bet.betAmountUsd', 'DESC');
    } else {
      query.orderBy('bet.createdAt', 'DESC');
    }

    if (input.limit) {
      query.limit(input.limit);
    }
    if (input.offset !== undefined) {
      query.offset(input.offset);
    }

    const [bets, total] = await query.getManyAndCount();

    return { bets, total };
  }

  async getUserBetById(game: GameTypeEnum, betId: string): Promise<UserBetEntity | null> {
    return await this.userBetRepository.findOne({
      where: { game, betId },
    });
  }

  /**
   * Publish raw bet entity to Redis pub/sub for bet-feed-service
   * BetFeedService (single-instance microservice) handles all processing:
   * - Tab qualification determination
   * - Feed item conversion (user info, VIP status, etc.)
   * - Redis cache updates
   * - WebSocket broadcasting to clients
   *
   * This clean separation of concerns means:
   * - Game logic stays in main backend
   * - Feed presentation logic stays in bet-feed-service
   * - Changes to feed rules don't require main backend deployment
   * - Easier to test feed logic in isolation
   */
  private async publishRawBetToRedis(
    userBet: UserBetEntity,
    betAmountUsd: string,
    payoutUsd: string,
  ): Promise<void> {
    try {
      // Publish raw bet entity to 'user-bet.created' channel
      // BetFeedService subscribes to this channel and does all the processing
      const redis = this.redisService.getClient();
      await redis.publish(
        'user-bet.created',
        JSON.stringify({
          ...userBet,
          betAmountUsd, // Include USD values for convenience
          payoutUsd,
        }),
      );

      this.logger.debug(`📡 Published raw bet ${userBet.betId} to Redis pub/sub`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish bet ${userBet.betId} to Redis:`, error);
      throw error;
    }
  }
}
