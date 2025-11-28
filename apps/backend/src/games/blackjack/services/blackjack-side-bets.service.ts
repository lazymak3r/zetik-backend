import { Injectable, Logger } from '@nestjs/common';
import {
  BlackjackGameEntity,
  Card,
  PerfectPairsResult,
  PerfectPairsType,
  TwentyOnePlus3Result,
  TwentyOnePlus3Type,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';

export interface ISideBetEvaluation {
  perfectPairsWin: string;
  twentyOnePlusThreeWin: string;
  totalWinnings: string;
}

export interface ISideBetStatistics {
  perfectPairsProbabilities: Record<PerfectPairsType, number>;
  twentyOnePlus3Probabilities: Record<TwentyOnePlus3Type, number>;
  houseEdges: {
    perfectPairs: number;
    twentyOnePlus3: number;
  };
}

export interface IBlackjackSideBets {
  evaluatePerfectPairs(playerCards: Card[]): PerfectPairsResult;
  evaluate21Plus3(playerCards: Card[], dealerCard: Card): TwentyOnePlus3Result;
  evaluateAllSideBets(game: BlackjackGameEntity): ISideBetEvaluation;
  calculateSideBetWinnings(betAmount: string, multiplier: number): string;
  validateSideBetCards(playerCards: Card[], dealerCard?: Card): boolean;
  getSideBetStatistics(): ISideBetStatistics;
  isValidSideBetAmount(betAmount: string, mainBetAmount: string): boolean;
  getPerfectPairsMultiplier(type: PerfectPairsType): number;
  get21Plus3Multiplier(type: TwentyOnePlus3Type): number;
}

@Injectable()
export class BlackjackSideBetsService implements IBlackjackSideBets {
  private readonly logger = new Logger(BlackjackSideBetsService.name);

  // CASINO STANDARD: Perfect Pairs payout multipliers
  private readonly PERFECT_PAIRS_MULTIPLIERS = {
    [PerfectPairsType.NONE]: 0,
    [PerfectPairsType.MIXED_PAIR]: 6, // Different colors (6:1)
    [PerfectPairsType.COLORED_PAIR]: 12, // Same color, different suits (12:1)
    [PerfectPairsType.PERFECT_PAIR]: 25, // Same rank and suit (25:1)
  };

  // CASINO STANDARD: 21+3 payout multipliers
  private readonly TWENTY_ONE_PLUS_3_MULTIPLIERS = {
    [TwentyOnePlus3Type.NONE]: 0,
    [TwentyOnePlus3Type.FLUSH]: 5, // Same suit (5:1)
    [TwentyOnePlus3Type.STRAIGHT]: 10, // Sequential ranks (10:1)
    [TwentyOnePlus3Type.THREE_OF_KIND]: 30, // Same rank (30:1)
    [TwentyOnePlus3Type.STRAIGHT_FLUSH]: 40, // Sequential + same suit (40:1)
    [TwentyOnePlus3Type.SUITED_TRIPS]: 100, // Same rank + same suit (100:1)
  };

  // CASINO STANDARD: Red suits for color determination
  private readonly RED_SUITS = ['hearts', 'diamonds'];

  /**
   * CASINO STANDARD: Evaluate Perfect Pairs side bet
   * Checks first two player cards for matching pairs
   */
  evaluatePerfectPairs(playerCards: Card[]): PerfectPairsResult {
    // CASINO STANDARD: Need exactly 2 cards for Perfect Pairs
    if (playerCards.length < 2) {
      return { type: PerfectPairsType.NONE, multiplier: 0 };
    }

    const [card1, card2] = playerCards;

    // CASINO STANDARD: Must have matching ranks
    if (card1.rank !== card2.rank) {
      return { type: PerfectPairsType.NONE, multiplier: 0 };
    }

    // CASINO STANDARD: Same rank and same suit - Perfect Pair (25:1)
    if (card1.suit === card2.suit) {
      return {
        type: PerfectPairsType.PERFECT_PAIR,
        multiplier: this.PERFECT_PAIRS_MULTIPLIERS[PerfectPairsType.PERFECT_PAIR],
      };
    }

    // CASINO STANDARD: Same rank, same color but different suits - Colored Pair (12:1)
    const isCard1Red = this.RED_SUITS.includes(card1.suit.toLowerCase());
    const isCard2Red = this.RED_SUITS.includes(card2.suit.toLowerCase());

    if (isCard1Red === isCard2Red) {
      return {
        type: PerfectPairsType.COLORED_PAIR,
        multiplier: this.PERFECT_PAIRS_MULTIPLIERS[PerfectPairsType.COLORED_PAIR],
      };
    }

    // CASINO STANDARD: Same rank, different colors - Mixed Pair (6:1)
    return {
      type: PerfectPairsType.MIXED_PAIR,
      multiplier: this.PERFECT_PAIRS_MULTIPLIERS[PerfectPairsType.MIXED_PAIR],
    };
  }

  /**
   * CASINO STANDARD: Evaluate 21+3 side bet
   * Uses first two player cards and dealer's upcard
   */
  evaluate21Plus3(playerCards: Card[], dealerCard: Card): TwentyOnePlus3Result {
    // CASINO STANDARD: Need player's first 2 cards + dealer upcard
    if (playerCards.length < 2 || !dealerCard) {
      return { type: TwentyOnePlus3Type.NONE, multiplier: 0 };
    }

    const threeCards = [playerCards[0], playerCards[1], dealerCard];

    // CASINO STANDARD: Check in order of highest payout first

    // 1. Suited Trips: Same rank and suit (100:1) - highest payout
    if (this.isSuitedTrips(threeCards)) {
      return {
        type: TwentyOnePlus3Type.SUITED_TRIPS,
        multiplier: this.TWENTY_ONE_PLUS_3_MULTIPLIERS[TwentyOnePlus3Type.SUITED_TRIPS],
      };
    }

    // 2. Straight Flush: Sequential ranks + same suit (40:1)
    if (this.isStraight(threeCards) && this.isFlush(threeCards)) {
      return {
        type: TwentyOnePlus3Type.STRAIGHT_FLUSH,
        multiplier: this.TWENTY_ONE_PLUS_3_MULTIPLIERS[TwentyOnePlus3Type.STRAIGHT_FLUSH],
      };
    }

    // 3. Three of a Kind: Same rank, different suits (30:1)
    if (this.isThreeOfAKind(threeCards)) {
      return {
        type: TwentyOnePlus3Type.THREE_OF_KIND,
        multiplier: this.TWENTY_ONE_PLUS_3_MULTIPLIERS[TwentyOnePlus3Type.THREE_OF_KIND],
      };
    }

    // 4. Straight: Sequential ranks (10:1)
    if (this.isStraight(threeCards)) {
      return {
        type: TwentyOnePlus3Type.STRAIGHT,
        multiplier: this.TWENTY_ONE_PLUS_3_MULTIPLIERS[TwentyOnePlus3Type.STRAIGHT],
      };
    }

    // 5. Flush: Same suit (5:1)
    if (this.isFlush(threeCards)) {
      return {
        type: TwentyOnePlus3Type.FLUSH,
        multiplier: this.TWENTY_ONE_PLUS_3_MULTIPLIERS[TwentyOnePlus3Type.FLUSH],
      };
    }

    return { type: TwentyOnePlus3Type.NONE, multiplier: 0 };
  }

  /**
   * CASINO STANDARD: Evaluate all side bets for a game
   * Calculates winnings for both Perfect Pairs and 21+3
   */
  evaluateAllSideBets(game: BlackjackGameEntity): ISideBetEvaluation {
    let perfectPairsWin = '0';
    let twentyOnePlusThreeWin = '0';
    let totalWinnings = new BigNumber(0);

    // Evaluate Perfect Pairs if bet was placed
    if (game.perfectPairsBet && parseFloat(game.perfectPairsBet) > 0) {
      const perfectPairsResult = this.evaluatePerfectPairs(game.playerCards);
      if (perfectPairsResult.multiplier > 0) {
        perfectPairsWin = this.calculateSideBetWinnings(
          game.perfectPairsBet,
          perfectPairsResult.multiplier,
        );
        totalWinnings = totalWinnings.plus(new BigNumber(perfectPairsWin));

        this.logger.debug(
          `Perfect Pairs win: ${game.perfectPairsBet} × ${perfectPairsResult.multiplier} = ${perfectPairsWin}`,
        );
      }
    }

    // Evaluate 21+3 if bet was placed
    if (
      game.twentyOnePlusThreeBet &&
      parseFloat(game.twentyOnePlusThreeBet) > 0 &&
      game.dealerCards.length > 0
    ) {
      const twentyOnePlus3Result = this.evaluate21Plus3(game.playerCards, game.dealerCards[0]);
      if (twentyOnePlus3Result.multiplier > 0) {
        twentyOnePlusThreeWin = this.calculateSideBetWinnings(
          game.twentyOnePlusThreeBet,
          twentyOnePlus3Result.multiplier,
        );
        totalWinnings = totalWinnings.plus(new BigNumber(twentyOnePlusThreeWin));

        this.logger.debug(
          `21+3 win: ${game.twentyOnePlusThreeBet} × ${twentyOnePlus3Result.multiplier} = ${twentyOnePlusThreeWin}`,
        );
      }
    }

    return {
      perfectPairsWin,
      twentyOnePlusThreeWin,
      totalWinnings: totalWinnings.toFixed(8),
    };
  }

  /**
   * CASINO STANDARD: Calculate side bet winnings
   * Returns original bet + (bet × multiplier)
   */
  calculateSideBetWinnings(betAmount: string, multiplier: number): string {
    if (multiplier <= 0) {
      return '0';
    }

    const betAmountBN = new BigNumber(betAmount);
    // BUG FIX: Casino payout formula clarification
    // Multiplier represents winnings-only (e.g., 25 in "25:1")
    // Total return = original bet + winnings = bet × (multiplier + 1)
    // This is mathematically equivalent to: bet + (bet × multiplier)
    // Using explicit formula for clarity: bet × (1 + multiplier)
    const totalReturn = betAmountBN.multipliedBy(multiplier + 1);

    // Use BigNumber rounding (default ROUND_HALF_UP) for precision
    return totalReturn.decimalPlaces(8, BigNumber.ROUND_HALF_UP).toFixed(8);
  }

  /**
   * ANTI-FRAUD: Validate side bet cards
   * Ensures cards are valid for side bet evaluation
   */
  validateSideBetCards(playerCards: Card[], dealerCard?: Card): boolean {
    // Check player cards
    if (!playerCards || playerCards.length < 2) {
      return false;
    }

    // Validate each player card
    for (const card of playerCards.slice(0, 2)) {
      if (!this.isValidCard(card)) {
        return false;
      }
    }

    // Validate dealer card if provided (for 21+3)
    if (dealerCard && !this.isValidCard(dealerCard)) {
      return false;
    }

    return true;
  }

  /**
   * CASINO STANDARD: Get theoretical side bet statistics
   * Returns probabilities and house edges
   */
  getSideBetStatistics(): ISideBetStatistics {
    return {
      perfectPairsProbabilities: {
        [PerfectPairsType.NONE]: 0.9231, // ~92.31%
        [PerfectPairsType.MIXED_PAIR]: 0.0474, // ~4.74%
        [PerfectPairsType.COLORED_PAIR]: 0.0237, // ~2.37%
        [PerfectPairsType.PERFECT_PAIR]: 0.0059, // ~0.59%
      },
      twentyOnePlus3Probabilities: {
        [TwentyOnePlus3Type.NONE]: 0.7439, // ~74.39%
        [TwentyOnePlus3Type.FLUSH]: 0.1965, // ~19.65%
        [TwentyOnePlus3Type.STRAIGHT]: 0.0327, // ~3.27%
        [TwentyOnePlus3Type.THREE_OF_KIND]: 0.0235, // ~2.35%
        [TwentyOnePlus3Type.STRAIGHT_FLUSH]: 0.0022, // ~0.22%
        [TwentyOnePlus3Type.SUITED_TRIPS]: 0.0012, // ~0.12%
      },
      houseEdges: {
        perfectPairs: 4.1, // ~4.1% house edge
        twentyOnePlus3: 3.2, // ~3.2% house edge
      },
    };
  }

  /**
   * CASINO STANDARD: Validate side bet amount
   * Ensures side bet doesn't exceed reasonable limits
   */
  isValidSideBetAmount(betAmount: string, mainBetAmount: string): boolean {
    try {
      const sideBet = new BigNumber(betAmount);
      const mainBet = new BigNumber(mainBetAmount);

      // Check if the BigNumber parsing was successful (not NaN)
      if (sideBet.isNaN() || mainBet.isNaN()) {
        return false;
      }

      // Side bet must be positive
      if (sideBet.isLessThanOrEqualTo(0)) {
        return false;
      }

      // CASINO STANDARD: Side bet typically limited to main bet amount
      if (sideBet.isGreaterThan(mainBet)) {
        return false;
      }

      return true;
    } catch {
      const errorMessage = 'Unknown error';
      this.logger.error('Invalid side bet amount calculation', { betAmount, errorMessage });
      return false;
    }
  }

  /**
   * Get Perfect Pairs multiplier for a specific type
   */
  getPerfectPairsMultiplier(type: PerfectPairsType): number {
    return this.PERFECT_PAIRS_MULTIPLIERS[type] || 0;
  }

  /**
   * Get 21+3 multiplier for a specific type
   */
  get21Plus3Multiplier(type: TwentyOnePlus3Type): number {
    return this.TWENTY_ONE_PLUS_3_MULTIPLIERS[type] || 0;
  }

  /**
   * PRIVATE: Check if three cards form suited trips
   */
  private isSuitedTrips(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    const [card1, card2, card3] = cards;
    return (
      card1.rank === card2.rank &&
      card2.rank === card3.rank &&
      card1.suit === card2.suit &&
      card2.suit === card3.suit
    );
  }

  /**
   * PRIVATE: Check if three cards form three of a kind
   */
  private isThreeOfAKind(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    const [card1, card2, card3] = cards;
    return card1.rank === card2.rank && card2.rank === card3.rank;
  }

  /**
   * PRIVATE: Check if cards form a flush (same suit)
   */
  private isFlush(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    return cards.every((card) => card.suit === cards[0].suit);
  }

  /**
   * PRIVATE: Check if cards form a straight (sequential ranks)
   * Handles Ace as both high (A-K-Q) and low (A-2-3)
   */
  private isStraight(cards: Card[]): boolean {
    if (cards.length !== 3) return false;

    // Convert ranks to numerical values
    const getCardValues = (rank: string): number[] => {
      switch (rank.toLowerCase()) {
        case 'a':
          return [1, 14]; // Ace can be 1 or 14
        case 'k':
          return [13];
        case 'q':
          return [12];
        case 'j':
          return [11];
        default: {
          const numValue = parseInt(rank, 10);
          return isNaN(numValue) ? [] : [numValue];
        }
      }
    };

    const cardValues = cards.map((card) => getCardValues(card.rank));

    // Check all possible combinations for straights
    for (const val1 of cardValues[0]) {
      for (const val2 of cardValues[1]) {
        for (const val3 of cardValues[2]) {
          const values = [val1, val2, val3].sort((a, b) => a - b);

          // Check if consecutive
          if (values[1] === values[0] + 1 && values[2] === values[1] + 1) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * PRIVATE: Validate individual card
   */
  private isValidCard(card: Card): boolean {
    if (!card || typeof card !== 'object') {
      return false;
    }

    // Check required properties
    if (!card.suit || !card.rank || typeof card.value !== 'number') {
      return false;
    }

    // Validate suit
    const validSuits = ['hearts', 'diamonds', 'clubs', 'spades'];
    if (!validSuits.includes(card.suit.toLowerCase())) {
      return false;
    }

    // Validate rank
    const validRanks = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
    if (!validRanks.includes(card.rank.toLowerCase())) {
      return false;
    }

    // Validate value range
    if (card.value < 1 || card.value > 11) {
      return false;
    }

    return true;
  }
}
