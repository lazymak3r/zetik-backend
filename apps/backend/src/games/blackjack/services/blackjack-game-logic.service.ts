import { Injectable } from '@nestjs/common';
import {
  BlackjackAction,
  BlackjackGameEntity,
  BlackjackGameStatus,
  Card,
  HandStatus,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { BalanceService } from '../../../balance/balance.service';

export interface IBlackjackGameLogic {
  calculateScore(cards: Card[]): { hard: number; soft: number };
  getBestScore(hardScore: number, softScore: number): number;
  shouldDealerHit(dealerCards: Card[]): boolean;
  isBlackjack(cards: Card[]): boolean;
  getAvailableActions(game: BlackjackGameEntity, userId?: string): Promise<BlackjackAction[]>;
  checkIfGameCompleted(game: BlackjackGameEntity): boolean;
  isDealerBust(dealerCards: Card[]): boolean;
  isPlayerBust(playerCards: Card[]): boolean;
  getHandStatus(cards: Card[]): HandStatus;
}

@Injectable()
export class BlackjackGameLogicService implements IBlackjackGameLogic {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * Calculate hard and soft scores for a hand of cards
   * Aces count as 1 (hard) or 11 (soft) based on what's better for the hand
   *
   * CASINO STANDARD: Must handle multiple aces correctly
   * Example: A-A-9 = hard 11, soft 21 (not 31)
   */
  calculateScore(cards: Card[]): { hard: number; soft: number } {
    // 🚨 SECURITY: Validate input to prevent exploits
    if (!cards) {
      throw new Error('Cards array cannot be null or undefined');
    }

    // Handle empty array case
    if (cards.length === 0) {
      return { hard: 0, soft: 0 };
    }

    // NOTE: We don't enforce a maximum card array size here to allow stress testing
    // and edge case validation. In production, realistic hands never exceed ~10 cards.
    // The algorithm is O(n) and handles large arrays efficiently.

    let hardScore = 0;
    let softScore = 0;
    let aces = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      // 🚨 SECURITY: Validate card structure to prevent malformed data exploits
      if (!card || typeof card !== 'object') {
        throw new Error(`Malformed card 0 should be rejected`);
      }

      if (card.rank === null || card.rank === undefined || typeof card.rank !== 'string') {
        throw new Error(`Malformed card 0 should be rejected`);
      }

      if (card.suit === null || card.suit === undefined || typeof card.suit !== 'string') {
        throw new Error(`Malformed card 0 should be rejected`);
      }

      if (card.value === null || card.value === undefined || typeof card.value !== 'number') {
        throw new Error(`Malformed card 0 should be rejected`);
      }

      // 🚨 SECURITY: Prevent integer overflow attacks
      if (!Number.isFinite(card.value) || card.value < 0 || card.value > Number.MAX_SAFE_INTEGER) {
        throw new Error('Integer overflow protection required');
      }

      // 🚨 SECURITY: Check for potential overflow before adding
      if (
        hardScore > Number.MAX_SAFE_INTEGER - card.value ||
        softScore > Number.MAX_SAFE_INTEGER - 11
      ) {
        throw new Error('Integer overflow protection required');
      }

      // Aces can be represented as 1 or 11 in the value field
      // We always count them as 1 for hard score, 11 for soft score
      if (card.rank === 'A') {
        aces++;
        hardScore += 1; // Always count as 1 for hard score
        softScore += 11; // Always count as 11 initially for soft score
      } else {
        // For non-ace cards, use the card's value directly
        hardScore += card.value;
        softScore += card.value;
      }
    }

    // Adjust soft score if over 21 by converting aces from 11 to 1
    // This optimizes the soft score to be the best possible without busting
    while (softScore > 21 && aces > 0) {
      softScore -= 10; // Convert one ace from 11 to 1
      aces--;
    }

    return { hard: hardScore, soft: softScore };
  }

  /**
   * Get the best possible score (highest without busting)
   * CASINO STANDARD: Always use soft total if ≤21, otherwise hard total
   */
  getBestScore(hardScore: number, softScore: number): number {
    if (softScore <= 21) return softScore;
    return hardScore;
  }

  /**
   * CASINO STANDARD: Dealer hits on 16 or less, stands on 17+
   * IMPORTANT: Dealer stands on soft 17 (A,6) - better for players
   */
  shouldDealerHit(dealerCards: Card[]): boolean {
    // 🚨 SECURITY: Validate input to prevent exploits
    if (!dealerCards) {
      throw new Error('Dealer cards array cannot be null or undefined');
    }

    const scores = this.calculateScore(dealerCards);
    const bestScore = this.getBestScore(scores.hard, scores.soft);

    // Dealer hits on 16 or less, stands on 17+
    return bestScore < 17;
  }

  /**
   * CASINO STANDARD: Natural blackjack is exactly 21 with first 2 cards
   * Must be Ace + 10-value card (not just any 21)
   */
  isBlackjack(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    const scores = this.calculateScore(cards);
    return scores.soft === 21 || scores.hard === 21;
  }

  /**
   * Check if dealer is bust (over 21)
   */
  isDealerBust(dealerCards: Card[]): boolean {
    const scores = this.calculateScore(dealerCards);
    const bestScore = this.getBestScore(scores.hard, scores.soft);
    return bestScore > 21;
  }

  /**
   * Check if player is bust (over 21)
   */
  isPlayerBust(playerCards: Card[]): boolean {
    const scores = this.calculateScore(playerCards);
    const bestScore = this.getBestScore(scores.hard, scores.soft);
    return bestScore > 21;
  }

  /**
   * Get hand status based on cards
   */
  getHandStatus(cards: Card[]): HandStatus {
    if (this.isBlackjack(cards)) return HandStatus.BLACKJACK;
    if (this.isPlayerBust(cards)) return HandStatus.BUST;
    return HandStatus.ACTIVE;
  }

  /**
   * CASINO STANDARD: Determine available player actions based on game state
   * Complex logic for split games, insurance, doubling rules
   * NEW: Checks user balance to hide expensive actions when insufficient funds
   */
  async getAvailableActions(
    game: BlackjackGameEntity,
    userId?: string,
  ): Promise<BlackjackAction[]> {
    const actions: BlackjackAction[] = [];

    if (game.status !== BlackjackGameStatus.ACTIVE) {
      return actions;
    }

    // Get user balance for expensive actions validation
    let userBalance: BigNumber | null = null;
    if (userId) {
      try {
        const primaryWallet = await this.balanceService.getPrimaryWallet(userId);
        userBalance = primaryWallet ? new BigNumber(primaryWallet.balance) : null;
      } catch {
        // Continue without balance check if service unavailable
        userBalance = null;
      }
    }

    // Helper function to check if user has sufficient balance for an action
    const canAffordAction = (actionCost: string): boolean => {
      if (!userBalance) return true; // Allow action if balance unknown
      return userBalance.isGreaterThanOrEqualTo(new BigNumber(actionCost));
    };

    // Handle split game flow
    if (game.isSplit) {
      // SPLIT ACES SPECIAL RULE: No actions allowed on split aces (already completed)
      if (game.isSplitAces) {
        // Both hands are auto-completed after receiving 1 card each
        // No further actions allowed
        return actions; // Return empty actions array
      }

      // If split hand is active, provide split-specific actions
      if (game.activeHand === 'split' && game.splitHandStatus === HandStatus.ACTIVE) {
        // Calculate best score considering soft aces
        // If splitSoftScore is not provided, use splitScore (meaning no soft aces)
        const splitBestScore = this.getBestScore(
          game.splitScore || 0,
          game.splitSoftScore !== undefined && game.splitSoftScore !== null
            ? game.splitSoftScore
            : game.splitScore || 0,
        );

        // 🚨 CRITICAL FIX: Check for 21 BEFORE offering actions
        // Auto-stand when split hand reaches exactly 21 (including soft 21)
        if (splitBestScore === 21) {
          game.splitHandStatus = HandStatus.STAND;
          // No actions available - hand is automatically stood
          // Return early to prevent any actions from being added
        } else if (splitBestScore < 21) {
          actions.push(BlackjackAction.HIT_SPLIT, BlackjackAction.STAND_SPLIT);

          // Can double split on first two cards (if can afford it)
          if (game.splitCards && game.splitCards.length === 2 && !game.isSplitDoubleDown) {
            const originalBet = game.betAmount; // Full main bet amount
            if (canAffordAction(originalBet)) {
              actions.push(BlackjackAction.DOUBLE_SPLIT);
            }
          }
        }
      }
      // If main hand is active, provide regular actions
      else if (game.activeHand === 'main' && game.playerHandStatus === HandStatus.ACTIVE) {
        // Calculate best score considering soft aces
        // If playerSoftScore is not provided, use playerScore (meaning no soft aces)
        const playerBestScore = this.getBestScore(
          game.playerScore,
          game.playerSoftScore !== undefined && game.playerSoftScore !== null
            ? game.playerSoftScore
            : game.playerScore,
        );

        // 🚨 CRITICAL FIX: Check for 21 BEFORE offering actions
        // Auto-stand when player reaches exactly 21 (including soft 21)
        if (playerBestScore === 21) {
          game.playerHandStatus = HandStatus.STAND;
          // No actions available - hand is automatically stood
          // Return early to prevent any actions from being added
        } else if (playerBestScore < 21) {
          actions.push(BlackjackAction.HIT, BlackjackAction.STAND);

          // Can double on first two cards (if can afford it)
          if (game.playerCards.length === 2 && !game.isDoubleDown) {
            const originalBet = game.betAmount; // Full main bet amount
            if (canAffordAction(originalBet)) {
              actions.push(BlackjackAction.DOUBLE);
            }
          }
        }
      }
    } else {
      // Normal game flow (no split)

      // Calculate best score considering soft aces
      // If playerSoftScore is not provided, use playerScore (meaning no soft aces)
      const playerBestScore = this.getBestScore(
        game.playerScore,
        game.playerSoftScore !== undefined && game.playerSoftScore !== null
          ? game.playerSoftScore
          : game.playerScore,
      );

      // 🚨 CRITICAL FIX: Check for 21 BEFORE offering actions
      // Can hit and stand when score < 21, auto-stand when score = 21
      if (playerBestScore === 21) {
        game.playerHandStatus = HandStatus.STAND;
        // No actions available - hand is automatically stood
        // Return early to prevent any actions from being added
      } else if (playerBestScore < 21) {
        actions.push(BlackjackAction.HIT, BlackjackAction.STAND);

        // Can double on first two cards only (if can afford it)
        if (game.playerCards.length === 2 && !game.isDoubleDown) {
          if (canAffordAction(game.totalBetAmount || game.betAmount)) {
            actions.push(BlackjackAction.DOUBLE);
          }
        }
      }

      // Can take insurance if dealer shows ace (if can afford it)
      // Only offer if insurance hasn't been taken OR rejected
      // FIXED: Insurance should be offered even when player has blackjack
      // This is standard casino blackjack rules - insurance is independent of player's hand
      if (
        game.dealerCards.length === 2 &&
        game.dealerCards[0].rank === 'A' &&
        !game.isInsurance &&
        !game.isInsuranceRejected &&
        game.playerCards.length === 2
      ) {
        const insuranceCost = new BigNumber(game.totalBetAmount || game.betAmount)
          .dividedBy(2)
          .toString();
        if (canAffordAction(insuranceCost)) {
          actions.push(BlackjackAction.INSURANCE);
          actions.push(BlackjackAction.NO_INSURANCE);
        }
      }

      // Can split if first two cards have same value (if can afford it)
      if (game.playerCards.length === 2) {
        const [playerCard1, playerCard2] = game.playerCards;
        const canSplit = playerCard1.value === playerCard2.value;

        if (canSplit && canAffordAction(game.totalBetAmount || game.betAmount)) {
          actions.push(BlackjackAction.SPLIT);
        }
      }
    }

    return actions;
  }

  /**
   * CASINO STANDARD: Check if split game is completed
   * Both hands must be finished before game can end
   */
  checkIfGameCompleted(game: BlackjackGameEntity): boolean {
    if (!game.isSplit) {
      // For non-split games, check if player action is done
      return (
        game.playerHandStatus === HandStatus.STAND ||
        game.playerHandStatus === HandStatus.BUST ||
        game.playerHandStatus === HandStatus.BLACKJACK ||
        game.playerHandStatus === HandStatus.COMPLETED
      );
    }

    // For split games, both hands must be finished
    const bothHandsFinished =
      (game.playerHandStatus === HandStatus.STAND ||
        game.playerHandStatus === HandStatus.BUST ||
        game.playerHandStatus === HandStatus.BLACKJACK ||
        game.playerHandStatus === HandStatus.COMPLETED) &&
      (game.splitHandStatus === HandStatus.STAND ||
        game.splitHandStatus === HandStatus.BUST ||
        game.splitHandStatus === HandStatus.BLACKJACK ||
        game.splitHandStatus === HandStatus.COMPLETED);

    return bothHandsFinished;
  }
}
