import { Injectable, Logger } from '@nestjs/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BlackjackAction,
  BlackjackGameEntity,
  BlackjackGameStatus,
  HandStatus,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { BalanceService } from '../../../balance/balance.service';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';
import { BlackjackCardService } from './blackjack-card.service';
import { BlackjackGameLogicService } from './blackjack-game-logic.service';
import { BlackjackPayoutService } from './blackjack-payout.service';

export interface BlackjackGameActionDto {
  action: BlackjackAction;
  insuranceBet?: string;
}

export interface IActionResult {
  success: boolean;
  gameCompleted: boolean;
  switchedHand?: boolean;
  error?: string;
}

export interface IBlackjackAction {
  processAction(
    user: UserEntity,
    game: BlackjackGameEntity,
    dto: BlackjackGameActionDto,
  ): Promise<IActionResult>;
  handleHit(game: BlackjackGameEntity): IActionResult;
  handleStand(game: BlackjackGameEntity): IActionResult;
  handleDouble(game: BlackjackGameEntity, userId: string): Promise<IActionResult>;
  handleInsurance(
    game: BlackjackGameEntity,
    userId: string,
    insuranceBet: string,
  ): Promise<IActionResult>;
  handleNoInsurance(game: BlackjackGameEntity): IActionResult;
  handleSplit(game: BlackjackGameEntity, userId: string): Promise<IActionResult>;
  handleHitSplit(game: BlackjackGameEntity): IActionResult;
  handleStandSplit(game: BlackjackGameEntity): IActionResult;
  handleDoubleSplit(game: BlackjackGameEntity, userId: string): Promise<IActionResult>;
  checkIfGameCompleted(game: BlackjackGameEntity): boolean;
  completeSplitGame(game: BlackjackGameEntity): void;
  validateAction(
    game: BlackjackGameEntity,
    action: BlackjackAction,
    userId?: string,
  ): Promise<boolean>;
}

@Injectable()
export class BlackjackActionService implements IBlackjackAction {
  private readonly logger = new Logger(BlackjackActionService.name);

  constructor(
    private readonly balanceService: BalanceService,
    private readonly gameLogicService: BlackjackGameLogicService,
    private readonly payoutService: BlackjackPayoutService,
    private readonly cardService: BlackjackCardService,
  ) {}

  /**
   * INFINITE DECK: Deal a card using cursor-based generation
   * Increments the game's cardCursor and generates the next card
   */
  private dealCardFromInfiniteDeck(game: BlackjackGameEntity) {
    const newCard = this.cardService.generateCard(
      game.serverSeed,
      game.clientSeed,
      game.nonce,
      game.cardCursor,
    );

    game.cardCursor++; // Increment cursor for next card

    this.logger.debug(
      `🃏 Card dealt: ${newCard.rank} of ${newCard.suit} (cursor: ${game.cardCursor - 1})`,
    );

    return newCard;
  }

  /**
   * CASINO STANDARD: Main action dispatcher
   * Validates action availability and delegates to specific handlers
   */
  async processAction(
    user: UserEntity,
    game: BlackjackGameEntity,
    dto: BlackjackGameActionDto,
  ): Promise<IActionResult> {
    try {
      // Validate action is available
      const availableActions = await this.gameLogicService.getAvailableActions(game, user.id);
      if (!availableActions.includes(dto.action)) {
        return {
          success: false,
          gameCompleted: false,
          error: `Action ${dto.action} is not available`,
        };
      }

      let result: IActionResult;

      // Dispatch to appropriate handler
      switch (dto.action) {
        case BlackjackAction.HIT:
          result = this.handleHit(game);
          break;
        case BlackjackAction.STAND:
          result = this.handleStand(game);
          break;
        case BlackjackAction.DOUBLE:
          result = await this.handleDouble(game, user.id);
          break;
        case BlackjackAction.INSURANCE:
          result = await this.handleInsurance(game, user.id, dto.insuranceBet || '0');
          break;
        case BlackjackAction.NO_INSURANCE:
          result = this.handleNoInsurance(game);
          break;
        case BlackjackAction.SPLIT:
          result = await this.handleSplit(game, user.id);
          break;
        case BlackjackAction.HIT_SPLIT:
          result = this.handleHitSplit(game);
          break;
        case BlackjackAction.STAND_SPLIT:
          result = this.handleStandSplit(game);
          break;
        case BlackjackAction.DOUBLE_SPLIT:
          result = await this.handleDoubleSplit(game, user.id);
          break;
        default:
          return {
            success: false,
            gameCompleted: false,
            error: 'Invalid action',
          };
      }

      // Add action to game history
      if (!game.gameHistory) {
        game.gameHistory = [];
      }
      game.gameHistory.push({
        action: dto.action,
        timestamp: new Date(),
        playerCards: [...game.playerCards],
        splitCards: game.splitCards ? [...game.splitCards] : undefined,
        dealerCards: [...game.dealerCards],
        activeHand: game.activeHand,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing action ${dto.action}: ${errorMessage}`, {
        gameId: game.id,
        userId: user.id,
      });

      return {
        success: false,
        gameCompleted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * CASINO STANDARD: Handle HIT action
   * Deals one card to player's active hand
   */
  handleHit(game: BlackjackGameEntity): IActionResult {
    // 🚨 CRITICAL FIX: Check dealer blackjack before any player action
    // This handles the case where player declined insurance but dealer has blackjack
    const dealerHasBlackjack = this.gameLogicService.isBlackjack(game.dealerCards);
    const playerHasBlackjack = this.gameLogicService.isBlackjack(game.playerCards);

    if (dealerHasBlackjack) {
      // Dealer has blackjack - game ends immediately, don't deal more cards
      game.status = BlackjackGameStatus.COMPLETED;

      if (playerHasBlackjack) {
        // Both have blackjack - push (return bet)
        this.payoutService.setGamePayout(game, game.betAmount, true, true, false);
        // Set totalWinAmount for push (bet returned) - BlackjackService will credit
        const pushAmount = new BigNumber(game.winAmount || '0');
        game.totalWinAmount = pushAmount.decimalPlaces(8).toString();
      } else {
        // Only dealer has blackjack - player loses
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        game.totalWinAmount = '0.00000000';
      }
      return { success: true, gameCompleted: true };
    }

    // INFINITE DECK: Generate card using cursor-based approach
    const newCard = this.dealCardFromInfiniteDeck(game);
    game.playerCards.push(newCard);

    const scores = this.gameLogicService.calculateScore(game.playerCards);
    game.playerScore = scores.hard;
    game.playerSoftScore = scores.soft;

    // CASINO STANDARD: Check for bust (>21)
    if (this.gameLogicService.isPlayerBust(game.playerCards)) {
      // Player bust
      if (game.isSplit) {
        // In split game, mark this hand as bust and check if we should switch hands
        game.playerHandStatus = HandStatus.BUST;
        const gameCompleted = this.checkIfGameCompleted(game);

        // If both hands are done, complete the game
        if (gameCompleted) {
          this.completeSplitGame(game);
        }

        return { success: true, gameCompleted };
      } else {
        // Regular game - end immediately
        game.status = BlackjackGameStatus.COMPLETED;
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        return { success: true, gameCompleted: true };
      }
    }

    // 🚨 CRITICAL FIX: Auto-complete when player hits exactly 21
    const playerBestScore = this.gameLogicService.getBestScore(
      game.playerScore,
      game.playerSoftScore,
    );
    if (playerBestScore === 21 && !this.gameLogicService.isBlackjack(game.playerCards)) {
      // Player has 21 (but not blackjack) - auto-complete and dealer plays
      if (game.isSplit) {
        // In split game, mark this hand as completed and check if we should switch hands
        game.playerHandStatus = HandStatus.COMPLETED;

        // Check if we need to switch to split hand
        if (game.activeHand === 'main' && game.splitHandStatus === HandStatus.ACTIVE) {
          game.activeHand = 'split';
          return { success: true, gameCompleted: false, switchedHand: true };
        }

        const gameCompleted = this.checkIfGameCompleted(game);
        if (gameCompleted) {
          this.completeSplitGame(game);
        }

        return { success: true, gameCompleted };
      } else {
        // Regular game - auto-stand and let dealer play
        return this.handleStand(game);
      }
    }

    return { success: true, gameCompleted: false };
  }

  /**
   * CASINO STANDARD: Handle STAND action
   * Player chooses to keep current hand
   */
  handleStand(game: BlackjackGameEntity): IActionResult {
    if (game.isSplit) {
      // In split game, mark this hand as stand and check if we should switch hands
      game.playerHandStatus = HandStatus.STAND;

      // FIXED: Always switch to split hand when standing on main hand,
      // regardless of split hand status (to show user the split hand result)
      if (game.activeHand === 'main') {
        game.activeHand = 'split';

        // If split hand is already completed (BLACKJACK/COMPLETED),
        // game should complete after showing the split hand
        const gameCompleted = this.checkIfGameCompleted(game);

        if (gameCompleted) {
          this.completeSplitGame(game);
          return { success: true, gameCompleted: true, switchedHand: true };
        }

        return { success: true, gameCompleted: false, switchedHand: true };
      }

      // If we're on split hand, check completion
      const gameCompleted = this.checkIfGameCompleted(game);

      // If both hands are done, complete the game
      if (gameCompleted) {
        this.completeSplitGame(game);
      }

      return { success: true, gameCompleted };
    }

    // 🚨 CRITICAL FIX: Check dealer blackjack before continuing game
    // This handles the case where player declined insurance but dealer has blackjack
    const dealerHasBlackjack = this.gameLogicService.isBlackjack(game.dealerCards);
    const playerHasBlackjack = this.gameLogicService.isBlackjack(game.playerCards);

    if (dealerHasBlackjack) {
      // Dealer has blackjack - game ends immediately
      game.status = BlackjackGameStatus.COMPLETED;

      if (playerHasBlackjack) {
        // Both have blackjack - push (return bet)
        this.payoutService.setGamePayout(game, game.betAmount, true, true, false);
        // Set totalWinAmount for push (bet returned) - BlackjackService will credit
        const pushAmount = new BigNumber(game.winAmount || '0');
        game.totalWinAmount = pushAmount.decimalPlaces(8).toString();
      } else {
        // Only dealer has blackjack - player loses
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        game.totalWinAmount = '0.00000000';
      }
      return { success: true, gameCompleted: true };
    }

    // Regular game flow - dealer plays
    game.status = BlackjackGameStatus.DEALER_TURN;

    // CASINO STANDARD: Dealer hits on 16, stands on 17
    while (this.gameLogicService.shouldDealerHit(game.dealerCards)) {
      // INFINITE DECK: Generate card using cursor-based approach
      const newCard = this.dealCardFromInfiniteDeck(game);
      game.dealerCards.push(newCard);

      const scores = this.gameLogicService.calculateScore(game.dealerCards);
      game.dealerScore = scores.hard;
      game.dealerSoftScore = scores.soft;
    }

    // Determine winner
    game.status = BlackjackGameStatus.COMPLETED;
    const playerBestScore = this.gameLogicService.getBestScore(
      game.playerScore,
      game.playerSoftScore,
    );
    const dealerBestScore = this.gameLogicService.getBestScore(
      game.dealerScore,
      game.dealerSoftScore,
    );

    // CRITICAL FIX: For double down, use only the doubled main bet amount (betAmount * 2)
    // Do NOT use totalBetAmount as it includes side bets which are resolved separately
    // Side bets do NOT participate in main hand payouts
    const effectiveBetAmount = game.isDoubleDown
      ? new BigNumber(game.betAmount).multipliedBy(2).toFixed(8)
      : game.betAmount;

    if (this.gameLogicService.isDealerBust(game.dealerCards) || playerBestScore > dealerBestScore) {
      // Player wins
      this.payoutService.setGamePayout(game, effectiveBetAmount, false, false, true);
    } else if (playerBestScore === dealerBestScore) {
      // Push
      this.payoutService.setGamePayout(game, effectiveBetAmount, false, true, false);
    } else {
      // Dealer wins
      this.payoutService.setGamePayout(game, effectiveBetAmount, false, false, false);
    }

    return { success: true, gameCompleted: true };
  }

  /**
   * CASINO STANDARD: Handle DOUBLE action
   * Double bet amount, deal one card, auto-stand
   */
  async handleDouble(game: BlackjackGameEntity, userId: string): Promise<IActionResult> {
    // 🚨 CRITICAL FIX: Check dealer blackjack before double down
    // This handles the case where player declined insurance but dealer has blackjack
    const dealerHasBlackjack = this.gameLogicService.isBlackjack(game.dealerCards);
    const playerHasBlackjack = this.gameLogicService.isBlackjack(game.playerCards);

    if (dealerHasBlackjack) {
      // Dealer has blackjack - game ends immediately, don't charge double bet
      game.status = BlackjackGameStatus.COMPLETED;

      if (playerHasBlackjack) {
        // Both have blackjack - push (return bet)
        this.payoutService.setGamePayout(game, game.betAmount, true, true, false);
        // Set totalWinAmount for push (bet returned) - BlackjackService will credit
        const pushAmount = new BigNumber(game.winAmount || '0');
        game.totalWinAmount = pushAmount.decimalPlaces(8).toString();
      } else {
        // Only dealer has blackjack - player loses
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        game.totalWinAmount = '0.00000000';
      }
      return { success: true, gameCompleted: true };
    }

    if (game.isSplit) {
      // SIMPLE: Use original bet amount stored in betAmount field
      const originalBet = new BigNumber(game.betAmount);

      // Deduct additional bet for main hand double
      const operationId = randomUUID();
      const balanceResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId,
        userId,
        amount: originalBet,
        asset: game.asset as AssetTypeEnum,
        description: 'Blackjack main hand double down',
        metadata: { gameId: game.id },
      });

      if (!balanceResult.success) {
        return {
          success: false,
          gameCompleted: false,
          error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
        };
      }

      game.isDoubleDown = true;

      // SIMPLE: Add the double amount to total bet
      const newTotalBet = new BigNumber(game.totalBetAmount || game.betAmount)
        .plus(originalBet)
        .decimalPlaces(8)
        .toString();

      this.logger.debug(
        `🎯 DEBUG handleDouble (main hand): originalBet=${originalBet.toString()}, oldTotal=${game.totalBetAmount}, newTotal=${newTotalBet}`,
      );

      game.totalBetAmount = newTotalBet;

      // NOTE: Do NOT save here - the transaction is managed by the calling service
      // Saving here causes a deadlock because the game entity is already locked by the transaction

      // Deal one card and auto-stand
      const hitResult = this.handleHit(game);
      if (!hitResult.success) {
        return hitResult;
      }

      if (game.playerHandStatus === HandStatus.ACTIVE) {
        game.playerHandStatus = HandStatus.STAND;
      }

      // FIXED: Always switch to split hand when main hand gets 21,
      // regardless of split hand status (to show user the split hand result)
      if (game.activeHand === 'main') {
        game.activeHand = 'split';

        const gameCompleted = this.checkIfGameCompleted(game);

        if (gameCompleted) {
          this.completeSplitGame(game);
          return { success: true, gameCompleted: true, switchedHand: true };
        }

        return { success: true, gameCompleted: false, switchedHand: true };
      }

      // If we're on split hand, check completion
      const gameCompleted = this.checkIfGameCompleted(game);

      // If both hands are done, complete the game
      if (gameCompleted) {
        this.completeSplitGame(game);
      }

      return { success: true, gameCompleted };
    }

    // Regular game flow
    // Deduct additional bet (equal to original bet)
    const operationId = randomUUID();
    const originalBetAmount = new BigNumber(game.betAmount);
    const balanceResult = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.BET,
      operationId,
      userId,
      amount: originalBetAmount,
      asset: game.asset as AssetTypeEnum,
      description: 'Blackjack double down',
      metadata: { gameId: game.id },
    });

    if (!balanceResult.success) {
      return {
        success: false,
        gameCompleted: false,
        error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
      };
    }

    // SIMPLE: Mark as doubled and add double amount to total
    game.isDoubleDown = true;

    // Add the double amount to total bet
    game.totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount)
      .plus(originalBetAmount)
      .decimalPlaces(8)
      .toString();

    // NOTE: Do NOT save here - the transaction is managed by the calling service
    // Saving here causes a deadlock because the game entity is already locked by the transaction

    // Deal one card and stand
    const hitResult = this.handleHit(game);
    if (!hitResult.success) {
      return hitResult;
    }

    if (game.status === BlackjackGameStatus.ACTIVE) {
      return this.handleStand(game);
    }

    return { success: true, gameCompleted: true };
  }

  /**
   * CASINO STANDARD: Handle INSURANCE action
   * Bet up to half of original bet that dealer has blackjack
   */
  async handleInsurance(
    game: BlackjackGameEntity,
    userId: string,
    insuranceBet: string,
  ): Promise<IActionResult> {
    // If no insurance bet amount provided, use standard amount (half of original bet)
    const standardInsuranceAmount = new BigNumber(game.betAmount).dividedBy(2).decimalPlaces(8);
    const insuranceBetAmount =
      insuranceBet && new BigNumber(insuranceBet).isGreaterThan(0)
        ? new BigNumber(insuranceBet).decimalPlaces(8)
        : standardInsuranceAmount;

    // CASINO STANDARD: Insurance cannot exceed half of original bet
    if (insuranceBetAmount.isGreaterThan(standardInsuranceAmount)) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Insurance bet cannot exceed half of original bet',
      };
    }

    // Deduct insurance bet
    const operationId = randomUUID();
    const balanceResult = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.BET,
      operationId,
      userId,
      amount: insuranceBetAmount,
      asset: game.asset as AssetTypeEnum,
      description: 'Blackjack insurance',
      metadata: { gameId: game.id },
    });

    if (!balanceResult.success) {
      return {
        success: false,
        gameCompleted: false,
        error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
      };
    }

    game.isInsurance = true;
    game.insuranceBet = insuranceBetAmount.toFixed(8);

    // BUG FIX: Preserve existing totalBetAmount (includes side bets) and add insurance on top
    game.totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount)
      .plus(insuranceBetAmount)
      .decimalPlaces(8)
      .toFixed(8);

    // Check dealer blackjack (after insurance decision made)
    const dealerHasBlackjack = this.gameLogicService.isBlackjack(game.dealerCards);
    const playerHasBlackjack = this.gameLogicService.isBlackjack(game.playerCards);

    if (dealerHasBlackjack) {
      // Dealer has blackjack - resolve game
      game.status = BlackjackGameStatus.COMPLETED;

      // CASINO STANDARD: Insurance wins 2:1 (bet returned + 2x profit = 3x total)
      const insuranceWin = insuranceBetAmount
        .multipliedBy(3)
        .decimalPlaces(8, BigNumber.ROUND_DOWN);
      game.insuranceWin = insuranceWin.toFixed(8);

      // BUG FIX: Do NOT credit insurance winnings immediately
      // Store in game.insuranceWin and let BlackjackService credit everything at once
      // This prevents double crediting and ensures totalWinAmount includes ALL winnings

      // Main bet resolution
      if (playerHasBlackjack) {
        // Both have blackjack - push (return bet)
        this.payoutService.setGamePayout(game, game.betAmount, true, true, false);
        // BUG FIX: Include insurance winnings in totalWinAmount
        const pushAmount = new BigNumber(game.winAmount || '0');
        const totalWinnings = pushAmount.plus(insuranceWin);
        game.totalWinAmount = totalWinnings.toFixed(8);
      } else {
        // Only dealer has blackjack - player loses main bet
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        // BUG FIX: totalWinAmount should only include insurance winnings (main bet lost)
        game.totalWinAmount = insuranceWin.toFixed(8);
      }

      return { success: true, gameCompleted: true };
    } else {
      // Dealer does NOT have blackjack
      // Insurance loses: bet is forfeited (no payout, bet already deducted)
      game.insuranceWin = '0';

      // BUG FIX: Check if player has blackjack
      if (playerHasBlackjack) {
        // Player has blackjack, dealer doesn't - player wins 3:2
        game.status = BlackjackGameStatus.COMPLETED;
        this.payoutService.setGamePayout(game, game.betAmount, true, false, true);
        // totalWinAmount is just the blackjack payout (insurance already lost)
        game.totalWinAmount = game.winAmount || '0';
        return { success: true, gameCompleted: true };
      }

      // Game continues normally (neither has blackjack)
      return { success: true, gameCompleted: false };
    }
  }

  /**
   * CASINO STANDARD: Handle NO_INSURANCE action
   * Player declines insurance offer - check for blackjacks and resolve accordingly
   */
  handleNoInsurance(game: BlackjackGameEntity): IActionResult {
    // Mark that insurance was rejected
    game.isInsuranceRejected = true;
    game.isInsurance = false;

    // No balance deduction occurs (player declined)

    // BUG FIX: Check for blackjacks after insurance decision (per spec)
    const dealerHasBlackjack = this.gameLogicService.isBlackjack(game.dealerCards);
    const playerHasBlackjack = this.gameLogicService.isBlackjack(game.playerCards);

    if (dealerHasBlackjack) {
      // Dealer has blackjack
      game.status = BlackjackGameStatus.COMPLETED;

      if (playerHasBlackjack) {
        // Both have blackjack - push (return bet)
        this.payoutService.setGamePayout(game, game.betAmount, true, true, false);
        game.totalWinAmount = game.winAmount || '0';
      } else {
        // Only dealer has blackjack - player loses main bet
        this.payoutService.setGamePayout(game, game.betAmount, false, false, false);
        game.totalWinAmount = '0';
      }

      return { success: true, gameCompleted: true };
    } else if (playerHasBlackjack) {
      // Player has blackjack, dealer doesn't - player wins 3:2
      game.status = BlackjackGameStatus.COMPLETED;
      this.payoutService.setGamePayout(game, game.betAmount, true, false, true);
      game.totalWinAmount = game.winAmount || '0';
      return { success: true, gameCompleted: true };
    }

    // Neither has blackjack - game continues normally
    return { success: true, gameCompleted: false };
  }

  /**
   * CASINO STANDARD: Handle SPLIT action
   * Split matching cards into two separate hands
   */
  async handleSplit(game: BlackjackGameEntity, userId: string): Promise<IActionResult> {
    // Validate split is possible
    if (game.playerCards.length !== 2) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Can only split with exactly 2 cards',
      };
    }

    const [card1, card2] = game.playerCards;
    if (card1.value !== card2.value) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Can only split cards of same value',
      };
    }

    if (game.isSplit) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Already split',
      };
    }

    // Deduct additional bet for split hand
    const operationId = randomUUID();
    const balanceResult = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.BET,
      operationId,
      userId,
      amount: new BigNumber(game.betAmount),
      asset: game.asset as AssetTypeEnum,
      description: 'Blackjack split',
      metadata: { gameId: game.id },
    });

    if (!balanceResult.success) {
      return {
        success: false,
        gameCompleted: false,
        error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
      };
    }

    // INFINITE DECK: Always has cards available

    // CASINO STANDARD: Create proper split - separate hands
    // Main hand: keep first card, deal new card
    const newCard1 = this.dealCardFromInfiniteDeck(game);
    game.playerCards = [card1, newCard1];

    // Split hand: second card + new card
    const newCard2 = this.dealCardFromInfiniteDeck(game);
    game.splitCards = [card2, newCard2];

    // Calculate scores for both hands
    const playerScores = this.gameLogicService.calculateScore(game.playerCards);
    game.playerScore = playerScores.hard;
    game.playerSoftScore = playerScores.soft;

    const splitScores = this.gameLogicService.calculateScore(game.splitCards);
    game.splitScore = splitScores.hard;
    game.splitSoftScore = splitScores.soft;

    // Set split state
    game.isSplit = true;
    game.activeHand = 'main'; // Start with main hand

    // Set initial hand statuses
    game.playerHandStatus = HandStatus.ACTIVE;
    game.splitHandStatus = HandStatus.ACTIVE;

    // CASINO STANDARD: Split Aces Special Rule
    // When splitting aces, each hand receives exactly 1 card and auto-completes (no further actions)
    const isSplittingAces = card1.rank === 'A';

    if (isSplittingAces) {
      // Mark this as a split aces game
      game.isSplitAces = true;

      // Both hands automatically complete after receiving 1 card each
      game.playerHandStatus = HandStatus.COMPLETED;
      game.splitHandStatus = HandStatus.COMPLETED;

      // Switch to split hand to show user both hands before completing
      game.activeHand = 'split';

      // Check if either hand is blackjack (A + 10-value card)
      // Note: Even though it's 21, split aces that get 10-value still pay 1:1 (not 3:2)
      const mainHandIsBlackjack = this.gameLogicService.isBlackjack(game.playerCards);
      const splitHandIsBlackjack = this.gameLogicService.isBlackjack(game.splitCards);

      // Mark as blackjack for scoring purposes, but payout is still 1:1 (handled in payout logic)
      if (mainHandIsBlackjack) {
        game.playerHandStatus = HandStatus.BLACKJACK;
      }
      if (splitHandIsBlackjack) {
        game.splitHandStatus = HandStatus.BLACKJACK;
      }

      // BUG FIX: Calculate total bet amount before completing the game
      const originalMainBet = new BigNumber(game.betAmount);
      game.totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount)
        .plus(originalMainBet)
        .decimalPlaces(8)
        .toFixed(8);

      // BUG FIX: Complete the game immediately for split aces
      // Dealer cards are already present, run dealer logic and evaluate
      this.completeSplitGame(game);

      // BUG FIX: Return gameCompleted: true since split aces auto-complete
      return { success: true, gameCompleted: true };
    } else {
      // Regular split (non-aces): Check if hands are blackjack (A + 10-value card)
      const mainHandIsBlackjack = this.gameLogicService.isBlackjack(game.playerCards);
      const splitHandIsBlackjack = this.gameLogicService.isBlackjack(game.splitCards);

      if (mainHandIsBlackjack) {
        game.playerHandStatus = HandStatus.BLACKJACK;
      }

      if (splitHandIsBlackjack) {
        game.splitHandStatus = HandStatus.BLACKJACK;
      }

      // Determine active hand based on blackjack status
      if (mainHandIsBlackjack && splitHandIsBlackjack) {
        // FIXED: Both hands blackjack - switch to split hand to show user,
        // but don't complete game immediately (let frontend see both hands)
        game.activeHand = 'split';
        // Note: checkIfGameCompleted will be called later to complete the game
      } else if (mainHandIsBlackjack && !splitHandIsBlackjack) {
        // Only main hand blackjack - switch to split hand
        game.activeHand = 'split';
      } else if (!mainHandIsBlackjack && splitHandIsBlackjack) {
        // Only split hand blackjack - stay on main hand
        game.activeHand = 'main';
      }
    }

    // SIMPLE APPROACH: Track each hand's bet separately
    // Main hand keeps original bet, split hand gets same amount
    const originalMainBet = new BigNumber(game.betAmount);

    // Add the split hand bet to total (main hand + split hand)
    game.totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount)
      .plus(originalMainBet)
      .decimalPlaces(8)
      .toFixed(8); // Use toFixed(8) to preserve decimal places

    this.logger.debug(
      `🎯 DEBUG handleSplit: betAmount=${game.betAmount}, totalBetAmount=${game.totalBetAmount}`,
    );

    // Keep betAmount as original for simplicity - we'll track doubles separately
    // game.betAmount stays as original single hand bet

    return { success: true, gameCompleted: false };
  }

  /**
   * CASINO STANDARD: Handle HIT_SPLIT action
   * Deal card to split hand
   */
  handleHitSplit(game: BlackjackGameEntity): IActionResult {
    if (!game.isSplit || !game.splitCards) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Game is not split',
      };
    }

    // INFINITE DECK: Generate card using cursor-based approach
    const newCard = this.dealCardFromInfiniteDeck(game);
    game.splitCards.push(newCard);

    const scores = this.gameLogicService.calculateScore(game.splitCards);
    game.splitScore = scores.hard;
    game.splitSoftScore = scores.soft;

    // Check for bust
    if (game.splitScore > 21) {
      // Split hand bust
      game.splitHandStatus = HandStatus.BUST;
      const gameCompleted = this.checkIfGameCompleted(game);

      if (gameCompleted) {
        this.completeSplitGame(game);
      }

      return { success: true, gameCompleted };
    }

    // 🚨 CRITICAL FIX: Auto-complete when split hand hits exactly 21
    const splitBestScore = this.gameLogicService.getBestScore(game.splitScore, game.splitSoftScore);
    if (splitBestScore === 21 && !this.gameLogicService.isBlackjack(game.splitCards)) {
      // Split hand has 21 (but not blackjack) - auto-complete
      game.splitHandStatus = HandStatus.COMPLETED;

      // Check if game should complete (both hands done)
      const gameCompleted = this.checkIfGameCompleted(game);
      if (gameCompleted) {
        this.completeSplitGame(game);
      }

      return { success: true, gameCompleted };
    }

    return { success: true, gameCompleted: false };
  }

  /**
   * CASINO STANDARD: Handle STAND_SPLIT action
   * Stand on split hand
   */
  handleStandSplit(game: BlackjackGameEntity): IActionResult {
    if (!game.isSplit) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Game is not split',
      };
    }

    game.splitHandStatus = HandStatus.STAND;
    const gameCompleted = this.checkIfGameCompleted(game);

    // If both hands are done, complete the game
    if (gameCompleted) {
      this.completeSplitGame(game);
    }

    return { success: true, gameCompleted };
  }

  /**
   * CASINO STANDARD: Handle DOUBLE_SPLIT action
   * Double down on split hand
   */
  async handleDoubleSplit(game: BlackjackGameEntity, userId: string): Promise<IActionResult> {
    if (!game.isSplit || !game.splitCards) {
      return {
        success: false,
        gameCompleted: false,
        error: 'Game is not split',
      };
    }

    // SIMPLE: Split double uses the original bet amount (same as main hand)
    const originalBet = new BigNumber(game.betAmount);

    try {
      // Deduct additional bet for split double
      const operationId = randomUUID();
      const balanceResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId,
        userId,
        amount: originalBet,
        asset: game.asset as AssetTypeEnum,
        description: 'Blackjack split double down',
        metadata: { gameId: game.id },
      });

      if (!balanceResult.success) {
        return {
          success: false,
          gameCompleted: false,
          error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Balance service error in handleDoubleSplit: ${errorMessage}`);
      return {
        success: false,
        gameCompleted: false,
        error: ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
      };
    }

    game.isSplitDoubleDown = true;

    // SIMPLE: Add the split double amount to total bet
    const newTotalBet = new BigNumber(game.totalBetAmount || '0')
      .plus(originalBet)
      .decimalPlaces(8)
      .toFixed(8); // Use toFixed(8) to preserve decimal places

    this.logger.debug(
      `🎯 DEBUG handleDoubleSplit: originalBet=${originalBet.toString()}, oldTotal=${game.totalBetAmount}, newTotal=${newTotalBet}`,
    );

    game.totalBetAmount = newTotalBet;

    // NOTE: Do NOT save here - the transaction is managed by the calling service
    // Saving here causes a deadlock because the game entity is already locked by the transaction

    // Deal one card and auto-stand
    const hitResult = this.handleHitSplit(game);
    if (!hitResult.success) {
      return hitResult;
    }

    if (game.splitHandStatus === HandStatus.ACTIVE) {
      game.splitHandStatus = HandStatus.STAND;
    }

    const gameCompleted = this.checkIfGameCompleted(game);

    // If both hands are done, complete the game
    if (gameCompleted) {
      this.completeSplitGame(game);
    }

    return { success: true, gameCompleted };
  }

  /**
   * CASINO STANDARD: Check if split game is completed
   * Returns true if game should be marked as completed
   */
  checkIfGameCompleted(game: BlackjackGameEntity): boolean {
    if (!game.isSplit) return false;

    // Check if we need to switch from main to split hand
    if (
      game.activeHand === 'main' &&
      (game.playerHandStatus === HandStatus.STAND ||
        game.playerHandStatus === HandStatus.BUST ||
        game.playerHandStatus === HandStatus.BLACKJACK) &&
      game.splitHandStatus === HandStatus.ACTIVE
    ) {
      game.activeHand = 'split';
      return false; // Continue playing split hand
    }

    const bothHandsFinished =
      (game.playerHandStatus === HandStatus.STAND ||
        game.playerHandStatus === HandStatus.BUST ||
        game.playerHandStatus === HandStatus.BLACKJACK ||
        game.playerHandStatus === HandStatus.COMPLETED) &&
      (game.splitHandStatus === HandStatus.STAND ||
        game.splitHandStatus === HandStatus.BUST ||
        game.splitHandStatus === HandStatus.BLACKJACK ||
        game.splitHandStatus === HandStatus.COMPLETED);

    if (bothHandsFinished) {
      game.status = BlackjackGameStatus.COMPLETED;
      this.logger.log(`Split game completed: ${game.id}`);
      return true;
    }

    return false;
  }

  /**
   * CASINO STANDARD: Complete split game
   * Run dealer logic and evaluate both hands
   */
  completeSplitGame(game: BlackjackGameEntity): void {
    // CASINO STANDARD: Dealer plays according to house rules
    while (this.gameLogicService.shouldDealerHit(game.dealerCards)) {
      // INFINITE DECK: Generate card using cursor-based approach
      const newCard = this.dealCardFromInfiniteDeck(game);
      game.dealerCards.push(newCard);

      const scores = this.gameLogicService.calculateScore(game.dealerCards);
      game.dealerScore = scores.hard;
      game.dealerSoftScore = scores.soft;
    }

    // Evaluate both hands
    this.evaluateSplitGame(game);

    // BUG FIX: Set game status to COMPLETED
    game.status = BlackjackGameStatus.COMPLETED;
  }

  /**
   * CASINO STANDARD: Evaluate split game outcomes
   * Calculate payouts for both hands separately
   */
  private evaluateSplitGame(game: BlackjackGameEntity): void {
    const dealerBestScore = this.gameLogicService.getBestScore(
      game.dealerScore,
      game.dealerSoftScore,
    );
    // SIMPLE: game.betAmount is the original bet per hand (NOT doubled after split)
    // Each hand starts with this amount, then may be doubled via doubledown
    const originalBetPerHand = new BigNumber(game.betAmount);

    this.logger.debug(`🎯 PAYOUT CALCULATION START - Game ${game.id}:`);
    this.logger.debug(
      `  game.betAmount=${game.betAmount}, game.totalBetAmount=${game.totalBetAmount}`,
    );
    this.logger.debug(`  originalBetPerHand=${originalBetPerHand.toString()}`);
    this.logger.debug(
      `  isDoubleDown=${game.isDoubleDown}, isSplitDoubleDown=${game.isSplitDoubleDown}`,
    );

    let totalWinnings = new BigNumber(0);
    let mainHandWinnings = new BigNumber(0); // BUG FIX: Track main hand separately
    let splitHandWinnings = new BigNumber(0); // BUG FIX: Track split hand separately

    // Evaluate main hand
    const playerBestScore = this.gameLogicService.getBestScore(
      game.playerScore,
      game.playerSoftScore,
    );

    // SIMPLE: Calculate main hand bet (original + double if doubled)
    const mainHandBet = game.isDoubleDown ? originalBetPerHand.multipliedBy(2) : originalBetPerHand;
    this.logger.debug(
      `🎯 PAYOUT DEBUG - Main hand: originalBetPerHand=${originalBetPerHand.toString()}, isDoubleDown=${game.isDoubleDown}, mainHandBet=${mainHandBet.toString()}`,
    );

    if (game.playerHandStatus === HandStatus.BUST) {
      // Main hand lost
      this.payoutService.setGamePayout(game, mainHandBet.toFixed(8), false, false, false);
    } else if (game.playerHandStatus === HandStatus.BLACKJACK && dealerBestScore !== 21) {
      // SPEC: 21 after split pays 1:1 (NOT 3:2)
      // Even though status is BLACKJACK, split hands can't get true blackjack payout
      this.payoutService.setGamePayout(game, mainHandBet.toFixed(8), false, false, true);
      const winAmount = mainHandBet.multipliedBy(2).decimalPlaces(8); // 2x (1:1) not 2.5x (3:2)
      mainHandWinnings = winAmount; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(winAmount);
    } else if (
      this.gameLogicService.isDealerBust(game.dealerCards) ||
      playerBestScore > dealerBestScore
    ) {
      // Main hand wins - pay 2:1 on actual bet (includes double if applicable)
      this.payoutService.setGamePayout(game, mainHandBet.toFixed(8), false, false, true);
      const mainHandWinAmount = mainHandBet.multipliedBy(2).decimalPlaces(8);
      mainHandWinnings = mainHandWinAmount; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(mainHandWinAmount);
      this.logger.debug(
        `🎯 Main hand WINS: bet=${mainHandBet.toString()}, payout=${mainHandWinAmount.toString()}, total so far=${totalWinnings.toString()}`,
      );
    } else if (playerBestScore === dealerBestScore) {
      // Main hand push - return actual bet (includes double if applicable)
      this.payoutService.setGamePayout(game, mainHandBet.toFixed(8), false, true, false);
      mainHandWinnings = mainHandBet; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(mainHandBet);
    } else {
      // Main hand lost
      this.payoutService.setGamePayout(game, mainHandBet.toFixed(8), false, false, false);
      this.logger.debug(
        `🎯 Main hand LOST: bet=${mainHandBet.toString()}, payout=0, total so far=${totalWinnings.toString()}`,
      );
    }

    // Evaluate split hand
    const splitBestScore = this.gameLogicService.getBestScore(
      game.splitScore || 0,
      game.splitSoftScore || 0,
    );

    // SIMPLE: Calculate split hand bet (original + double if doubled)
    const splitHandBet = game.isSplitDoubleDown
      ? originalBetPerHand.multipliedBy(2)
      : originalBetPerHand;
    this.logger.debug(
      `🎯 PAYOUT DEBUG - Split hand: originalBetPerHand=${originalBetPerHand.toString()}, isSplitDoubleDown=${game.isSplitDoubleDown}, splitHandBet=${splitHandBet.toString()}`,
    );

    if (game.splitHandStatus === HandStatus.BUST) {
      // Split hand lost
      this.payoutService.setGamePayout(game, splitHandBet.toFixed(8), false, false, false, true);
    } else if (game.splitHandStatus === HandStatus.BLACKJACK && dealerBestScore !== 21) {
      // SPEC: 21 after split pays 1:1 (NOT 3:2)
      // Even though status is BLACKJACK, split hands can't get true blackjack payout
      this.payoutService.setGamePayout(
        game,
        splitHandBet.toFixed(8),
        false, // NOT blackjack payout
        false,
        true,
        true,
      );
      const winAmount = splitHandBet.multipliedBy(2).decimalPlaces(8); // 2x (1:1) not 2.5x (3:2)
      splitHandWinnings = winAmount; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(winAmount);
    } else if (
      this.gameLogicService.isDealerBust(game.dealerCards) ||
      splitBestScore > dealerBestScore
    ) {
      // Split hand wins - pay 2:1 on actual bet (includes double if applicable)
      this.payoutService.setGamePayout(game, splitHandBet.toFixed(8), false, false, true, true);
      const splitHandWinAmount = splitHandBet.multipliedBy(2).decimalPlaces(8);
      splitHandWinnings = splitHandWinAmount; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(splitHandWinAmount);
      this.logger.debug(
        `🎯 Split hand WINS: bet=${splitHandBet.toString()}, payout=${splitHandWinAmount.toString()}, total so far=${totalWinnings.toString()}`,
      );
    } else if (splitBestScore === dealerBestScore) {
      // Split hand push - return actual bet (includes double if applicable)
      this.payoutService.setGamePayout(game, splitHandBet.toFixed(8), false, true, false, true);
      splitHandWinnings = splitHandBet; // BUG FIX: Track separately
      totalWinnings = totalWinnings.plus(splitHandBet);
    } else {
      // Split hand lost
      this.payoutService.setGamePayout(game, splitHandBet.toFixed(8), false, false, false, true);
      this.logger.debug(
        `🎯 Split hand LOST: bet=${splitHandBet.toString()}, payout=0, total so far=${totalWinnings.toString()}`,
      );
    }

    // FIXED: Include side bet winnings in totalWinAmount
    // Side bets were already evaluated during game start and stored in the game object
    const perfectPairsWin = new BigNumber(game.perfectPairsWin || '0');
    const twentyOnePlusThreeWin = new BigNumber(game.twentyOnePlusThreeWin || '0');
    const insuranceWin = new BigNumber(game.insuranceWin || '0');

    // Total winnings includes main game + all side bet winnings
    const totalWinningsIncludingSideBets = totalWinnings
      .plus(perfectPairsWin)
      .plus(twentyOnePlusThreeWin)
      .plus(insuranceWin);

    // Calculate overall payout multiplier for split game
    const totalBetAmount = new BigNumber(game.totalBetAmount || game.betAmount);

    // Handle demo bets (bet amount = 0) - calculate theoretical multiplier
    if (totalBetAmount.isLessThanOrEqualTo(0)) {
      // For demo bets, determine theoretical multiplier based on game outcome
      let theoreticalMultiplier = new BigNumber(0);

      // Calculate what the multiplier would be for each hand
      const mainHandMultiplier = this.getTheoreticalMultiplier(
        game.playerHandStatus,
        undefined, // No dealer hand status in entity
        game.playerScore,
        game.dealerScore,
      );

      const splitHandMultiplier = this.getTheoreticalMultiplier(
        game.splitHandStatus,
        undefined, // No dealer hand status in entity
        game.splitScore,
        game.dealerScore,
      );

      // Average multiplier for both hands (split games have 2 hands)
      theoreticalMultiplier = mainHandMultiplier.plus(splitHandMultiplier).dividedBy(2);

      game.payoutMultiplier = theoreticalMultiplier.toFixed(4);
      game.winAmount = '0.00000000';
      game.totalWinAmount = '0.00000000';
    } else if (totalWinningsIncludingSideBets.isGreaterThan(0)) {
      const overallMultiplier = totalWinningsIncludingSideBets.dividedBy(totalBetAmount);
      game.payoutMultiplier = overallMultiplier.toFixed(4);
      // BUG FIX: Set winAmount to main hand only, splitWinAmount to split hand only
      game.winAmount = mainHandWinnings.toFixed(8); // Main hand only
      game.splitWinAmount = splitHandWinnings.toFixed(8); // Split hand only
      game.totalWinAmount = totalWinningsIncludingSideBets.toFixed(8); // All winnings
    } else {
      game.payoutMultiplier = '0.0000';
      game.winAmount = '0.00000000';
      game.splitWinAmount = '0.00000000'; // BUG FIX: Also reset split amount
      game.totalWinAmount = '0.00000000';
    }

    // DEBUG: Log split game payout calculation
    this.logger.debug(`🎯 Split Payout Debug - Game ${game.id}:`);
    this.logger.debug(`  Original bet per hand: ${originalBetPerHand.toString()}`);
    this.logger.debug(
      `  Main hand doubled: ${game.isDoubleDown} - Bet: ${mainHandBet.toString()} - Status: ${game.playerHandStatus}`,
    );
    this.logger.debug(
      `  Split hand doubled: ${game.isSplitDoubleDown} - Bet: ${splitHandBet.toString()} - Status: ${game.splitHandStatus}`,
    );
    this.logger.debug(
      `  Dealer score: ${dealerBestScore}, Dealer bust: ${this.gameLogicService.isDealerBust(game.dealerCards)}`,
    );
    this.logger.debug(`  Total bet amount: ${game.totalBetAmount}`);
    this.logger.debug(`  Total winnings: ${totalWinnings.toString()}`);
    this.logger.debug(`  Total winnings + side bets: ${totalWinningsIncludingSideBets.toString()}`);
    this.logger.debug(
      `  Final win amount: ${game.winAmount}, Total win amount: ${game.totalWinAmount}`,
    );
    this.logger.debug(`  Payout multiplier: ${game.payoutMultiplier}`);

    // Note: BlackjackService will credit winnings based on game.totalWinAmount
  }

  /**
   * Helper: Calculate theoretical multiplier for demo bets (bet amount = 0)
   * Returns what the multiplier would be based on hand outcome
   */
  private getTheoreticalMultiplier(
    playerStatus: HandStatus | undefined,
    dealerStatus: HandStatus | undefined, // Not used but kept for interface compatibility
    playerScore: number | undefined,
    dealerScore: number | undefined,
  ): BigNumber {
    // If no valid player status, assume loss
    if (!playerStatus) {
      return new BigNumber(0);
    }

    // Player busted = loss
    if (playerStatus === HandStatus.BUST) {
      return new BigNumber(0);
    }

    // Player blackjack (natural 21) = 2.5x (unless dealer also has blackjack - 21 with 2 cards)
    if (playerStatus === HandStatus.BLACKJACK) {
      // Check if dealer also has 21 (blackjack push scenario)
      if (dealerScore === 21) {
        return new BigNumber(1); // Push
      }
      return new BigNumber(2.5); // Blackjack payout
    }

    // Check for dealer bust (score > 21)
    if (dealerScore !== undefined && dealerScore > 21) {
      return new BigNumber(2); // Player wins
    }

    // Compare scores if both are valid
    if (playerScore !== undefined && dealerScore !== undefined) {
      if (playerScore > dealerScore) {
        return new BigNumber(2); // Win
      } else if (playerScore === dealerScore) {
        return new BigNumber(1); // Push
      }
    }

    // Default: loss
    return new BigNumber(0);
  }

  /**
   * ANTI-FRAUD: Validate action is available in current game state
   */
  async validateAction(
    game: BlackjackGameEntity,
    action: BlackjackAction,
    userId?: string,
  ): Promise<boolean> {
    const availableActions = await this.gameLogicService.getAvailableActions(game, userId);
    return availableActions.includes(action);
  }
}
