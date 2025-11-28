import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BetTypeCategory,
  BlackjackAction,
  BlackjackGameEntity,
  BlackjackGameStatus,
  BlackjackPayoutRatio,
  Card,
  GameType,
  GameTypeEnum,
  HandStatus,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { BetUserInfoDto } from '../dto/bet-user-info.dto';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { BlackjackActionDto } from './dto/blackjack-action.dto';
import { BlackjackBetDetailsResponseDto } from './dto/blackjack-bet-details-response.dto';
import { BlackjackGameResponseDto } from './dto/blackjack-game-response.dto';
import { StartBlackjackGameDto } from './dto/start-blackjack-game.dto';
import { BlackjackActionService } from './services/blackjack-action.service';
import { BlackjackCardService } from './services/blackjack-card.service';
import { BlackjackGameLogicService } from './services/blackjack-game-logic.service';
import { BlackjackSideBetsService } from './services/blackjack-side-bets.service';

// Extended UserEntity interface for typing
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

@Injectable()
export class BlackjackService {
  private readonly logger = new Logger(BlackjackService.name);

  // Default payout multipliers (can be adjusted by house edge)
  private readonly DEFAULT_BLACKJACK_MULTIPLIER = 2.5; // 3:2 blackjack payout
  private readonly DEFAULT_WIN_MULTIPLIER = 2.0; // 1:1 regular win payout
  private readonly DEFAULT_PUSH_MULTIPLIER = 1.0; // Push (tie) payout
  private readonly DEFAULT_LOSS_MULTIPLIER = 0.0; // Loss payout

  constructor(
    @InjectRepository(BlackjackGameEntity)
    private readonly blackjackGameRepository: Repository<BlackjackGameEntity>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userBetService: UserBetService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly gameConfigService: GameConfigService,
    private readonly gameLogicService: BlackjackGameLogicService,
    private readonly actionService: BlackjackActionService,
    private readonly sideBetsService: BlackjackSideBetsService,
    private readonly cardService: BlackjackCardService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  /**
   * Get standard casino payout multipliers for blackjack
   * House edge is achieved through game rules, NOT by reducing payouts
   */
  private getHouseEdgeAdjustedMultipliers(): {
    blackjackMultiplier: number;
    winMultiplier: number;
    pushMultiplier: number;
    lossMultiplier: number;
    houseEdge: number;
  } {
    // CASINO STANDARD: Fixed mathematical house edge (~0.52%)
    const MATHEMATICAL_HOUSE_EDGE = 0.52;

    return {
      blackjackMultiplier: this.DEFAULT_BLACKJACK_MULTIPLIER, // 3:2 (2.5x)
      winMultiplier: this.DEFAULT_WIN_MULTIPLIER, // 1:1 (2.0x)
      pushMultiplier: this.DEFAULT_PUSH_MULTIPLIER, // Return bet (1.0x)
      lossMultiplier: this.DEFAULT_LOSS_MULTIPLIER, // Loss (0.0x)
      houseEdge: MATHEMATICAL_HOUSE_EDGE, // From hardcoded values
    };
  }

  /**
   * Calculate win amount based on game outcome and house edge
   */
  private calculateWinAmount(
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
  ): string {
    const multipliers = this.getHouseEdgeAdjustedMultipliers();
    const betAmountBN = new BigNumber(betAmount);

    let multiplier: number;

    if (isPush) {
      multiplier = multipliers.pushMultiplier;
    } else if (isBlackjack) {
      multiplier = multipliers.blackjackMultiplier;
    } else if (isWin) {
      multiplier = multipliers.winMultiplier;
    } else {
      multiplier = multipliers.lossMultiplier;
    }

    const winAmount = betAmountBN.multipliedBy(multiplier);

    this.logger.debug(
      `Win calculation: ${betAmount} * ${multiplier.toFixed(4)} = ${winAmount.toFixed(8)} (House Edge: ${multipliers.houseEdge}%)`,
    );

    return winAmount.toFixed(8);
  }

  /**
   * Set game payout amounts and multiplier based on outcome
   * This centralized method ensures house edge is applied consistently
   */
  private setGamePayout(
    game: BlackjackGameEntity,
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
    isForSplitHand = false,
  ): void {
    const winAmount = this.calculateWinAmount(betAmount, isBlackjack, isPush, isWin);
    const multipliers = this.getHouseEdgeAdjustedMultipliers();

    let payoutMultiplier: string;

    if (isPush) {
      payoutMultiplier = multipliers.pushMultiplier.toFixed(2);
    } else if (isBlackjack) {
      payoutMultiplier = multipliers.blackjackMultiplier.toFixed(2);
    } else if (isWin) {
      payoutMultiplier = multipliers.winMultiplier.toFixed(2);
    } else {
      payoutMultiplier = multipliers.lossMultiplier.toFixed(2);
    }

    if (isForSplitHand) {
      game.splitWinAmount = winAmount;
      game.splitPayoutMultiplier = payoutMultiplier;
    } else {
      game.winAmount = winAmount;
      game.payoutMultiplier = payoutMultiplier;
    }

    this.logger.debug(
      `Payout set: ${isForSplitHand ? 'Split' : 'Main'} hand - Amount: ${winAmount}, Multiplier: ${payoutMultiplier}, HouseEdge: ${multipliers.houseEdge}%`,
    );
  }

  /**
   * Validate bet amount with fine-grained limits based on bet type
   */
  private async validateBetAmountWithType(
    betAmount: string,
    asset: AssetTypeEnum,
    betType: BetTypeCategory,
    betDescription: string,
  ): Promise<void> {
    try {
      const validation = await this.gameConfigService.validateBetTypeAmount(
        GameType.BLACKJACK,
        betType,
        betAmount,
        asset,
      );

      if (!validation.isValid) {
        throw new BadRequestException(
          validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
        );
      }

      this.logger.debug(
        `${betDescription} ${betAmount} ${asset} validated (${validation.usdAmount?.toFixed(2)} USD)`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(
        `Failed to validate ${betDescription} with fine-grained limits, using fallback:`,
        error,
      );
      // Fallback to general game limits
      await this.validateBetAmountFallback(betAmount, asset, betDescription);
    }
  }

  /**
   * Fallback bet amount validation using general game limits
   */
  private async validateBetAmountFallback(
    betAmount: string,
    asset: AssetTypeEnum,
    betDescription: string,
  ): Promise<void> {
    try {
      const validation = await this.gameConfigService.validateBetAmount(
        GameType.BLACKJACK,
        betAmount,
        asset,
      );

      if (!validation.isValid) {
        throw new BadRequestException(
          validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
        );
      }

      this.logger.debug(
        `Fallback ${betDescription} ${betAmount} ${asset} validated (${validation.usdAmount?.toFixed(2)} USD)`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(
        `Failed to validate ${betDescription} with USD conversion, using hardcoded fallback:`,
        error,
      );
      // Hardcoded fallback validation (allow 0 for demo mode)
      const betAmountBN = new BigNumber(betAmount);
      if (!betAmountBN.eq(0) && betAmountBN.isLessThan('0.00000001')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
      }
      if (betAmountBN.isGreaterThan('1000000')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_LARGE);
      }
    }
  }

  async startGame(user: UserEntity, dto: StartBlackjackGameDto): Promise<BlackjackGameResponseDto> {
    // Acquire distributed lock for user's blackjack game creation
    const lockKey = LockKeyBuilder.gameBlackjack(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        5000, // 5 second TTL
        async () => {
          this.logger.debug(`Lock acquired for blackjack game creation: ${lockKey}`);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            this.logger.log(`User ${user.id} starting blackjack game (crypto)`, {
              amount: dto.betAmount,
            });

            // Check if user already has an active blackjack game
            const existingActiveGame = await queryRunner.manager.findOne(BlackjackGameEntity, {
              where: {
                userId: user.id,
                status: BlackjackGameStatus.ACTIVE,
              },
            });

            if (existingActiveGame) {
              throw new BadRequestException(
                'You already have an active blackjack game. Please finish your current game before starting a new one.',
              );
            }

            // Get primary asset from user object (set by JwtStrategy guard)
            const userWithAsset = user as UserWithPrimaryAsset;
            const primaryAsset = userWithAsset.primaryAsset;

            if (!primaryAsset) {
              throw new BadRequestException('No primary asset found for user');
            }

            // Validate main bet amount using fine-grained limits
            await this.validateBetAmountWithType(
              dto.betAmount,
              primaryAsset,
              BetTypeCategory.BLACKJACK_MAIN,
              'Main bet',
            );

            // Validate side bet amounts using fine-grained limits
            if (dto.perfectPairsBet) {
              await this.validateBetAmountWithType(
                dto.perfectPairsBet,
                primaryAsset,
                BetTypeCategory.BLACKJACK_PERFECT_PAIRS,
                'Perfect Pairs side bet',
              );
            }

            if (dto.twentyOnePlusThreeBet) {
              await this.validateBetAmountWithType(
                dto.twentyOnePlusThreeBet,
                primaryAsset,
                BetTypeCategory.BLACKJACK_21_PLUS_3,
                '21+3 side bet',
              );
            }

            // Calculate total bet amount including side bets
            let totalBetAmount = new BigNumber(dto.betAmount);
            if (dto.perfectPairsBet) {
              totalBetAmount = totalBetAmount.plus(new BigNumber(dto.perfectPairsBet));
            }
            if (dto.twentyOnePlusThreeBet) {
              totalBetAmount = totalBetAmount.plus(new BigNumber(dto.twentyOnePlusThreeBet));
            }

            // House edge per component (%): main 0.57, PerfectPairs 2.0, 21+3 3.68
            const mainHe = 0.57;
            const ppHe = 2.0;
            const plus3He = 3.68;
            const mainBet = new BigNumber(dto.betAmount);
            const ppBet = new BigNumber(dto.perfectPairsBet || '0');
            const plus3Bet = new BigNumber(dto.twentyOnePlusThreeBet || '0');
            const weightedHe = totalBetAmount.isGreaterThan(0)
              ? mainBet
                  .multipliedBy(mainHe)
                  .plus(ppBet.multipliedBy(ppHe))
                  .plus(plus3Bet.multipliedBy(plus3He))
                  .dividedBy(totalBetAmount)
                  .toNumber()
              : mainHe;

            const operationId = randomUUID();
            const balanceResult = await this.balanceService.updateBalance({
              operation: BalanceOperationEnum.BET,
              operationId,
              userId: user.id,
              amount: totalBetAmount,
              asset: primaryAsset,
              description: 'Blackjack bet with side bets',
              houseEdge: weightedHe,
              metadata: { gameSessionId: dto.gameSessionId },
            });

            if (!balanceResult.success) {
              throw new BadRequestException(
                balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
              );
            }

            // Generate provably fair outcome using centralized service
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.BLACKJACK,
              dto.betAmount,
            );

            // Extract seeds and nonce from outcome
            const { serverSeed, clientSeed, nonce: nonceStr } = gameOutcome;
            const serverSeedHash = this.hashServerSeed(serverSeed);

            // INFINITE DECK MODEL: Generate cards on-demand using cursor
            let cardCursor = 0;

            // Deal initial cards using cursor-based generation
            const playerCard1 = this.cardService.generateCard(
              serverSeed,
              clientSeed,
              nonceStr,
              cardCursor++,
            );
            const playerCard2 = this.cardService.generateCard(
              serverSeed,
              clientSeed,
              nonceStr,
              cardCursor++,
            );
            const dealerCard1 = this.cardService.generateCard(
              serverSeed,
              clientSeed,
              nonceStr,
              cardCursor++,
            );
            const dealerCard2 = this.cardService.generateCard(
              serverSeed,
              clientSeed,
              nonceStr,
              cardCursor++,
            );

            this.logger.debug(
              `🃏 Infinite deck - Initial cards dealt with cursor positions 0-3 for game ${dto.gameSessionId}`,
            );

            const playerCards: Card[] = [playerCard1, playerCard2];
            const dealerCards: Card[] = [dealerCard1, dealerCard2];

            // Calculate initial scores
            const playerScores = this.gameLogicService.calculateScore(playerCards);
            const dealerScores = this.gameLogicService.calculateScore(dealerCards);

            // Extract fiat preservation data for display consistency
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              dto.betAmount,
              primaryAsset,
            );

            // Create game record with asset from primary wallet
            const game = this.blackjackGameRepository.create({
              id: randomUUID(),
              userId: user.id,
              gameSessionId: dto.gameSessionId,
              betAmount: dto.betAmount,
              totalBetAmount: totalBetAmount.toString(), // Initialize with main bet
              totalWinAmount: '0',
              asset: primaryAsset,
              status: BlackjackGameStatus.ACTIVE,
              playerCards,
              dealerCards,
              cardCursor, // INFINITE DECK: Track cursor instead of deck
              playerScore: playerScores.hard,
              playerSoftScore: playerScores.soft,
              dealerScore: dealerScores.hard,
              dealerSoftScore: dealerScores.soft,
              perfectPairsBet: dto.perfectPairsBet,
              twentyOnePlusThreeBet: dto.twentyOnePlusThreeBet,
              serverSeed,
              serverSeedHash,
              clientSeed,
              nonce: nonceStr,
              gameHistory: [
                {
                  action: 'deal',
                  timestamp: new Date(),
                  playerCards: [...playerCards] as Card[],
                  dealerCards: [...dealerCards] as Card[],
                },
              ],
              // Include fiat preservation data
              originalFiatAmount: fiatData.originalFiatAmount,
              originalFiatCurrency: fiatData.originalFiatCurrency,
              fiatToUsdRate: fiatData.fiatToUsdRate,
            });

            // BUG 2 FIX: Evaluate side bets BEFORE checking blackjack scenarios
            // Side bets resolve immediately after deal, before insurance or blackjack checks
            // This ensures side bet winnings are available to include in totalWinAmount
            this.creditSideBetWinnings(user.id, game);

            // Check for blackjacks
            const playerHasBlackjack = this.gameLogicService.isBlackjack(playerCards);
            const dealerHasBlackjack = this.gameLogicService.isBlackjack(dealerCards);
            const dealerShowsAce = dealerCards[0].rank === 'A';
            const dealerShowsTen = ['10', 'J', 'Q', 'K'].includes(dealerCards[0].rank);

            // Handle different blackjack scenarios
            if (dealerHasBlackjack && dealerShowsTen) {
              // Dealer has blackjack and shows 10-value card - immediate game end (no insurance possible)
              game.status = BlackjackGameStatus.COMPLETED;

              if (playerHasBlackjack) {
                // Both have blackjack - push (return bet)
                this.setGamePayout(game, dto.betAmount, true, true, false);

                // BUG 2 FIX: Include side bet winnings in totalWinAmount
                const mainHandAmount = new BigNumber(game.winAmount || '0');
                const sideBetWinnings = new BigNumber(game.perfectPairsWin || '0').plus(
                  new BigNumber(game.twentyOnePlusThreeWin || '0'),
                );
                const totalWinnings = mainHandAmount.plus(sideBetWinnings);

                game.totalWinAmount = totalWinnings.decimalPlaces(8).toString();

                // Credit all winnings (main bet push + side bets)
                if (totalWinnings.isGreaterThan(0)) {
                  await this.creditWinnings(
                    user.id,
                    totalWinnings,
                    game.asset as AssetTypeEnum,
                    game,
                  );
                }
              } else {
                // Only dealer has blackjack - player loses main bet
                this.setGamePayout(game, dto.betAmount, false, false, false);

                // BUG 2 FIX: Player loses main bet but may still win side bets
                const sideBetWinnings = new BigNumber(game.perfectPairsWin || '0').plus(
                  new BigNumber(game.twentyOnePlusThreeWin || '0'),
                );

                game.totalWinAmount = sideBetWinnings.decimalPlaces(8).toString();

                // Credit side bet winnings if any
                if (sideBetWinnings.isGreaterThan(0)) {
                  await this.creditWinnings(
                    user.id,
                    sideBetWinnings,
                    game.asset as AssetTypeEnum,
                    game,
                  );
                }
              }
            } else if (dealerHasBlackjack && dealerShowsAce) {
              // Dealer has blackjack and shows ace - game will end after insurance decision
              // For now, mark game as active to allow insurance action, but dealer blackjack will be revealed
              game.status = BlackjackGameStatus.ACTIVE;

              if (playerHasBlackjack) {
                // Player also has blackjack - will be push after insurance is handled
                // Game stays active for insurance decision
              } else {
                // Only dealer has blackjack - player will lose after insurance decision
                // Game stays active for insurance decision
              }
            } else if (playerHasBlackjack && !dealerHasBlackjack && !dealerShowsAce) {
              // Player blackjack, dealer doesn't have blackjack and doesn't show ace - immediate win 3:2
              game.status = BlackjackGameStatus.COMPLETED;
              this.setGamePayout(game, dto.betAmount, true, false, true);

              // BUG 2 FIX: Include side bet winnings in totalWinAmount
              const mainHandAmount = new BigNumber(game.winAmount || '0');
              const sideBetWinnings = new BigNumber(game.perfectPairsWin || '0').plus(
                new BigNumber(game.twentyOnePlusThreeWin || '0'),
              );
              const totalWinnings = mainHandAmount.plus(sideBetWinnings);

              game.totalWinAmount = totalWinnings.decimalPlaces(8).toString();

              // Credit all winnings (blackjack + side bets)
              await this.creditWinnings(user.id, totalWinnings, game.asset as AssetTypeEnum, game);
            } else if (playerHasBlackjack && !dealerHasBlackjack && dealerShowsAce) {
              // Player blackjack, dealer shows ace but doesn't have blackjack - wait for insurance decision
              // Game stays active to allow insurance action, then will resolve player blackjack
              game.status = BlackjackGameStatus.ACTIVE;
            } else {
              // No blackjacks or only dealer shows ace without blackjack - normal game flow
              game.status = BlackjackGameStatus.ACTIVE;
            }

            // BUG 2 FIX: Side bets are now evaluated BEFORE blackjack scenarios (line 472)
            // This ensures side bet winnings are included in totalWinAmount for immediate game end

            await queryRunner.manager.save(game);

            // Only save to user_bets table when game is completed (like dice does)
            // Blackjack games can be multi-turn, so we only record the final result
            this.logger.log(`🎯 DEBUG startGame: game.status=${game.status}, game.id=${game.id}`);
            if (game.status === BlackjackGameStatus.COMPLETED) {
              const totalBetAmountBN = new BigNumber(game.totalBetAmount || game.betAmount);
              const totalWinAmountBN = new BigNumber(game.totalWinAmount || '0');
              const currentMultiplier = totalBetAmountBN.isGreaterThan(0)
                ? totalWinAmountBN.dividedBy(totalBetAmountBN).toString()
                : game.payoutMultiplier || '0.00';

              try {
                // Calculate total fiat amount based on total bet ratio
                let totalFiatAmount = game.originalFiatAmount;
                if (game.originalFiatAmount && game.totalBetAmount && dto.betAmount) {
                  const baseFiatAmount = new BigNumber(game.originalFiatAmount);
                  const originalCryptoBet = new BigNumber(dto.betAmount);
                  const totalCryptoBet = new BigNumber(game.totalBetAmount);

                  // Calculate ratio of total bet to original bet
                  const betRatio = totalCryptoBet.dividedBy(originalCryptoBet);
                  totalFiatAmount = baseFiatAmount.multipliedBy(betRatio).toFixed(2);
                }

                this.logger.warn('🔧 FIAT_PRESERVATION_FIX_APPLIED', {
                  gameId: game.id,
                  originalFiatAmount: game.originalFiatAmount,
                  totalFiatAmount,
                  isDoubleDown: game.isDoubleDown,
                  isSplit: game.isSplit,
                  isSplitDoubleDown: game.isSplitDoubleDown,
                });

                await this.userBetService.createUserBet({
                  game: GameTypeEnum.BLACKJACK,
                  betId: game.id,
                  userId: user.id,
                  betAmount: game.totalBetAmount || dto.betAmount,
                  asset: primaryAsset,
                  multiplier: currentMultiplier || game.payoutMultiplier || '0.00',
                  payout: game.totalWinAmount || game.winAmount || '0',
                  // Include fiat preservation data from game entity
                  originalFiatAmount: totalFiatAmount,
                  originalFiatCurrency: game.originalFiatCurrency,
                  fiatToUsdRate: game.fiatToUsdRate,
                });
              } catch (error) {
                this.logger.error('Failed to record blackjack bet in user_bets table', {
                  gameId: game.id,
                  userId: user.id,
                  betAmount: dto.betAmount,
                  error: error instanceof Error ? error.message : String(error),
                });
                // Don't fail the entire transaction if user_bets recording fails
              }
            }

            await queryRunner.commitTransaction();

            return this.mapToResponseDto(game, user.id);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error starting blackjack game for user ${user.id}:`, error);

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to start blackjack game');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for blackjack game start', {
          userId: user.id,
          betAmount: dto.betAmount,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async performAction(
    user: UserEntity,
    dto: BlackjackActionDto,
  ): Promise<BlackjackGameResponseDto> {
    // Acquire distributed lock for user's blackjack game action
    const lockKey = LockKeyBuilder.gameBlackjack(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation for game actions
        async () => {
          this.logger.log(
            `🎮 performAction called: userId=${user.id}, gameId=${dto.gameId}, action=${dto.action}`,
          );
          this.logger.debug(`Lock acquired for blackjack game action: ${lockKey}`);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const game = await queryRunner.manager.findOne(BlackjackGameEntity, {
              where: { id: dto.gameId, userId: user.id },
              lock: { mode: 'pessimistic_write' },
            });

            if (!game) {
              throw new NotFoundException('Game not found');
            }

            if (game.status !== BlackjackGameStatus.ACTIVE) {
              throw new BadRequestException('Game is not active');
            }

            // Delegate action processing to BlackjackActionService
            const actionDto = {
              action: dto.action,
              insuranceBet: undefined, // Insurance bet is calculated as half of bet amount in ActionService
            };

            const actionResult = await this.actionService.processAction(user, game, actionDto);

            if (!actionResult.success) {
              throw new BadRequestException(
                actionResult.error || `Failed to process action ${dto.action}`,
              );
            }

            await queryRunner.manager.save(game);

            // Create UserBet record if game is now completed
            const gameStatus = game.status as BlackjackGameStatus;
            this.logger.log(
              `🎯 DEBUG performAction: game.status=${gameStatus}, game.id=${game.id}, action=${dto.action}`,
            );
            this.logger.log(
              `🎯 DEBUG performAction: typeof status=${typeof gameStatus}, BlackjackGameStatus.COMPLETED=${BlackjackGameStatus.COMPLETED}`,
            );
            this.logger.log(
              `🎯 DEBUG performAction: status comparison: ${gameStatus} === ${BlackjackGameStatus.COMPLETED} = ${gameStatus === BlackjackGameStatus.COMPLETED}`,
            );
            if (gameStatus === BlackjackGameStatus.COMPLETED) {
              this.logger.log(`🎯 Creating user bet for completed game ${game.id}`);

              // 🚨 CRITICAL FIX: Credit winnings to user balance for wins and pushes
              // Handle both main hand and split hand winnings
              let totalWinningsToCredit = new BigNumber(0);

              const mainWinAmount = new BigNumber(game.winAmount || '0');
              const splitWinAmount = new BigNumber(game.splitWinAmount || '0');
              const perfectPairsWinAmount = new BigNumber(game.perfectPairsWin || '0');
              const twentyOnePlusThreeWinAmount = new BigNumber(game.twentyOnePlusThreeWin || '0');
              const insuranceWinAmount = new BigNumber(game.insuranceWin || '0');

              if (mainWinAmount.isGreaterThan(0)) {
                totalWinningsToCredit = totalWinningsToCredit.plus(mainWinAmount);
              }

              if (splitWinAmount.isGreaterThan(0)) {
                totalWinningsToCredit = totalWinningsToCredit.plus(splitWinAmount);
              }

              // Include side bet winnings in total calculation
              if (perfectPairsWinAmount.isGreaterThan(0)) {
                totalWinningsToCredit = totalWinningsToCredit.plus(perfectPairsWinAmount);
              }

              if (twentyOnePlusThreeWinAmount.isGreaterThan(0)) {
                totalWinningsToCredit = totalWinningsToCredit.plus(twentyOnePlusThreeWinAmount);
              }

              if (insuranceWinAmount.isGreaterThan(0)) {
                totalWinningsToCredit = totalWinningsToCredit.plus(insuranceWinAmount);
              }

              // Set totalWinAmount to the actual total winnings amount (including side bets)
              game.totalWinAmount = totalWinningsToCredit.decimalPlaces(8).toString();

              if (totalWinningsToCredit.isGreaterThan(0)) {
                await this.creditWinnings(
                  user.id,
                  totalWinningsToCredit,
                  game.asset as AssetTypeEnum,
                  game,
                );
              }

              // Save game after setting totalWinAmount and crediting winnings
              await queryRunner.manager.save(game);

              // Calculate multiplier and payout for bet feed
              const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);
              const totalWinAmount = new BigNumber(game.totalWinAmount || game.winAmount || '0');
              const currentMultiplier = totalBetAmount.isGreaterThan(0)
                ? totalWinAmount.dividedBy(totalBetAmount)
                : new BigNumber(game.payoutMultiplier || '0.00');

              this.logger.debug(`🎯 USER BET CREATION DEBUG - Game ${game.id}:`);
              this.logger.debug(
                `  game.betAmount=${game.betAmount}, game.totalBetAmount=${game.totalBetAmount}`,
              );
              this.logger.debug(`  calculated totalBetAmount=${totalBetAmount.toString()}`);
              this.logger.debug(
                `  isDoubleDown=${game.isDoubleDown}, isSplitDoubleDown=${game.isSplitDoubleDown}`,
              );

              // Payout should be actual winnings returned (0 for losses, not negative)
              const actualPayout = totalWinAmount; // This is what player actually receives

              // Calculate total fiat amount based on total bet ratio
              let totalFiatAmount = game.originalFiatAmount;
              if (game.originalFiatAmount && game.totalBetAmount && game.betAmount) {
                const baseFiatAmount = new BigNumber(game.originalFiatAmount);

                // Use the same logic as the rest of the codebase for getting original bet amount
                const originalBetAmount =
                  game.isDoubleDown && !game.isSplit
                    ? new BigNumber(game.betAmount).dividedBy(2).toFixed(8)
                    : game.betAmount;

                const totalCryptoBet = new BigNumber(game.totalBetAmount);
                const originalCryptoBet = new BigNumber(originalBetAmount);
                const betRatio = totalCryptoBet.dividedBy(originalCryptoBet);
                totalFiatAmount = baseFiatAmount.multipliedBy(betRatio).toFixed(2);
              }

              this.logger.debug(
                `📊 FIAT_PRESERVATION - Second createUserBet call (Game ${game.id}):`,
              );
              this.logger.debug(`  Original fiat: ${game.originalFiatAmount}`);
              this.logger.debug(`  Total fiat calculated: ${totalFiatAmount}`);
              this.logger.debug(`  isDoubleDown: ${game.isDoubleDown}, isSplit: ${game.isSplit}`);

              try {
                await this.userBetService.createUserBet({
                  game: GameTypeEnum.BLACKJACK,
                  betId: game.id,
                  userId: user.id,
                  betAmount: game.totalBetAmount || game.betAmount,
                  asset: game.asset,
                  multiplier: currentMultiplier.toFixed(4),
                  payout: actualPayout.toFixed(8),
                  // Include fiat preservation data from game entity
                  originalFiatAmount: totalFiatAmount,
                  originalFiatCurrency: game.originalFiatCurrency,
                  fiatToUsdRate: game.fiatToUsdRate,
                });
              } catch (error) {
                this.logger.error('Failed to record blackjack bet in user_bets table', {
                  gameId: game.id,
                  userId: user.id,
                  betAmount: game.betAmount,
                  error: error instanceof Error ? error.message : String(error),
                });
                // Don't fail the entire transaction if user_bets recording fails
              }
            }

            await queryRunner.commitTransaction();

            return this.mapToResponseDto(game, user.id);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error performing blackjack action:`, error);

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to perform action');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for blackjack action', {
          userId: user.id,
          gameId: dto.gameId,
          action: dto.action,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async getCurrentGame(userId: string): Promise<BlackjackGameResponseDto | null> {
    const game = await this.blackjackGameRepository.findOne({
      where: {
        userId,
        status: BlackjackGameStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });

    if (!game) {
      return null;
    }

    return this.mapToResponseDto(game, userId);
  }

  async getGameHistory(userId: string, limit: number = 50): Promise<BlackjackGameResponseDto[]> {
    const games = await this.blackjackGameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return Promise.all(games.map((game) => this.mapToResponseDto(game)));
  }

  /**
   * Get user bet data by bet ID for fiat payout calculation
   */
  private async getUserBetById(betId: string): Promise<any> {
    return await this.userBetService.getUserBetById(GameTypeEnum.BLACKJACK, betId);
  }

  async getBetById(
    betId: string,
    requestingUserId?: string,
  ): Promise<BlackjackBetDetailsResponseDto> {
    const game = await this.blackjackGameRepository.findOne({
      where: { id: betId },
      relations: ['user'],
    });

    if (!game) {
      throw new NotFoundException('Bet not found');
    }

    // Phase 1: Check if requesting user is the bet owner
    const isOwner = requestingUserId === game.userId;

    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === game.userId);

    const userInfo: BetUserInfoDto | null = game.user?.isPrivate
      ? null
      : {
          id: game.user.id,
          userName: game.user.displayName || game.user.username,
          levelImageUrl: userVipStatus?.vipLevelImage || '',
        };

    // Calculate proper bet amounts for display
    // game.betAmount = current bet per hand (may be doubled for double down)
    // game.totalBetAmount = total crypto bet including all additional bets
    // For mainBetAmount: show original bet per hand (before doubling)
    let originalMainBetAmount: string;

    if (game.isSplit) {
      // For split games: betAmount is per hand, so mainBetAmount should be betAmount
      originalMainBetAmount = game.betAmount;
    } else if (game.isDoubleDown) {
      // For double down (non-split): betAmount is doubled, so divide by 2 for original
      originalMainBetAmount = new BigNumber(game.betAmount).dividedBy(2).toFixed(8);
    } else {
      // For regular games: betAmount is the original bet
      originalMainBetAmount = game.betAmount;
    }

    // Calculate display amounts and multiplier based on game type
    let displayWinAmount: string;
    let effectiveMultiplier: BigNumber;

    if (game.isSplit) {
      // For split games: combine both hand winnings and calculate total multiplier
      const mainWin = new BigNumber(game.winAmount || '0');
      const splitWin = new BigNumber(game.splitWinAmount || '0');
      const totalWin = mainWin.plus(splitWin);

      displayWinAmount = totalWin.toFixed(8);

      // Calculate effective multiplier for split games based on total winnings vs total bet
      const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);
      effectiveMultiplier = totalBetAmount.isGreaterThan(0)
        ? totalWin.dividedBy(totalBetAmount)
        : new BigNumber('0');
    } else {
      // For non-split games: use totalWinAmount for multiplier but only main bet winnings for display
      // The multiplier should reflect all winnings (including side bets) vs all bets
      const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);
      const totalWinAmount = new BigNumber(game.totalWinAmount || game.winAmount || '0');
      effectiveMultiplier = totalBetAmount.isGreaterThan(0)
        ? totalWinAmount.dividedBy(totalBetAmount)
        : new BigNumber(game.payoutMultiplier || '0');

      // However, for display purposes, we should only show main bet winnings in winAmount
      // The side bet winnings are already displayed separately in their own fields
      displayWinAmount = game.winAmount || '0';
    }

    // Get fiat preservation data from user_bets table for payout calculation
    const userBet = await this.getUserBetById(game.id);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;
    let totalBetFiatAmount: string | undefined;

    // CRITICAL FIX: Use game entity fiat data instead of user_bets table
    // The game entity has the most up-to-date fiat preservation data after splits/doubles
    // The user_bets table might have stale data if created before all additional bets were made
    if (game.originalFiatAmount && game.originalFiatCurrency) {
      const baseFiatAmount = new BigNumber(game.originalFiatAmount); // User's original input

      // Calculate total fiat bet based on crypto bet ratio
      // originalFiatAmount represents the base bet, we need to scale it by the crypto ratio
      const originalCrypto = new BigNumber(originalMainBetAmount);
      const totalCrypto = new BigNumber(game.totalBetAmount || game.betAmount);
      const cryptoRatio = totalCrypto.dividedBy(originalCrypto);

      const totalFiatBet = baseFiatAmount.multipliedBy(cryptoRatio);
      const calculatedPayoutFiat = totalFiatBet.multipliedBy(effectiveMultiplier);

      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = game.originalFiatCurrency;
      totalBetFiatAmount = totalFiatBet.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
    } else if (userBet?.originalFiatAmount && userBet.originalFiatCurrency) {
      // Fallback to user_bets table if game entity doesn't have fiat data
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(effectiveMultiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
      totalBetFiatAmount = fiatBetAmount.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
    }

    // Base response without fiat preservation data
    const baseResponse = {
      id: game.id,
      gameSessionId: game.gameSessionId,
      mainBetAmount: originalMainBetAmount,
      betAmount: game.totalBetAmount || game.betAmount,
      asset: game.asset,
      status: game.status,
      playerCards: game.playerCards,
      dealerCards: game.dealerCards,
      splitCards: game.splitCards,
      playerScore: game.playerScore,
      playerSoftScore: game.playerSoftScore,
      splitScore: game.splitScore,
      splitSoftScore: game.splitSoftScore,
      dealerScore: game.dealerScore,
      dealerSoftScore: game.dealerSoftScore,
      isDoubleDown: game.isDoubleDown,
      isSplitDoubleDown: game.isSplitDoubleDown,
      isInsurance: game.isInsurance,
      isSplit: game.isSplit,
      playerHandStatus: game.playerHandStatus,
      splitHandStatus: game.splitHandStatus,
      activeHand: game.activeHand,
      perfectPairsBet: game.perfectPairsBet,
      twentyOnePlusThreeBet: game.twentyOnePlusThreeBet,
      perfectPairsWin: game.perfectPairsWin,
      twentyOnePlusThreeWin: game.twentyOnePlusThreeWin,
      insuranceBet: game.insuranceBet,
      insuranceWin: game.insuranceWin,
      winAmount: displayWinAmount,
      payoutMultiplier: effectiveMultiplier.toFixed(2),
      splitWinAmount: game.splitWinAmount,
      splitPayoutMultiplier: game.splitPayoutMultiplier,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      user: userInfo,
    };

    // Phase 1: Only include fiat preservation data for bet owner's personal records
    if (isOwner) {
      return {
        ...baseResponse,
        originalFiatAmount: game.originalFiatAmount || userBet?.originalFiatAmount,
        originalFiatCurrency:
          (game.originalFiatCurrency as CurrencyEnum) || userBet?.originalFiatCurrency,
        totalBetFiatAmount,
        payoutFiatAmount,
        payoutFiatCurrency,
      };
    }

    return baseResponse;
  }

  private async creditWinnings(
    userId: string,
    amount: BigNumber,
    asset: AssetTypeEnum,
    game: BlackjackGameEntity,
  ): Promise<void> {
    // Additional check for invalid amount before crediting
    if (!amount.isFinite() || amount.isLessThan(0)) {
      this.logger.error(`Invalid credit amount`, {
        userId,
        amount: amount.toString(),
      });
      throw new InternalServerErrorException('Invalid credit amount');
    }

    const operationId = randomUUID();
    const result = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.WIN,
      operationId,
      userId,
      amount: amount.decimalPlaces(8),
      asset,
      description: 'Blackjack win',
      metadata: { gameId: game.id },
    });

    if (!result.success) {
      this.logger.error(`Failed to credit winnings for user ${userId}`, {
        error: result.error,
        amount,
      });
      throw new InternalServerErrorException('Failed to process winnings');
    }

    // Note: Do not modify game.totalWinAmount here - it should be set by the game logic
    // The creditWinnings method only handles balance updates, not game state
  }

  private creditSideBetWinnings(userId: string, game: BlackjackGameEntity): void {
    // Use asset from game object (already set during game creation)
    const primaryAsset = game.asset as AssetTypeEnum;
    if (!primaryAsset) {
      throw new BadRequestException('Primary asset not found in game');
    }

    // Use dedicated service to evaluate all side bets
    const sideBetResults = this.sideBetsService.evaluateAllSideBets(game);

    // Set win amounts on game object
    game.perfectPairsWin = sideBetResults.perfectPairsWin;
    game.twentyOnePlusThreeWin = sideBetResults.twentyOnePlusThreeWin;

    // NOTE: Do NOT add side bet winnings to game.totalWinAmount here - this causes double counting
    // Side bet winnings are stored in perfectPairsWin/twentyOnePlusThreeWin and will be included
    // in the final totalWinAmount calculation in performAction() method
  }

  private async getAvailableActions(
    game: BlackjackGameEntity,
    userId?: string,
  ): Promise<BlackjackAction[]> {
    // Use the new BlackjackGameLogicService which includes balance checking
    return await this.gameLogicService.getAvailableActions(game, userId);
  }

  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  private async mapToResponseDto(
    game: BlackjackGameEntity,
    userId?: string,
  ): Promise<BlackjackGameResponseDto> {
    const dealerCardsToShow =
      game.status === BlackjackGameStatus.ACTIVE
        ? [game.dealerCards[0]] // Only show first card when game is active
        : game.dealerCards;

    // Calculate proper bet amounts for display
    // For split games, betAmount is the main bet per hand
    // For double down only (no split), betAmount is doubled, so divide by 2
    const originalBetAmount =
      game.isDoubleDown && !game.isSplit
        ? new BigNumber(game.betAmount).dividedBy(2).toFixed(8)
        : game.betAmount;

    // Calculate proper win amount and multiplier for display
    let displayWinAmount: string;
    let currentMultiplier: BigNumber;

    if (game.isSplit) {
      // For split games: combine individual hand winnings
      const mainWin = new BigNumber(game.winAmount || '0');
      const splitWin = new BigNumber(game.splitWinAmount || '0');
      const totalWin = mainWin.plus(splitWin);

      displayWinAmount = totalWin.toFixed(8);

      // Calculate effective multiplier based on total winnings vs total bet
      const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);
      currentMultiplier = totalBetAmount.isGreaterThan(0)
        ? totalWin.dividedBy(totalBetAmount)
        : new BigNumber('0');
    } else {
      // For non-split games: use existing totalWinAmount logic
      displayWinAmount = game.totalWinAmount || game.winAmount || '0';
      const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);
      const totalWinAmount = new BigNumber(displayWinAmount);
      currentMultiplier = totalBetAmount.isGreaterThan(0)
        ? totalWinAmount.dividedBy(totalBetAmount)
        : new BigNumber(game.payoutMultiplier || '0');
    }

    // Get fiat preservation data from user_bets table for payout calculation
    const userBet = await this.getUserBetById(game.id);

    // Calculate fiat payout if fiat data exists (legacy support)
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;
    let totalBetFiatAmount: string | undefined;

    // CRITICAL FIX: Use game entity fiat data and calculate total bet correctly
    // The originalFiatAmount is the base bet, totalBetFiatAmount should be scaled by crypto ratio
    if (game.originalFiatAmount && game.originalFiatCurrency) {
      const baseFiatAmount = new BigNumber(game.originalFiatAmount);

      // Calculate the original bet per hand for ratio calculation
      let originalBetPerHand: string;
      if (game.isSplit) {
        originalBetPerHand = game.betAmount;
      } else if (game.isDoubleDown) {
        originalBetPerHand = new BigNumber(game.betAmount).dividedBy(2).toString();
      } else {
        originalBetPerHand = game.betAmount;
      }

      // Calculate total fiat bet based on crypto ratio
      const originalCrypto = new BigNumber(originalBetPerHand);
      const totalCrypto = new BigNumber(game.totalBetAmount || game.betAmount);
      const cryptoRatio = totalCrypto.dividedBy(originalCrypto);

      const totalFiatBet = baseFiatAmount.multipliedBy(cryptoRatio);
      const calculatedPayoutFiat = totalFiatBet.multipliedBy(currentMultiplier);

      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = game.originalFiatCurrency;
      totalBetFiatAmount = totalFiatBet.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
    } else if (userBet?.originalFiatAmount && userBet.originalFiatCurrency) {
      // Fallback to user_bets table if game entity doesn't have fiat data
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(currentMultiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
      totalBetFiatAmount = fiatBetAmount.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
    }

    return {
      id: game.id,
      gameSessionId: game.gameSessionId,
      mainBetAmount: originalBetAmount,
      betAmount: game.totalBetAmount || game.betAmount,
      asset: game.asset,
      status: game.status,
      playerCards: game.playerCards,
      dealerCards: dealerCardsToShow,
      splitCards: game.splitCards || [],
      splitedCards: game.splitCards || [],
      playerScore: game.playerScore,
      playerSoftScore: game.playerSoftScore,
      splitScore: game.splitScore || 0,
      splitSoftScore: game.splitSoftScore || 0,
      dealerScore: game.status === BlackjackGameStatus.ACTIVE ? 0 : game.dealerScore,
      dealerSoftScore: game.status === BlackjackGameStatus.ACTIVE ? 0 : game.dealerSoftScore,
      isDoubleDown: game.isDoubleDown,
      isSplitDoubleDown: game.isSplitDoubleDown || false,
      isInsurance: game.isInsurance,
      insuranceBet: game.insuranceBet,
      insuranceWin: game.insuranceWin,
      isSplit: game.isSplit || false,
      playerHandStatus: game.playerHandStatus,
      splitHandStatus: game.splitHandStatus,
      activeHand: game.activeHand || 'main',
      perfectPairsBet: game.perfectPairsBet,
      twentyOnePlusThreeBet: game.twentyOnePlusThreeBet,
      perfectPairsWin: game.perfectPairsWin,
      twentyOnePlusThreeWin: game.twentyOnePlusThreeWin,
      winAmount: displayWinAmount,
      payoutMultiplier: currentMultiplier.toString(),
      splitWinAmount: game.splitWinAmount,
      splitPayoutMultiplier: game.splitPayoutMultiplier || '0.00',
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: game.status === BlackjackGameStatus.COMPLETED ? game.serverSeed : undefined,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      ratio: this.generatePayoutRatio(game),
      availableActions: await this.getAvailableActions(game, userId),
      originalFiatAmount: game.originalFiatAmount || userBet?.originalFiatAmount,
      originalFiatCurrency:
        (game.originalFiatCurrency as CurrencyEnum) || userBet?.originalFiatCurrency,
      fiatToUsdRate: game.fiatToUsdRate || userBet?.fiatToUsdRate,
      totalBetFiatAmount,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }

  /**
   * Generate payout ratio information for completed games with wins
   * Based on actual game outcome types, not payout multipliers
   */
  private generatePayoutRatio(game: BlackjackGameEntity): BlackjackPayoutRatio | undefined {
    const ratio: BlackjackPayoutRatio = {};

    // Main hand ratio - based on hand status and win amount
    if (game.winAmount && parseFloat(game.winAmount) > 0) {
      if (game.playerHandStatus === HandStatus.BLACKJACK) {
        ratio.main = '3:2'; // Natural blackjack (21 with 2 cards)
      } else {
        ratio.main = '1:1'; // Regular win
      }
    } else if (parseFloat(game.payoutMultiplier) === 1.0) {
      ratio.main = '1:0'; // Push (tie)
    }

    // Split hand ratio - based on split hand status and win amount
    // BUG FIX: Split hands can NEVER be blackjack, so removed that check
    // Per spec: "21 after split is NOT blackjack (pays 1:1, not 3:2)"
    if (game.isSplit && game.splitWinAmount && parseFloat(game.splitWinAmount) > 0) {
      ratio.split = '1:1'; // Split hands always pay regular win rate, never blackjack rate
    } else if (game.isSplit && parseFloat(game.splitPayoutMultiplier || '0') === 1.0) {
      ratio.split = '1:0'; // Push on split hand
    }
    // Perfect Pairs ratio
    if (game.perfectPairsWin && parseFloat(game.perfectPairsWin) > 0) {
      const playerCards =
        game.isSplit && game.splitCards && game.splitCards.length > 0
          ? [game.playerCards[0], game.splitCards[0]]
          : game.playerCards;
      const perfectPairsResult = this.sideBetsService.evaluatePerfectPairs(playerCards);
      if (perfectPairsResult.multiplier === 6) {
        ratio.perfectPairs = '6:1'; // Mixed pair
      } else if (perfectPairsResult.multiplier === 12) {
        ratio.perfectPairs = '12:1'; // Colored pair
      } else if (perfectPairsResult.multiplier === 25) {
        ratio.perfectPairs = '25:1'; // Perfect pair
      }
    }

    // 21+3 ratio
    if (game.twentyOnePlusThreeWin && parseFloat(game.twentyOnePlusThreeWin) > 0) {
      const playerCards =
        game.isSplit && game.splitCards && game.splitCards.length > 0
          ? [game.playerCards[0], game.splitCards[0]]
          : game.playerCards;

      const twentyOnePlus3Result = this.sideBetsService.evaluate21Plus3(
        playerCards,
        game.dealerCards[0],
      );
      if (twentyOnePlus3Result.multiplier === 5) {
        ratio.twentyOnePlusThree = '5:1'; // Flush
      } else if (twentyOnePlus3Result.multiplier === 10) {
        ratio.twentyOnePlusThree = '10:1'; // Straight
      } else if (twentyOnePlus3Result.multiplier === 30) {
        ratio.twentyOnePlusThree = '30:1'; // Three of a kind
      } else if (twentyOnePlus3Result.multiplier === 40) {
        ratio.twentyOnePlusThree = '40:1'; // Straight flush
      } else if (twentyOnePlus3Result.multiplier === 100) {
        ratio.twentyOnePlusThree = '100:1'; // Suited trips
      }
    }

    // Insurance ratio
    if (game.insuranceWin && parseFloat(game.insuranceWin) > 0) {
      ratio.insurance = '2:1';
    }

    // Return ratio only if there are any wins to show
    return Object.keys(ratio).length > 0 ? ratio : undefined;
  }
}
