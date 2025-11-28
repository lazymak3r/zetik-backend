import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  GameTypeEnum,
  UserBetEntity,
  UserEntity,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { DataSource } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { providerGamesConfig } from '../config/provider-games.config';
import { UsersService } from '../users/users.service';
import { toCents } from '../utils/toCents';
import { St8BalanceDto } from './dto/st8-balance.dto';
import { St8BuyinDto } from './dto/st8-buyin.dto';
import { St8CancelBaseDto, St8CancelExtendedDto } from './dto/st8-cancel.dto';
import { St8PayoutDto } from './dto/st8-payout.dto';
import { St8PlayerProfileDto } from './dto/st8-player-profile.dto';
import { St8TransactionDto } from './dto/st8-transaction.dto';
import { St8ProviderTransactionEnum, St8ResponseStatusEnum } from './enums/st8.enum';
import { GameSessionService } from './game-session.service';
import {
  ISt8ErrorResponse,
  ISt8PlayerProfileResponse,
  ISt8SuccessBalanceResponse,
} from './interfaces/st8-response.interface';
import {
  ISt8GamesResponse,
  ISt8LaunchGameInput,
  ISt8LaunchGameResponse,
  St8Jurisdiction,
} from './interfaces/st8-types.interface';
import { ProviderHouseEdgeService } from './services/provider-house-edge.service';
import { St8ApiClient } from './st8-api-client.service';

const country = 'AM'; // todo: remove hardcode
const language = 'eng'; // todo: remove hardcode
const device = 'DESKTOP'; // todo: remove hardcode
const jurisdiction = St8Jurisdiction.CW; // todo: remove hardcode
const birthDate = '1990-01-01'; // todo: remove hardcode

@Injectable()
export class St8Service {
  private readonly logger = new Logger(St8Service.name);
  private readonly MAX_GAME_NAME_LENGTH = 50;
  private readonly config = providerGamesConfig();

  constructor(
    private readonly gameSessionService: GameSessionService,
    private readonly userService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly providerHouseEdgeService: ProviderHouseEdgeService,
    private readonly st8ApiClient: St8ApiClient,
    private readonly eventEmitter: EventEmitter2,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getLaunchGameUrl(
    user: UserEntity,
    gameCode: string,
    funMode?: boolean,
  ): Promise<ISt8LaunchGameResponse> {
    try {
      const gameSession = await this.gameSessionService.createGameSession(
        user.id,
        user.currentCurrency,
        gameCode,
      );

      // simple routing between different ST8 environments
      // @ts-expect-error due to strange logic of includes method
      const config = this.config.st8.supportedCurrencies.includes(user.currentCurrency)
        ? this.config.st8
        : this.config.st8Asian;

      const payload: ISt8LaunchGameInput = {
        game_code: gameCode,
        currency: user.currentCurrency,
        site: {
          id: config.operatorSiteCode,
          lobby: config.operatorSite,
          deposit: config.operatorSiteDepositUrl,
        },
        token: gameSession.id,
        player: String(user.id),
        country,
        lang: language,
        device,
        fun_mode: funMode ?? false,
        player_profile: {
          id: String(user.id),
          jurisdiction,
          default_currency: user.currentCurrency,
          reg_country: country,
          affiliate: null,
          bet_limits: 'low',
          birth_date: birthDate,
          reg_date: (user.createdAt ? new Date(user.createdAt) : new Date())
            .toISOString()
            .split('T')[0],
          attributes: { labels: [] },
        },
      };

      this.logger.debug(`Fetching launch game URL from ST8 API by game code ${gameCode}`);

      const data = await this.st8ApiClient.launchGame(payload, user.currentCurrency);
      this.logger.verbose(`Retrieved launch game URL: ${data?.game_url}`);

      this.gameSessionService
        .updateStatusToStarted(gameSession.id)
        .catch((e) => this.logger.error(e));

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to get launch game URL: ${errorMessage}`, errorStack);
      throw new Error(`Failed to get launch game URL: ${errorMessage}`);
    }
  }

  async getGames(): Promise<ISt8GamesResponse> {
    try {
      this.logger.log(`Fetching games from ST8 API`);

      const data = await this.st8ApiClient.getGames();
      this.logger.log(
        `Retrieved ${data.games?.length || 0} games, ${data.developers?.length || 0} developers, and ${data.categories?.length || 0} categories`,
      );

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Failed to get games from ST8: ${errorMessage}`, errorStack);
      throw new Error(`Failed to get games from ST8: ${errorMessage}`);
    }
  }

  async getUserProfile(
    body: St8PlayerProfileDto,
  ): Promise<ISt8PlayerProfileResponse | ISt8ErrorResponse> {
    const user = await this.userService.findById(body.player);
    if (!user) {
      return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
    }

    if (user.isBanned) {
      return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
    }

    return {
      status: St8ResponseStatusEnum.OK,
      id: user.id,
      jurisdiction: jurisdiction, // TODO
      default_currency: user.currentCurrency,
      reg_country: country, // TODO
      affiliate: null,
      bet_limits: 'low', // TODO
      birth_date: birthDate, // TODO
      reg_date: (user.createdAt ? new Date(user.createdAt) : new Date())
        .toISOString()
        .split('T')[0],
      attributes: {
        labels: [],
      },
    };
  }

  async getBalance(body: St8BalanceDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      const balance = await this.balanceService.getFiatBalance(user.id);

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to get balance for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  async debit(body: St8TransactionDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      // Check if this operation already exists (idempotency)
      const existingOperation = await this.getFiatBalanceByOperationId(
        body.transaction_id,
        user.id,
        body.currency,
      );

      if (existingOperation) {
        this.logger.log(
          `Operation ${body.transaction_id} already exists, returning existing result`,
        );
        return existingOperation;
      }

      const operation =
        body.provider_kind === St8ProviderTransactionEnum.CORRECTION_DEBIT
          ? BalanceOperationEnum.CORRECTION_DEBIT
          : BalanceOperationEnum.BET;

      // Get house edge for provider game (only for BET operations)
      let houseEdge: number | undefined;
      if (operation === BalanceOperationEnum.BET) {
        houseEdge = await this.providerHouseEdgeService.getHouseEdgeByGameCode(body.game_code);
      }

      const result = await this.balanceService.updateFiatBalance({
        userId: user.id,
        operation,
        operationId: body.transaction_id,
        amount: toCents(body.amount),
        currency: user.currentCurrency,
        description: `St8 debit for game ${body.game_code}`,
        houseEdge,
        metadata: {
          round: body.round,
          gameCode: body.game_code,
          developerCode: body.developer_code,
          providerKind: body.provider_kind,
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        this.logger.error(`Failed to debit balance: ${result.status}`);

        // Special handling for OPERATION_EXISTS (idempotency)
        if (result.status === BalanceOperationResultEnum.OPERATION_EXISTS) {
          const existingResult = await this.getFiatBalanceByOperationId(
            body.transaction_id,
            user.id,
            body.currency,
          );

          if (existingResult) {
            return existingResult;
          }
        }

        return { status: this.mapBalanceStatusToSt8Status(result.status) };
      }

      this.gameSessionService
        .incrementBetAmount(body.token, body.amount)
        .catch((e) => this.logger.error(e));

      // Get primary wallet asset for bet recording (single DB query)
      const primaryWallet = await this.balanceService.getPrimaryWallet(user.id);
      const asset = primaryWallet?.asset || AssetTypeEnum.BTC;
      if (!primaryWallet?.asset) {
        this.logger.error(
          `Primary wallet not found for user ${user.id} - critical data integrity issue. Falling back to BTC.`,
        );
      }

      // Persist provider bet into games.user_bets (idempotent)
      this.recordProviderDebit(user.id, body, asset).catch((e) => this.logger.error(e));

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(result.balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to process debit for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  async credit(body: St8TransactionDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      // Check if this operation already exists (idempotency)
      const existingOperation = await this.getFiatBalanceByOperationId(
        body.transaction_id,
        user.id,
        body.currency,
      );

      if (existingOperation) {
        this.logger.log(
          `Operation ${body.transaction_id} already exists, returning existing result`,
        );
        return existingOperation;
      }

      this.gameSessionService
        .incrementWinAmount(body.token, body.amount)
        .catch((e) => this.logger.error(e));

      // Get house edge for provider game (for consistency, though WIN operations don't affect rakeback)
      const houseEdge = await this.providerHouseEdgeService.getHouseEdgeByGameCode(body.game_code);

      const result = await this.balanceService.updateFiatBalance({
        userId: user.id,
        operation: BalanceOperationEnum.WIN,
        operationId: body.transaction_id,
        amount: toCents(body.amount),
        currency: user.currentCurrency,
        description: `St8 credit for game ${body.game_code}`,
        houseEdge,
        metadata: {
          round: body.round,
          gameCode: body.game_code,
          developerCode: body.developer_code,
          providerKind: body.provider_kind,
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        this.logger.error(`Failed to credit balance: ${result.status}`);

        // Special handling for OPERATION_EXISTS (idempotency)
        if (result.status === BalanceOperationResultEnum.OPERATION_EXISTS) {
          const existingResult = await this.getFiatBalanceByOperationId(
            body.transaction_id,
            user.id,
            body.currency,
          );

          if (existingResult) {
            return existingResult;
          }
        }

        return { status: this.mapBalanceStatusToSt8Status(result.status) };
      }

      // Get primary wallet asset for bet recording (single DB query)
      const primaryWallet = await this.balanceService.getPrimaryWallet(user.id);
      const asset = primaryWallet?.asset || AssetTypeEnum.BTC;
      if (!primaryWallet?.asset) {
        this.logger.error(
          `Primary wallet not found for user ${user.id} - critical data integrity issue. Falling back to BTC.`,
        );
      }

      // Apply payout to provider bet row (idempotent update)
      this.recordProviderCredit(user.id, body, asset).catch((e) => this.logger.error(e));

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(result.balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to process credit for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  async buyin(body: St8BuyinDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      const operation =
        body.provider_kind === St8ProviderTransactionEnum.CORRECTION_DEBIT
          ? BalanceOperationEnum.CORRECTION_BUYIN
          : BalanceOperationEnum.BET;

      const result = await this.balanceService.updateFiatBalance({
        userId: user.id,
        operation,
        operationId: body.transaction_id,
        amount: toCents(body.amount),
        currency: user.currentCurrency,
        description: `St8 buyin${body.game_code ? ` for game ${body.game_code}` : ''}`,
        metadata: {
          gameCode: body.game_code,
          developerCode: body.developer_code,
          providerKind: body.provider_kind,
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        this.logger.error(`Failed to process buyin: ${result.status}`);
        return { status: this.mapBalanceStatusToSt8Status(result.status) };
      }

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(result.balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to process buyin for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  async payout(body: St8PayoutDto): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      const result = await this.balanceService.updateFiatBalance({
        userId: user.id,
        operation: BalanceOperationEnum.PAYOUT,
        operationId: body.transaction_id,
        amount: toCents(body.amount),
        currency: user.currentCurrency,
        description: `St8 payout${body.game_code ? ` for game ${body.game_code}` : ''}`,
        metadata: {
          gameCode: body.game_code,
          developerCode: body.developer_code,
          providerKind: body.provider_kind,
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        this.logger.error(`Failed to process payout: ${result.status}`);
        return { status: this.mapBalanceStatusToSt8Status(result.status) };
      }

      // Get primary wallet asset for bet recording (single DB query)
      const primaryWallet = await this.balanceService.getPrimaryWallet(user.id);
      const asset = primaryWallet?.asset || AssetTypeEnum.BTC;
      if (!primaryWallet?.asset) {
        this.logger.error(
          `Primary wallet not found for user ${user.id} - critical data integrity issue. Falling back to BTC.`,
        );
      }

      // Apply payout to provider bet row as well (idempotent update)
      this.recordProviderPayout(user.id, body, asset).catch((e) => this.logger.error(e));

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(result.balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to process payout for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  async cancel(
    body: St8CancelBaseDto | St8CancelExtendedDto,
  ): Promise<ISt8SuccessBalanceResponse | ISt8ErrorResponse> {
    try {
      const user = await this.userService.findById(body.player);
      if (!user) {
        return { status: St8ResponseStatusEnum.PLAYER_NOT_FOUND };
      }

      if (user.isBanned) {
        return { status: St8ResponseStatusEnum.PLAYER_LOCKED };
      }

      // Check if this operation already exists (idempotency)
      const existingCancelOperation = await this.getFiatBalanceByOperationId(
        body.cancel_id,
        user.id,
        body.currency,
      );

      if (existingCancelOperation) {
        this.logger.log(`Operation ${body.cancel_id} already exists, returning existing result`);
        return existingCancelOperation;
      }

      const historyRecord = await this.balanceService.getHistoryByOperationId(body.transaction_id);
      if (!historyRecord) {
        return { status: St8ResponseStatusEnum.TRANSACTION_NOT_FOUND };
      }

      const cancelOperation = this.getCancelOperationName(historyRecord.operation);

      if (!cancelOperation) {
        return { status: St8ResponseStatusEnum.TRANSACTION_NOT_FOUND };
      }

      const result = await this.balanceService.updateFiatBalance({
        userId: user.id,
        operation: cancelOperation,
        operationId: body.cancel_id,
        amount: String(historyRecord.amountCents),
        currency: user.currentCurrency,
        description: `St8 cancel for transaction ${body.transaction_id}${'game_code' in body && body.game_code ? ` for game ${body.game_code}` : ''}`,
        metadata: {
          transactionId: body.transaction_id,
          gameCode: 'game_code' in body ? body.game_code : null,
          developerCode: body.developer_code,
          round: 'round' in body ? body.round : null,
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        this.logger.error(`Failed to process cancel: ${result.status}`);

        // Special handling for OPERATION_EXISTS (idempotency)
        if (result.status === BalanceOperationResultEnum.OPERATION_EXISTS) {
          const existingResult = await this.getFiatBalanceByOperationId(
            body.cancel_id,
            user.id,
            body.currency,
          );

          if (existingResult) {
            return existingResult;
          }
        }

        return { status: this.mapBalanceStatusToSt8Status(result.status) };
      }

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(result.balance),
        currency: body.currency,
      };
    } catch (error) {
      this.logger.error(`Failed to process cancel for user ${body.player}:`, error);
      return { status: St8ResponseStatusEnum.UNKNOWN };
    }
  }

  private getCancelOperationName(
    operation: BalanceOperationEnum,
  ): BalanceOperationEnum | undefined {
    const rollbackOperation = {
      [BalanceOperationEnum.BET]: BalanceOperationEnum.BET_CANCEL,
      [BalanceOperationEnum.BUYIN]: BalanceOperationEnum.BET_CANCEL,
      [BalanceOperationEnum.WIN]: BalanceOperationEnum.WIN_CANCEL,
      [BalanceOperationEnum.PAYOUT]: BalanceOperationEnum.WIN_CANCEL,
    } as Record<
      BalanceOperationEnum,
      BalanceOperationEnum.WIN_CANCEL | BalanceOperationEnum.BET_CANCEL
    >;

    return rollbackOperation[operation];
  }

  private mapBalanceStatusToSt8Status(
    balanceStatus: BalanceOperationResultEnum,
  ): Exclude<St8ResponseStatusEnum, St8ResponseStatusEnum.OK> {
    switch (balanceStatus) {
      case BalanceOperationResultEnum.INSUFFICIENT_BALANCE:
        return St8ResponseStatusEnum.NOT_ENOUGH_MONEY;
      case BalanceOperationResultEnum.DAILY_LIMIT_REACHED:
        return St8ResponseStatusEnum.SPENDING_LIMIT;
      case BalanceOperationResultEnum.WALLET_NOT_FOUND:
        return St8ResponseStatusEnum.PLAYER_NOT_FOUND;
      case BalanceOperationResultEnum.USER_BANNED:
        return St8ResponseStatusEnum.PLAYER_LOCKED;
      default:
        return St8ResponseStatusEnum.UNKNOWN;
    }
  }

  /** Persist a provider bet into games.user_bets on debit (idempotent). */
  private async recordProviderDebit(
    userId: string,
    body: St8TransactionDto,
    asset: AssetTypeEnum,
  ): Promise<void> {
    try {
      const amount = new BigNumber(body.amount);
      if (amount.isNaN()) return;

      const { fixedAmount: betAmount, fixedAmountUsd: betAmountUsd } = this.parseAmounts(amount);
      const betId = this.getBetId(body);
      const gameName = this.getGameName(body);

      await this.dataSource.query(
        `INSERT INTO games.user_bets 
          ("game", "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("game","betId") DO NOTHING`,
        ['PROVIDER', gameName, betId, userId, betAmount, asset, '1.0000', '0', betAmountUsd, '0'],
      );
    } catch (e) {
      this.logger.error('Failed to record provider debit bet', e);
    }
  }

  private async recordProviderCredit(
    userId: string,
    body: St8TransactionDto,
    asset: AssetTypeEnum,
  ): Promise<void> {
    try {
      const amount = new BigNumber(body.amount);
      if (amount.isNaN()) return;
      const { fixedAmount: payout, fixedAmountUsd: payoutUsd } = this.parseAmounts(amount);
      const betId = this.getBetId(body);
      const gameName = this.getGameName(body);

      const existing = await this.dataSource.query(
        'SELECT "betAmount", "betAmountUsd", "createdAt" FROM games.user_bets WHERE "game"=$1 AND "betId"=$2 AND "userId"=$3',
        ['PROVIDER', betId, userId],
      );

      let multiplier = '0.0000';
      if (existing && existing[0]) {
        const betAmount = new BigNumber(existing[0].betAmount ?? 0);
        multiplier = betAmount.gt(0) ? amount.div(betAmount).toFixed(4) : '0.0000';
      }

      if (existing && existing[0]) {
        const updated = await this.dataSource.query(
          'UPDATE games.user_bets SET payout=$1, "payoutUsd"=$2, multiplier=$3, "updatedAt"=NOW() WHERE "game"=$4 AND "betId"=$5 AND "userId"=$6 RETURNING *',
          [payout, payoutUsd, multiplier, 'PROVIDER', betId, userId],
        );

        if (updated && updated[0]) {
          const betEntity = this.buildBetEntity(
            gameName,
            updated[0].betId,
            updated[0].userId,
            updated[0].betAmount ?? '0',
            asset,
            updated[0].multiplier ?? '1.0000',
            updated[0].payout ?? '0',
            updated[0].betAmountUsd ?? '0',
            updated[0].payoutUsd ?? '0',
            updated[0].createdAt ? new Date(updated[0].createdAt) : new Date(),
          );

          try {
            this.eventEmitter.emitAsync('user-bet.created', betEntity).catch((error) => {
              this.logger.error('Failed to emit user-bet.created event', { betId, error });
            });
          } catch (error) {
            this.logger.error('Failed to emit user-bet.created event (sync)', { betId, error });
          }
        }
      } else {
        // Edge case: credit arrived before debit
        // Insert minimal row if missing
        const inserted = await this.dataSource.query(
          `INSERT INTO games.user_bets 
            ("game", "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT ("game","betId") DO NOTHING
           RETURNING *`,
          ['PROVIDER', gameName, betId, userId, '0', asset, multiplier, payout, '0', payoutUsd],
        );

        if (inserted && inserted[0]) {
          const betEntity = this.buildBetEntity(
            gameName,
            inserted[0].betId,
            inserted[0].userId,
            inserted[0].betAmount ?? '0',
            asset,
            inserted[0].multiplier ?? multiplier,
            inserted[0].payout ?? payout,
            inserted[0].betAmountUsd ?? '0',
            inserted[0].payoutUsd ?? payoutUsd,
            inserted[0].createdAt ? new Date(inserted[0].createdAt) : new Date(),
          );

          try {
            this.eventEmitter.emitAsync('user-bet.created', betEntity).catch((error) => {
              this.logger.error('Failed to emit user-bet.created event (edge case)', {
                betId,
                error,
              });
            });
          } catch (error) {
            this.logger.error('Failed to emit user-bet.created event (edge case sync)', {
              betId,
              error,
            });
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to apply provider credit to bet', e);
    }
  }

  private async recordProviderPayout(
    userId: string,
    body: St8PayoutDto,
    asset: AssetTypeEnum,
  ): Promise<void> {
    try {
      const amount = new BigNumber(body.amount);
      if (amount.isNaN()) return;
      const { fixedAmount: payout, fixedAmountUsd: payoutUsd } = this.parseAmounts(amount);
      const betId = this.getBetId(body);
      const gameName = this.getGameName(body);

      this.logger.debug(`Recording provider payout: betId=${betId}, payout=${payout}`);

      const existing = await this.dataSource.query(
        'SELECT "betAmount", "betAmountUsd", "createdAt" FROM games.user_bets WHERE "game"=$1 AND "betId"=$2 AND "userId"=$3',
        ['PROVIDER', betId, userId],
      );

      let multiplier = '0.0000';
      if (existing && existing[0]) {
        const betAmount = new BigNumber(existing[0].betAmount ?? 0);
        multiplier = betAmount.gt(0) ? amount.div(betAmount).toFixed(4) : '0.0000';
      }

      if (existing && existing[0]) {
        this.logger.debug(`Updating existing bet with payout: betId=${betId}`);
        const updated = await this.dataSource.query(
          'UPDATE games.user_bets SET payout=$1, "payoutUsd"=$2, multiplier=$3, "updatedAt"=NOW() WHERE "game"=$4 AND "betId"=$5 AND "userId"=$6 RETURNING *',
          [payout, payoutUsd, multiplier, 'PROVIDER', betId, userId],
        );

        if (updated && updated[0]) {
          const betEntity = this.buildBetEntity(
            gameName,
            updated[0].betId,
            updated[0].userId,
            updated[0].betAmount ?? '0',
            asset,
            updated[0].multiplier ?? '1.0000',
            updated[0].payout ?? '0',
            updated[0].betAmountUsd ?? '0',
            updated[0].payoutUsd ?? '0',
            updated[0].createdAt ? new Date(updated[0].createdAt) : new Date(),
          );

          try {
            this.eventEmitter.emitAsync('user-bet.created', betEntity).catch((error) => {
              this.logger.error('Failed to emit user-bet.created event', { betId, error });
            });
          } catch (error) {
            this.logger.error('Failed to emit user-bet.created event (sync)', { betId, error });
          }
        }
      } else {
        const inserted = await this.dataSource.query(
          `INSERT INTO games.user_bets 
            ("game", "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT ("game","betId") DO NOTHING
           RETURNING *`,
          ['PROVIDER', gameName, betId, userId, '0', asset, multiplier, payout, '0', payoutUsd],
        );

        if (inserted && inserted[0]) {
          const betEntity = this.buildBetEntity(
            gameName,
            inserted[0].betId,
            inserted[0].userId,
            inserted[0].betAmount ?? '0',
            asset,
            inserted[0].multiplier ?? multiplier,
            inserted[0].payout ?? payout,
            inserted[0].betAmountUsd ?? '0',
            inserted[0].payoutUsd ?? payoutUsd,
            inserted[0].createdAt ? new Date(inserted[0].createdAt) : new Date(),
          );

          try {
            this.eventEmitter.emitAsync('user-bet.created', betEntity).catch((error) => {
              this.logger.error('Failed to emit user-bet.created event (payout edge case)', {
                betId,
                error,
              });
            });
          } catch (error) {
            this.logger.error('Failed to emit user-bet.created event (payout edge case sync)', {
              betId,
              error,
            });
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to apply provider payout to bet', e);
    }
  }

  /**
   * Get the current balance for a user by operation ID
   * Used for idempotent operations
   */
  private async getFiatBalanceByOperationId(
    operationId: string,
    userId: string,
    currency: string,
  ): Promise<ISt8SuccessBalanceResponse | null> {
    try {
      const historyRecord = await this.balanceService.getHistoryByOperationId(operationId);

      if (!historyRecord) {
        return null;
      }

      const balance = await this.balanceService.getFiatBalance(userId);

      return {
        status: St8ResponseStatusEnum.OK,
        balance: this.roundToCents(balance),
        currency,
      };
    } catch (error) {
      this.logger.error(`Failed to get balance by operation ID ${operationId}:`, error);
      return null;
    }
  }

  private roundToCents(amount: string | number): string {
    const amountNum = new BigNumber(amount);
    if (amountNum.isNaN()) {
      throw new Error('Invalid amount');
    }

    return amountNum.div(100).toFixed(2);
  }

  private getBetId(body: St8TransactionDto | St8PayoutDto): string {
    return body.provider?.transaction_id || body.transaction_id;
  }

  private getGameName(body: St8TransactionDto | St8PayoutDto): string {
    const gameCode =
      (body as St8PayoutDto).game_code ?? (body as St8TransactionDto).game_code ?? '';
    const developerCode = body.developer_code;
    return `${developerCode}:${gameCode}`.slice(0, this.MAX_GAME_NAME_LENGTH);
  }

  private parseAmounts(amount: BigNumber): { fixedAmount: string; fixedAmountUsd: string } {
    return {
      fixedAmount: amount.toFixed(8),
      fixedAmountUsd: amount.toFixed(4),
    };
  }

  private buildBetEntity(
    gameName: string,
    betId: string,
    userId: string,
    betAmount: string,
    asset: AssetTypeEnum,
    multiplier: string,
    payout: string,
    betAmountUsd: string,
    payoutUsd: string,
    createdAt: Date,
  ): UserBetEntity {
    return {
      game: GameTypeEnum.PROVIDER,
      gameName,
      betId,
      userId,
      betAmount,
      asset,
      multiplier,
      payout,
      betAmountUsd,
      payoutUsd,
      createdAt,
    } as UserBetEntity;
  }
}
