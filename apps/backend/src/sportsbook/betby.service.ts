import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  BalanceWalletEntity,
  BetSourceEnum,
  GameTypeEnum,
  SportsbookBetEntity,
  SportsbookBetStatus,
  SportsbookBetType,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { CryptoConverterService } from '../balance/services/crypto-converter.service';
import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { UserBetService } from '../games/services/user-bet.service';
import { UsersService } from '../users/users.service';
import { BetbyJwtService } from './betby-jwt.service';
import { BetDiscardRequestDto } from './dto/bet-discard.dto';
import { BetLostRequestDto } from './dto/bet-lost-request.dto';
import { BetLostSuccessResponseDto } from './dto/bet-lost-response.dto';
import { BetRefundRequestDto } from './dto/bet-refund-request.dto';
import { BetRefundSuccessResponseDto } from './dto/bet-refund-response.dto';
import { BetRollbackRequestDto } from './dto/bet-rollabck-request.dto';
import { BetRollbackSuccessResponseDto } from './dto/bet-rollback-response.dto';
import { BetSettlementRequestDto } from './dto/bet-settelment-request.dto';
import { BetWinRequestDto } from './dto/bet-win-request.dto';
import { BetWinSuccessResponseDto } from './dto/bet-win-response.dto';
import {
  BetbyTokenGenerateRequestDto,
  BetbyTokenGenerateResponseDto,
} from './dto/betby-token-generate.dto';
import { BetErrorCode } from './dto/common.dto';
import { MakeBetRequestDto } from './dto/make-bet-request.dto';
import { MakeBetSuccessResponseDto } from './dto/make-bet-response.dto';
import { PlayerSegmentRequestDto } from './dto/player-segment-request.dto';

@Injectable()
export class BetbyService {
  private readonly logger = new Logger(BetbyService.name);
  private readonly SPORTSBOOK_EDGE = 3;

  constructor(
    @InjectRepository(SportsbookBetEntity)
    private readonly sportsbookBetRepository: Repository<SportsbookBetEntity>,
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly betbyJwtService: BetbyJwtService,
    private readonly cryptoConverter: CryptoConverterService,
    private readonly affiliateCommissionService: AffiliateCommissionService,
    private readonly dataSource: DataSource,
    private readonly userBetService: UserBetService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async makeBet(payload: MakeBetRequestDto): Promise<MakeBetSuccessResponseDto> {
    this.logger.debug(`BET_MAKE payload: ${JSON.stringify(payload).slice(0, 1000)}`, payload);

    try {
      const user = await this.usersService.findById(payload.player_id);

      if (!user) {
        throw new Error('Player not found');
      }

      if (user.isBanned) {
        throw new Error('Player blocked');
      }

      if (!Object.values(CurrencyEnum).includes(payload.currency as CurrencyEnum)) {
        throw new Error('Invalid currency');
      }

      const balance = await this.balanceService.getFiatBalance(payload.player_id);

      if (!BigNumber(balance) || BigNumber(balance).isLessThan(BigNumber(payload.amount))) {
        throw new Error('Not enough money');
      }

      const ext_bet = await this.getBetByExtTransactionId(payload.transaction.id);

      if (ext_bet) {
        throw new Error('Bad request');
      }

      const bet = this.sportsbookBetRepository.create({
        userId: payload.player_id,
        extTransactionId: payload.transaction.id,
        betslipId: payload.transaction.betslip_id,
        betAmount: payload.amount.toString(),
        currency: payload.currency as CurrencyEnum,
        totalOdds: payload.betslip.k,
        betType: this.mapBetType(payload.betslip.type),
        selections: payload.betslip.bets.map((betItem) => ({
          id: betItem.id,
          eventId: betItem.event_id,
          sportId: betItem.sport_id,
          tournamentId: betItem.tournament_id,
          categoryId: betItem.category_id,
          live: betItem.live,
          sportName: betItem.sport_name,
          categoryName: betItem.category_name,
          tournamentName: betItem.tournament_name,
          competitorName: betItem.competitor_name,
          marketName: betItem.market_name,
          outcomeName: betItem.outcome_name,
          scheduled: betItem.scheduled,
          odds: betItem.odds,
          status: 'open' as const,
        })),
      });

      // Save bet first to generate ID
      await this.sportsbookBetRepository.save(bet);

      const result = await this.balanceService.updateFiatBalance({
        userId: payload.player_id,
        operation: BalanceOperationEnum.BET,
        operationId: bet.id, // Use bet.id for linking all operations to this bet
        amount: payload.amount.toString(),
        currency: payload.currency as CurrencyEnum,
        description: `Betby bet for betslip ${payload.transaction.betslip_id}`,
        houseEdge: this.SPORTSBOOK_EDGE,
        metadata: {
          betId: bet.id,
          amount: payload.amount,
          source: BetSourceEnum.SPORTSBOOK, // Prevent affiliate double commission
        },
      });

      if (result.status !== BalanceOperationResultEnum.SUCCESS) {
        // Rollback: delete created bet
        await this.sportsbookBetRepository.remove(bet);
        throw new Error(
          result.status === BalanceOperationResultEnum.INSUFFICIENT_BALANCE
            ? 'Not enough money'
            : 'Bad request',
        );
      }

      // Update bet with operation ID from balance
      bet.betCommitOperationId = bet.id;
      await this.sportsbookBetRepository.save(bet);

      return {
        id: bet.id,
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: null,
        user_id: payload.player_id,
        operation: 'bet',
        amount: payload.amount,
        currency: payload.currency,
        balance: this.roundBalance(result.balance),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to make bet: ${message}`);

      let errorCode = BetErrorCode['Bad request'];
      let errorMessage = BetErrorCode[2004];

      if (Object.values(BetErrorCode).includes(message as unknown as BetErrorCode)) {
        errorCode = BetErrorCode[message as unknown as keyof typeof BetErrorCode];
        errorMessage = BetErrorCode[BetErrorCode[message as unknown as BetErrorCode]];
      }

      throw new BadRequestException({
        bet_error: true,
        message: errorMessage,
        code: errorCode,
      });
    }
  }

  async commitBet(payload: { transaction_id: string }) {
    this.logger.debug('BET_COMMIT payload received', payload);

    await this.updateBetStatus(payload.transaction_id, SportsbookBetStatus.ACTIVE);
  }

  async settlement(payload: BetSettlementRequestDto) {
    this.logger.debug('BET_SETTLEMENT payload received', payload);

    try {
      await this.updateBetStatus(payload.bet_transaction_id, payload.status);
    } catch (error) {
      this.logger.error(`Failed to settle bet: ${error}`);
      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
    return {};
  }

  async refund(payload: BetRefundRequestDto): Promise<BetRefundSuccessResponseDto> {
    this.logger.debug('BET_REFUND payload received', payload);

    try {
      const bet = await this.getParentBetById(payload.bet_transaction_id);

      const operationId = bet.id; // Same bet.id for all operations (composite PK with operation type)

      let balance = 0;

      if (bet.status !== SportsbookBetStatus.REFUND) {
        const result = await this.balanceService.updateFiatBalance({
          userId: bet.userId,
          operation: BalanceOperationEnum.REFUND,
          operationId,
          amount: payload.transaction.amount.toString(),
          currency: payload.transaction.currency as CurrencyEnum,
          description: `Betby refund for bet ${bet.id}`,
          metadata: {
            betId: bet.id,
            source: BetSourceEnum.SPORTSBOOK, // Prevent affiliate double commission
          },
        });

        if (result.status !== BalanceOperationResultEnum.SUCCESS) {
          throw new BadRequestException({
            code: BetErrorCode['Bad request'],
            message: BetErrorCode[2004],
          });
        }

        if (!result.success) {
          throw new Error(`Failed to refund bet: ${result.error}`);
        }

        balance = this.roundBalance(result.balance);
      } else {
        const fiatBalance = await this.balanceService.getFiatBalance(bet.userId);

        balance = this.roundBalance(fiatBalance);
      }
      const parentTransactionId = bet.betCommitOperationId || bet.id;

      await this.updateBetStatusAndSave(bet, SportsbookBetStatus.REFUND, operationId);

      return {
        id: operationId,
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: parentTransactionId,
        user_id: bet.userId,
        operation: 'refund',
        amount: payload.transaction.amount,
        currency: payload.transaction.currency,
        balance,
      };
    } catch (error) {
      this.logger.error(`Failed to refund bet: ${error}`);

      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
  }

  async win(payload: BetWinRequestDto): Promise<BetWinSuccessResponseDto> {
    this.logger.debug('BET_WIN payload received', payload);

    try {
      const bet = await this.getParentBetById(payload.bet_transaction_id);

      if (bet.status !== SportsbookBetStatus.WON) {
        const operationId = bet.id; // Same bet.id for all operations (composite PK with operation type)
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Get primary wallet INSIDE transaction to prevent race conditions
          const primaryWallet = await queryRunner.manager.findOne(BalanceWalletEntity, {
            where: { userId: bet.userId, isPrimary: true },
          });
          if (!primaryWallet) {
            throw new InternalServerErrorException(`User ${bet.userId} has no primary wallet`);
          }
          const userAsset = primaryWallet.asset;

          // Convert fiat to user's primary asset for balance update
          const winAmountCrypto = this.cryptoConverter.fromCents(
            payload.amount.toString(),
            userAsset,
          );

          // Update balance in transaction
          const result = await this.balanceService.updateBalance(
            {
              userId: bet.userId,
              asset: userAsset,
              operation: BalanceOperationEnum.WIN,
              operationId,
              amount: new BigNumber(winAmountCrypto.toString()),
              description: `Betby win for bet ${bet.id}`,
              metadata: {
                betId: bet.id,
                amount: bet.betAmount,
                source: BetSourceEnum.SPORTSBOOK, // Prevent affiliate double commission
              },
            },
            queryRunner,
          );

          if (result.status !== BalanceOperationResultEnum.SUCCESS || !result.success) {
            throw new Error(`Failed to settle win for bet: ${result.error}`);
          }

          // Update bet status in same transaction
          const parentTransactionId = bet.betCommitOperationId || bet.id;
          bet.actualWin = payload.amount.toString();
          bet.status = SportsbookBetStatus.WON;
          await queryRunner.manager.save(bet);

          // Accumulate affiliate commission in user's primary asset
          const betAmountCrypto = this.cryptoConverter.fromCents(bet.betAmount, userAsset);
          await this.affiliateCommissionService.accumulateCommission(
            bet.userId,
            userAsset,
            betAmountCrypto.toString(),
            this.SPORTSBOOK_EDGE,
            queryRunner,
          );

          // Emit bet.confirmed event
          const betAmountCents = this.cryptoConverter.toCents(
            betAmountCrypto.toString(),
            userAsset,
          );
          void this.eventEmitter.emitAsync('bet.confirmed', {
            userId: bet.userId,
            betAmount: betAmountCrypto.toString(),
            betAmountCents,
            asset: userAsset,
            operationId: bet.id,
            houseEdge: this.SPORTSBOOK_EDGE,
            metadata: {
              source: BetSourceEnum.SPORTSBOOK,
            },
          });

          await this.createUserBetAndPublishEvent(bet, 'win');

          await queryRunner.commitTransaction();

          const winRoundedBalance = this.roundBalance(result.balance);

          return {
            id: operationId,
            ext_transaction_id: payload.transaction.id,
            parent_transaction_id: parentTransactionId,
            user_id: bet.userId,
            operation: 'win',
            amount: Number(payload.amount),
            currency: payload?.currency,
            balance: winRoundedBalance,
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`Failed to process WIN bet ${bet.id}:`, error);
          throw new BadRequestException({
            code: BetErrorCode['Bad request'],
            message: BetErrorCode[2004],
          });
        } finally {
          await queryRunner.release();
        }
      } else {
        const balance = await this.balanceService.getFiatBalance(bet.userId);

        return {
          id: bet.id, // Return bet.id (idempotent with composite PK)
          ext_transaction_id: payload.transaction.id,
          parent_transaction_id: bet.id,
          user_id: bet.userId,
          operation: 'win',
          amount: Number(payload.amount),
          currency: payload?.currency,
          balance: this.roundBalance(balance),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to win bet: ${error}`);
      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
  }

  async lost(payload: BetLostRequestDto): Promise<BetLostSuccessResponseDto> {
    this.logger.debug('BET_LOST payload received', payload);

    const bet = await this.getParentBetById(payload.bet_transaction_id);

    const balance = await this.balanceService.getFiatBalance(bet.userId);

    const roundedBalance = this.roundBalance(balance);

    // status and id idempotency
    if (bet.status === SportsbookBetStatus.LOST) {
      return {
        id: bet.id, // Return bet.id (idempotent with composite PK)
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: bet.id,
        user_id: bet.userId,
        operation: 'lost',
        balance: roundedBalance,
      };
    }

    const operationId = bet.id; // Same bet.id for all operations (composite PK with operation type)
    const parentTransactionId = bet.betCommitOperationId || bet.id;

    // Wrap bet status update and commission accumulation in single transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get primary wallet INSIDE transaction to prevent race conditions
      const primaryWallet = await queryRunner.manager.findOne(BalanceWalletEntity, {
        where: { userId: bet.userId, isPrimary: true },
      });
      if (!primaryWallet) {
        throw new InternalServerErrorException(`User ${bet.userId} has no primary wallet`);
      }
      const userAsset = primaryWallet.asset;

      // Update bet status in transaction
      bet.status = SportsbookBetStatus.LOST;
      await queryRunner.manager.save(bet);

      // Accumulate affiliate commission in user's primary asset
      const betAmountCrypto = this.cryptoConverter.fromCents(bet.betAmount, userAsset);
      await this.affiliateCommissionService.accumulateCommission(
        bet.userId,
        userAsset,
        betAmountCrypto.toString(),
        this.SPORTSBOOK_EDGE,
        queryRunner,
      );

      // Emit bet.confirmed event
      const betAmountCents = this.cryptoConverter.toCents(betAmountCrypto.toString(), userAsset);
      void this.eventEmitter.emitAsync('bet.confirmed', {
        userId: bet.userId,
        betAmount: betAmountCrypto.toString(),
        betAmountCents,
        asset: userAsset,
        operationId: bet.id,
        houseEdge: this.SPORTSBOOK_EDGE,
        metadata: {
          source: BetSourceEnum.SPORTSBOOK,
        },
      });

      await this.createUserBetAndPublishEvent(bet, 'lost');

      await queryRunner.commitTransaction();

      return {
        id: operationId,
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: parentTransactionId,
        user_id: bet.userId,
        operation: 'lost',
        balance: roundedBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process LOST bet ${bet.id}:`, error);
      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    } finally {
      await queryRunner.release();
    }
  }

  async discard(payload: BetDiscardRequestDto) {
    this.logger.debug('BET_DISCARD payload received', payload);

    try {
      const bet = await this.getBetByExtTransactionId(payload.transaction_id);

      if (!bet) {
        // Could be discarded before make

        const bet = this.sportsbookBetRepository.create({
          userId: payload.ext_player_id,
          extTransactionId: payload.transaction_id,
          betslipId: randomUUID(),
          betAmount: '0',
          currency: CurrencyEnum.USD,
          totalOdds: '0',
          betType: SportsbookBetType.SINGLE,
          selections: [],
          status: SportsbookBetStatus.CANCELED,
        });

        await this.sportsbookBetRepository.save(bet);

        return {};
      }

      await this.balanceService.updateFiatBalance({
        userId: bet.userId,
        operation: BalanceOperationEnum.BET_CANCEL,
        operationId: bet.id, // Same bet.id for all operations (composite PK with operation type)
        amount: new BigNumber(bet.betAmount).toString(),
        currency: bet.currency,
        description: `Betby bet cancel for bet ${bet.id}`,
        metadata: {
          betId: bet.id,
          source: BetSourceEnum.SPORTSBOOK, // Prevent affiliate double commission
        },
      });

      await this.updateBetStatusAndSave(bet, SportsbookBetStatus.CANCELED);

      return {};
    } catch (error) {
      this.logger.error(`Failed to discard bet: ${error}`);

      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
  }

  async rollback(payload: BetRollbackRequestDto): Promise<BetRollbackSuccessResponseDto> {
    this.logger.debug('BET_ROLLBACK payload received', payload);
    const bet = await this.getParentBetById(payload.bet_transaction_id);
    let rollbackAmount = Number(payload.transaction.amount || '0');

    if (bet.status === SportsbookBetStatus.ACTIVE) {
      const balance = await this.balanceService.getFiatBalance(bet.userId);

      return {
        id: bet.id, // Return bet.id (idempotent with composite PK)
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: bet.id,
        user_id: bet.userId,
        operation: 'rollback',
        amount: rollbackAmount,
        currency: payload.transaction.currency,
        balance: this.roundBalance(balance),
      };
    }

    try {
      let newBalance: number | string = 0;
      const operationId = bet.id; // Same bet.id for all operations (composite PK with operation type)

      switch (bet.status) {
        case SportsbookBetStatus.WON:
          if (rollbackAmount > 0) {
            newBalance = await this.processBalanceRollback(
              bet,
              BalanceOperationEnum.WIN_CANCEL,
              operationId,
              rollbackAmount,
              payload.transaction.currency as CurrencyEnum,
              'win_cancel',
            );
          }
          break;

        case SportsbookBetStatus.LOST:
          this.logger.log(`Rollback for lost bet ${bet.id} - no balance change required`);
          newBalance = Number(await this.balanceService.getFiatBalance(bet.userId));
          break;

        case SportsbookBetStatus.CANCELED:
          rollbackAmount = Number(bet.betAmount);

          if (rollbackAmount > 0) {
            newBalance = await this.processBalanceRollback(
              bet,
              BalanceOperationEnum.BET_CANCEL,
              operationId,
              rollbackAmount,
              payload.transaction.currency as CurrencyEnum,
              'bet_cancel',
            );
          }
          break;

        case SportsbookBetStatus.REFUND:
          newBalance = await this.processBalanceRollback(
            bet,
            BalanceOperationEnum.CORRECTION_DEBIT,
            operationId,
            rollbackAmount,
            payload.transaction.currency as CurrencyEnum,
            'refund',
          );
          break;

        default:
          this.logger.warn(`Unexpected bet status for rollback: ${bet.status}`, {
            betId: bet.id,
            status: bet.status,
          });
          newBalance = Number(await this.balanceService.getFiatBalance(bet.userId));
          break;
      }

      const parentTransactionId = bet.betCommitOperationId || bet.id;
      await this.updateBetStatusAndSave(bet, SportsbookBetStatus.ACTIVE, operationId);

      this.logger.log(`Bet rollback completed successfully`, {
        betId: bet.id,
        userId: bet.userId,
        previousStatus: bet.status,
        rollbackAmount,
        newBalance,
        operationId,
      });

      return {
        id: operationId,
        ext_transaction_id: payload.transaction.id,
        parent_transaction_id: parentTransactionId,
        user_id: bet.userId,
        operation: 'rollback',
        amount: rollbackAmount,
        currency: payload.transaction.currency,
        balance: this.roundBalance(newBalance),
      };
    } catch (error) {
      this.logger.error(`Failed to rollback bet: ${error}`, {
        payload,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
  }

  playerSegment(_payload: PlayerSegmentRequestDto) {
    this.logger.debug('PLAYER_SEGMENT payload received', _payload);
    return {};
  }

  private async processBalanceRollback(
    bet: SportsbookBetEntity,
    operation: BalanceOperationEnum,
    operationId: string,
    rollbackAmount: number,
    currency: CurrencyEnum,
    rollbackType: 'win_cancel' | 'bet_cancel' | 'refund',
  ): Promise<number | string> {
    const balanceResult = await this.balanceService.updateFiatBalance({
      userId: bet.userId,
      operation,
      operationId,
      amount: rollbackAmount.toString(),
      currency,
      description: `Betby rollback: ${rollbackType} for bet ${bet.id}`,
      metadata: {
        betId: bet.id,
        betslipId: bet.betslipId,
        previousStatus: bet.status,
        rollbackType,
        source: BetSourceEnum.SPORTSBOOK, // Prevent affiliate double commission
      },
    });

    if (balanceResult.status !== BalanceOperationResultEnum.SUCCESS) {
      this.logger.error(
        `Failed to rollback ${rollbackType} for bet ${bet.id}: ${balanceResult.error}`,
      );
      throw new BadRequestException({
        code: BetErrorCode['Bad request'],
        message: BetErrorCode[2004],
      });
    }
    const newBalance = Number(balanceResult.balance);

    this.checkAndHandleNegativeBalance(bet, rollbackAmount, newBalance, rollbackType);

    return newBalance;
  }

  private checkAndHandleNegativeBalance(
    bet: SportsbookBetEntity,
    rollbackAmount: number,
    newBalance: number,
    rollbackType: 'win_cancel' | 'bet_cancel' | 'refund',
  ): void {
    if (newBalance < 0) {
      this.logger.warn(`User ${bet.userId} has negative balance after rollback`, {
        userId: bet.userId,
        betId: bet.id,
        rollbackAmount,
        newBalance,
        previousStatus: bet.status,
      });

      this.sendNegativeBalanceAlert(bet.userId, bet.id, rollbackAmount, newBalance, rollbackType);
    }
  }

  private sendNegativeBalanceAlert(
    userId: string,
    betId: string,
    rollbackAmount: number,
    newBalance: number,
    rollbackType: 'win_cancel' | 'bet_cancel' | 'refund',
  ): void {
    try {
      this.logger.error(`CRITICAL: User has negative balance after rollback`, {
        userId,
        betId,
        rollbackAmount,
        newBalance,
        rollbackType,
        timestamp: new Date().toISOString(),
        alertType: 'NEGATIVE_BALANCE_AFTER_ROLLBACK',
      });
      const alertData = {
        type: 'NEGATIVE_BALANCE_AFTER_ROLLBACK',
        severity: 'HIGH',
        userId,
        betId,
        rollbackAmount,
        newBalance,
        rollbackType,
        timestamp: new Date().toISOString(),
        message: `User ${userId} has negative balance (${newBalance}) after ${rollbackType} rollback for bet ${betId}`,
      };

      this.logger.log(`Alert data prepared for manager notification`, alertData);
    } catch (error) {
      this.logger.error(`Failed to send negative balance alert: ${error}`, {
        userId,
        betId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getBetById(id: string) {
    return await this.sportsbookBetRepository.findOne({
      where: {
        id,
      },
    });
  }

  private async getBetByExtTransactionId(extTransactionId: string) {
    return await this.sportsbookBetRepository.findOne({
      where: {
        extTransactionId,
      },
    });
  }

  private async getParentBetById(id: string) {
    const bet = await this.getBetById(id);

    if (!bet) {
      throw new BadRequestException({
        code: BetErrorCode['PARENT TRANSACTION NOT FOUND'],
        message: BetErrorCode[2003],
      });
    }

    return bet;
  }

  private mapBetType(betType: string): SportsbookBetType {
    const typeMapping: Record<string, SportsbookBetType> = {
      single: SportsbookBetType.SINGLE,
      accumulator: SportsbookBetType.ACCUMULATOR,
      system: SportsbookBetType.SYSTEM,
      chain: SportsbookBetType.CHAIN,
    };

    return typeMapping[betType] || SportsbookBetType.SINGLE;
  }

  private roundBalance(balance: number | string): number {
    return Math.round(BigNumber(balance).toNumber() / 10) * 10;
  }

  private async updateBetStatus(transactionId: string, status: SportsbookBetStatus) {
    const bet = await this.getBetById(transactionId);
    if (!bet) {
      throw new BadRequestException({
        code: BetErrorCode['Bet not found'],
        message: BetErrorCode[2005],
      });
    }
    await this.updateBetStatusAndSave(bet, status);
  }

  private async updateBetStatusAndSave(
    bet: SportsbookBetEntity,
    status: SportsbookBetStatus,
    operationId?: string,
  ): Promise<void> {
    bet.status = status;
    if (operationId) {
      bet.betCommitOperationId = operationId;
    }
    await this.sportsbookBetRepository.save(bet);
  }

  private async createUserBetAndPublishEvent(
    bet: SportsbookBetEntity,
    type: 'win' | 'lost',
  ): Promise<void> {
    const betAmountBtc = this.cryptoConverter.fromCents(bet.betAmount, AssetTypeEnum.BTC);
    const payoutBtc = this.cryptoConverter.fromCents(String(bet.actualWin), AssetTypeEnum.BTC);
    const multiplier = (Number(bet.actualWin) / Number(bet.betAmount)).toFixed(2);
    const sportId =
      bet.selections && bet.selections.length > 0 ? bet.selections[0].sportId : undefined;

    const betAmountUsd = (Number(bet.betAmount) / 100).toFixed(2);
    const payoutUsd = type === 'win' ? (Number(bet.actualWin) / 100).toFixed(2) : '0.00';

    try {
      const existingBet = await this.userBetService.getUserBetById(GameTypeEnum.SPORTSBOOK, bet.id);
      if (!existingBet) {
        let fiatToUsdRate: string | undefined;
        const betAmountInCents = Number(bet.betAmount);
        const usdAmount = Number(betAmountUsd);
        if (betAmountInCents > 0 && usdAmount > 0) {
          fiatToUsdRate = (usdAmount / (betAmountInCents / 100)).toFixed(8);
        }

        await this.userBetService.createUserBet({
          game: GameTypeEnum.SPORTSBOOK,
          betId: bet.id,
          userId: bet.userId,
          betAmount: betAmountBtc.toString(),
          asset: AssetTypeEnum.BTC,
          multiplier,
          payout: payoutBtc.toString(),
          betAmountUsd,
          payoutUsd,
          originalFiatAmount: bet.betAmount,
          originalFiatCurrency: bet.currency,
          fiatToUsdRate,
          gameName: sportId,
        });
      }
    } catch (e) {
      this.logger.error(`Failed to create user_bets record: ${String(e)}`);
    }
  }

  async generateTokenForCurrentUser(
    currentUser: UserEntity,
    body: BetbyTokenGenerateRequestDto,
  ): Promise<BetbyTokenGenerateResponseDto> {
    this.logger.debug(`Generating Betby JWT token for current user ${currentUser.id}`);

    try {
      const token = await this.betbyJwtService.generateToken(currentUser, body);

      this.logger.debug(`Token generated successfully for user ${currentUser.id}`);

      return token;
    } catch (error) {
      this.logger.error(`Failed to generate token for user ${currentUser.id}`, error);
      throw new BadRequestException('Failed to generate JWT token');
    }
  }
}
