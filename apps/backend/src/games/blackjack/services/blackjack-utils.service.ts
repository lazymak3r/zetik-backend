// TODO: remove this unused service and update tests
import { Injectable, Logger } from '@nestjs/common';
import { BlackjackGameEntity, BlackjackGameStatus, Card, HandStatus } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';

export interface IGameStateValidation {
  isGameActive: boolean;
  canPerformActions: boolean;
  requiresDealerPlay: boolean;
  isCompleted: boolean;
}

export interface ISplitGameStatus {
  bothHandsFinished: boolean;
  shouldSwitchToSplit: boolean;
  mainHandFinished: boolean;
  splitHandFinished: boolean;
  gameCompleted: boolean;
}

export interface IBlackjackUtils {
  checkIfGameCompleted(game: BlackjackGameEntity): boolean;
  validateGameState(game: BlackjackGameEntity): IGameStateValidation;
  getSplitGameStatus(game: BlackjackGameEntity): ISplitGameStatus;
  formatBetAmount(amount: string | number, precision?: number): string;
  calculateSingleHandBet(totalBet: string): string;
  formatCardDisplay(cards: Card[]): string;
  validateBetAmount(betAmount: string): boolean;
  isValidUUID(uuid: string): boolean;
  formatDebugMessage(prefix: string, gameId: string, message: string): string;
  sanitizeGameData(game: Partial<BlackjackGameEntity>): Partial<BlackjackGameEntity>;
  getBlackjackProbabilities(): {
    playerBlackjack: number;
    dealerBlackjack: number;
    playerBust: number;
    dealerBust: number;
    push: number;
  };
  calculateExpectedValue(
    betAmount: string,
    scenarios: {
      winProbability: number;
      lossProbability: number;
      pushProbability: number;
      blackjackProbability: number;
    },
  ): string;
  shouldDealerContinue(dealerCards: Card[]): boolean;
}

@Injectable()
export class BlackjackUtilsService implements IBlackjackUtils {
  private readonly logger = new Logger(BlackjackUtilsService.name);

  // CASINO STANDARD: Minimum and maximum bet validation
  private readonly MIN_BET = '0.00000001'; // 1 satoshi
  private readonly MAX_BET = '1000000'; // 1M units
  private readonly DEFAULT_PRECISION = 8;

  /**
   * CASINO STANDARD: Check if split game is completed and handle hand switching
   * Returns true if game status was changed to completed
   */
  checkIfGameCompleted(game: BlackjackGameEntity): boolean {
    if (!game.isSplit) {
      return false;
    }

    // Check if we need to switch from main to split hand
    if (this.shouldSwitchToSplitHand(game)) {
      game.activeHand = 'split';
      this.logger.debug(`🎯 Switched to split hand for game ${game.id}`);
      return false; // Continue playing split hand
    }

    // Check if both hands are finished
    const splitStatus = this.getSplitGameStatus(game);
    if (splitStatus.gameCompleted) {
      game.status = BlackjackGameStatus.COMPLETED;
      this.logger.debug(`🎯 Split game completed for game ${game.id}`);
      return true;
    }

    return false;
  }

  /**
   * CASINO STANDARD: Validate game state and determine allowed actions
   */
  validateGameState(game: BlackjackGameEntity): IGameStateValidation {
    const isGameActive =
      game.status === BlackjackGameStatus.ACTIVE || game.status === BlackjackGameStatus.DEALER_TURN;

    const isCompleted = game.status === BlackjackGameStatus.COMPLETED;

    const canPerformActions =
      isGameActive &&
      (game.playerHandStatus === HandStatus.ACTIVE ||
        (game.isSplit && game.splitHandStatus === HandStatus.ACTIVE));

    const requiresDealerPlay =
      game.status === BlackjackGameStatus.DEALER_TURN ||
      game.playerHandStatus === HandStatus.STAND ||
      game.playerHandStatus === HandStatus.BLACKJACK;

    return {
      isGameActive,
      canPerformActions,
      requiresDealerPlay,
      isCompleted,
    };
  }

  /**
   * CASINO STANDARD: Get detailed split game status
   */
  getSplitGameStatus(game: BlackjackGameEntity): ISplitGameStatus {
    if (!game.isSplit) {
      return {
        bothHandsFinished: false,
        shouldSwitchToSplit: false,
        mainHandFinished: false,
        splitHandFinished: false,
        gameCompleted: false,
      };
    }

    const mainHandFinished = game.playerHandStatus
      ? this.isHandFinished(game.playerHandStatus)
      : false;
    const splitHandFinished = game.splitHandStatus
      ? this.isHandFinished(game.splitHandStatus)
      : false;
    const bothHandsFinished = mainHandFinished && splitHandFinished;

    const shouldSwitchToSplit =
      game.activeHand === 'main' && mainHandFinished && game.splitHandStatus === HandStatus.ACTIVE;

    return {
      bothHandsFinished,
      shouldSwitchToSplit,
      mainHandFinished,
      splitHandFinished,
      gameCompleted: bothHandsFinished,
    };
  }

  /**
   * CASINO STANDARD: Format bet amount with proper precision
   */
  formatBetAmount(amount: string | number, precision: number = this.DEFAULT_PRECISION): string {
    try {
      const betAmount = new BigNumber(amount);
      if (betAmount.isNaN() || !betAmount.isFinite()) {
        return '0.00000000';
      }
      return betAmount.toFixed(precision);
    } catch {
      this.logger.error('Failed to format bet amount', { betAmount: amount.toString() });
      return '0.00000000';
    }
  }

  /**
   * CASINO STANDARD: Calculate single hand bet for split games
   * Returns the original bet amount (each split hand gets full original bet)
   */
  calculateSingleHandBet(totalBet: string): string {
    try {
      const totalBetBN = new BigNumber(totalBet);
      if (totalBetBN.isNaN() || !totalBetBN.isFinite()) {
        return '0.00000000';
      }
      // In split games, totalBet represents 2x original bet (one for each hand)
      // So we divide by 2 to get the original bet amount that each hand uses
      const singleHandBet = totalBetBN.dividedBy(2);
      return this.formatBetAmount(singleHandBet.toString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calculating single hand bet: ${errorMessage}`);
      return '0.00000000';
    }
  }

  /**
   * UTILITY: Format cards for display/debugging
   */
  formatCardDisplay(cards: Card[]): string {
    if (!cards || cards.length === 0) {
      return '[]';
    }

    return cards.map((card) => `${card.rank}${this.getSuitSymbol(card.suit)}`).join(', ');
  }

  /**
   * ANTI-FRAUD: Validate bet amount format and range
   */
  validateBetAmount(betAmount: string): boolean {
    try {
      const amount = new BigNumber(betAmount);

      // Check if valid number
      if (amount.isNaN() || !amount.isFinite()) {
        return false;
      }

      // Check minimum bet (must be positive and at least MIN_BET)
      if (amount.isLessThan(this.MIN_BET)) {
        return false;
      }

      // Check maximum bet
      if (amount.isGreaterThan(this.MAX_BET)) {
        return false;
      }

      // Check precision (max 8 decimal places)
      const decimals = amount.decimalPlaces();
      if (decimals && decimals > this.DEFAULT_PRECISION) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * VALIDATION: Check if string is a valid UUID
   */
  isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * DEBUG: Format consistent debug messages
   */
  formatDebugMessage(prefix: string, gameId: string, message: string): string {
    return `🎯 ${prefix}: ${message} (Game: ${gameId})`;
  }

  /**
   * SECURITY: Sanitize game data for logging/responses
   * Removes sensitive information and formats for safe output
   */
  sanitizeGameData(game: Partial<BlackjackGameEntity>): Partial<BlackjackGameEntity> {
    const sanitized = { ...game };

    // Remove sensitive fields that shouldn't be in logs
    delete sanitized.userId; // PII, replace with hash if needed

    // Keep only essential fields for debugging
    return {
      id: sanitized.id,
      status: sanitized.status,
      betAmount: sanitized.betAmount,
      playerHandStatus: sanitized.playerHandStatus,
      splitHandStatus: sanitized.splitHandStatus,
      activeHand: sanitized.activeHand,
      isSplit: sanitized.isSplit,
      playerScore: sanitized.playerScore,
      dealerScore: sanitized.dealerScore,
      createdAt: sanitized.createdAt,
    };
  }

  /**
   * UTILITY: Get mathematical probabilities for game scenarios
   */
  getBlackjackProbabilities(): {
    playerBlackjack: number;
    dealerBlackjack: number;
    playerBust: number;
    dealerBust: number;
    push: number;
  } {
    return {
      playerBlackjack: 0.048, // ~4.8%
      dealerBlackjack: 0.048, // ~4.8%
      playerBust: 0.28, // ~28%
      dealerBust: 0.28, // ~28%
      push: 0.09, // ~9%
    };
  }

  /**
   * UTILITY: Calculate expected value for different scenarios
   */
  calculateExpectedValue(
    betAmount: string,
    scenarios: {
      winProbability: number;
      lossProbability: number;
      pushProbability: number;
      blackjackProbability: number;
    },
  ): string {
    try {
      const bet = new BigNumber(betAmount);
      if (bet.isNaN() || !bet.isFinite()) {
        return '0.00000000';
      }

      // Standard payouts: blackjack 1.5:1, win 1:1, push 0:1, loss -1:1
      // EV = bet * (blackjack_prob * 1.5 + win_prob * 1 + push_prob * 0 + loss_prob * (-1))
      const expectedMultiplier =
        scenarios.blackjackProbability * 1.5 +
        scenarios.winProbability * 1 +
        scenarios.pushProbability * 0 +
        scenarios.lossProbability * -1;

      const totalEV = bet.multipliedBy(expectedMultiplier);

      if (totalEV.isNaN() || !totalEV.isFinite()) {
        return '0.00000000';
      }

      return totalEV.toFixed(this.DEFAULT_PRECISION);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calculating expected value: ${errorMessage}`);
      return '0.00000000';
    }
  }

  /**
   * UTILITY: Check if dealer should continue hitting
   */
  shouldDealerContinue(dealerCards: Card[]): boolean {
    if (!dealerCards || dealerCards.length === 0) {
      return false;
    }

    // Calculate dealer scores
    let hardScore = 0;
    let softScore = 0;
    let hasAce = false;

    for (const card of dealerCards) {
      hardScore += card.value;

      if (card.rank.toLowerCase() === 'a') {
        hasAce = true;
      }
    }

    // Calculate soft score if there's an ace
    if (hasAce && hardScore + 10 <= 21) {
      softScore = hardScore + 10;
    } else {
      softScore = hardScore;
    }

    // CASINO STANDARD: Dealer hits on 16, stands on 17+
    // Dealer stands on soft 17 (better for players)
    const bestScore = softScore <= 21 ? softScore : hardScore;

    return bestScore < 17; // Hit on 16 or less, stand on 17+
  }

  /**
   * PRIVATE: Check if a hand is finished (not active)
   */
  private isHandFinished(handStatus: HandStatus): boolean {
    return (
      handStatus === HandStatus.STAND ||
      handStatus === HandStatus.BUST ||
      handStatus === HandStatus.BLACKJACK ||
      handStatus === HandStatus.COMPLETED
    );
  }

  /**
   * PRIVATE: Check if should switch from main to split hand
   */
  private shouldSwitchToSplitHand(game: BlackjackGameEntity): boolean {
    return (
      game.activeHand === 'main' &&
      this.isHandFinished(game.playerHandStatus) &&
      game.splitHandStatus === HandStatus.ACTIVE
    );
  }

  /**
   * PRIVATE: Get suit symbol for display
   */
  private getSuitSymbol(suit: string): string {
    const suitSymbols: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };

    return suitSymbols[suit.toLowerCase()] || suit.charAt(0).toUpperCase();
  }
}
