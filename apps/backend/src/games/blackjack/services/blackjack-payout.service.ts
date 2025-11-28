import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AssetTypeEnum, BalanceOperationEnum, BlackjackGameEntity } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { BalanceService } from '../../../balance/balance.service';

export interface IHouseEdgeMultipliers {
  blackjackMultiplier: number;
  winMultiplier: number;
  pushMultiplier: number;
  lossMultiplier: number;
  houseEdge: number;
}

export interface IPayoutCalculation {
  winAmount: string;
  payoutMultiplier: string;
  houseEdge: number;
  isValid: boolean;
}

export interface ISideBetResult {
  type: string;
  multiplier: number;
}

export interface IBlackjackPayout {
  getHouseEdgeAdjustedMultipliers(): IHouseEdgeMultipliers;
  calculateWinAmount(
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
  ): IPayoutCalculation;
  setGamePayout(
    game: BlackjackGameEntity,
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
    isForSplitHand?: boolean,
  ): void;
  creditWinnings(userId: string, amount: number | BigNumber, asset: AssetTypeEnum): Promise<void>;
  creditSideBetWinnings(
    userId: string,
    game: BlackjackGameEntity,
    perfectPairsResult?: ISideBetResult,
    twentyOnePlus3Result?: ISideBetResult,
  ): Promise<void>;
  validatePayoutAmount(amount: number): boolean;
  getTheoreticalRTP(houseEdge: number): number;
  calculateExpectedValue(betAmount: string, winProbability: number): string;
}

@Injectable()
export class BlackjackPayoutService implements IBlackjackPayout {
  private readonly logger = new Logger(BlackjackPayoutService.name);

  // CASINO STANDARD: Total return multipliers (original bet + winnings)
  private readonly DEFAULT_BLACKJACK_MULTIPLIER = 2.5; // 3:2 payout: bet + (bet * 1.5) = bet * 2.5
  private readonly DEFAULT_WIN_MULTIPLIER = 2.0; // 1:1 payout: bet + bet = bet * 2.0
  private readonly DEFAULT_PUSH_MULTIPLIER = 1.0; // Push: return original bet = bet * 1.0
  private readonly DEFAULT_LOSS_MULTIPLIER = 0.0; // Loss: no return = bet * 0.0

  // CASINO STANDARD: Mathematical house edge (determined by game rules, not configuration)
  private readonly MATHEMATICAL_HOUSE_EDGE = 0.52; // Standard blackjack house edge (~0.52%)

  constructor(private readonly balanceService: BalanceService) {}

  /**
   * CASINO STANDARD: Get standard payout multipliers for blackjack
   * House edge is achieved through game rules, NOT by reducing payouts
   *
   * Standard payouts:
   * - Blackjack (natural 21): 3:2 (2.5x multiplier)
   * - Regular win: 1:1 (2.0x multiplier)
   * - Push (tie): return bet (1.0x multiplier)
   * - Loss: no payout (0.0x multiplier)
   */
  getHouseEdgeAdjustedMultipliers(): IHouseEdgeMultipliers {
    // Return fixed standard casino multipliers - house edge comes from game rules
    return {
      blackjackMultiplier: this.DEFAULT_BLACKJACK_MULTIPLIER, // Always 3:2
      winMultiplier: this.DEFAULT_WIN_MULTIPLIER, // Always 1:1
      pushMultiplier: this.DEFAULT_PUSH_MULTIPLIER, // Always return bet
      lossMultiplier: this.DEFAULT_LOSS_MULTIPLIER, // Always 0
      houseEdge: this.MATHEMATICAL_HOUSE_EDGE, // Mathematical result of rules
    };
  }

  /**
   * CASINO STANDARD: Calculate win amount with house edge adjustment
   * Applies proper multipliers based on game outcome
   */
  calculateWinAmount(
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
  ): IPayoutCalculation {
    try {
      const multipliers = this.getHouseEdgeAdjustedMultipliers();
      const betAmountBN = new BigNumber(betAmount);

      // Validate bet amount - must be valid number and >= 0 (allow 0 for demo mode)
      if (betAmountBN.isNaN() || betAmountBN.isLessThan(0)) {
        return {
          winAmount: '0',
          payoutMultiplier: '0',
          houseEdge: multipliers.houseEdge,
          isValid: false,
        };
      }

      let multiplier: number;

      // CASINO STANDARD: Apply correct multiplier based on outcome
      if (isPush) {
        multiplier = multipliers.pushMultiplier; // Return original bet
      } else if (isBlackjack) {
        multiplier = multipliers.blackjackMultiplier; // 3:2 payout (with house edge)
      } else if (isWin) {
        multiplier = multipliers.winMultiplier; // 1:1 payout (with house edge)
      } else {
        multiplier = multipliers.lossMultiplier; // 0 payout
      }

      const winAmount = betAmountBN.multipliedBy(multiplier).decimalPlaces(8, BigNumber.ROUND_DOWN);

      this.logger.debug(
        `Win calculation: ${betAmount} × ${multiplier.toFixed(4)} = ${winAmount.toFixed(8)} (House Edge: ${multipliers.houseEdge}%)`,
      );

      return {
        winAmount: winAmount.toFixed(8),
        payoutMultiplier: multiplier.toFixed(4),
        houseEdge: multipliers.houseEdge,
        isValid: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calculating win amount: ${errorMessage}`, {
        betAmount,
        isBlackjack,
        isPush,
        isWin,
      });
      return {
        winAmount: '0',
        payoutMultiplier: '0',
        houseEdge: this.MATHEMATICAL_HOUSE_EDGE,
        isValid: false,
      };
    }
  }

  /**
   * CASINO STANDARD: Set game payout amounts and multiplier
   * Updates game entity with calculated payouts
   */
  setGamePayout(
    game: BlackjackGameEntity,
    betAmount: string,
    isBlackjack: boolean,
    isPush: boolean,
    isWin: boolean,
    isForSplitHand = false,
  ): void {
    const payoutResult = this.calculateWinAmount(betAmount, isBlackjack, isPush, isWin);

    if (!payoutResult.isValid) {
      this.logger.error('Invalid payout calculation', { betAmount, isBlackjack, isPush, isWin });
      throw new InternalServerErrorException('Invalid payout calculation');
    }

    // Update appropriate hand in game entity
    if (isForSplitHand) {
      game.splitWinAmount = payoutResult.winAmount;
      game.splitPayoutMultiplier = payoutResult.payoutMultiplier;
    } else {
      game.winAmount = payoutResult.winAmount;
      game.payoutMultiplier = payoutResult.payoutMultiplier;
    }

    this.logger.debug(
      `Payout set: ${isForSplitHand ? 'Split' : 'Main'} hand - Amount: ${payoutResult.winAmount}, Multiplier: ${payoutResult.payoutMultiplier}, HouseEdge: ${payoutResult.houseEdge}%`,
    );
  }

  /**
   * CASINO STANDARD: Credit winnings to user's wallet in the specified asset
   * Validates amount and processes balance update using saved game asset
   */
  async creditWinnings(
    userId: string,
    amount: number | BigNumber,
    asset: AssetTypeEnum,
  ): Promise<void> {
    // Convert to BigNumber for consistent handling
    const amountBN = amount instanceof BigNumber ? amount : new BigNumber(amount);
    const amountNumber = amountBN.toNumber();

    // ANTI-FRAUD: Validate amount is positive and not NaN
    if (!this.validatePayoutAmount(amountNumber) || amountBN.isNaN() || amountBN.isLessThan(0)) {
      this.logger.error(`Invalid credit amount: ${amountBN.toString()} for user ${userId}`);
      throw new InternalServerErrorException('Invalid credit amount');
    }

    if (!asset) {
      throw new BadRequestException('Asset type not specified for credit winnings');
    }

    const operationId = randomUUID();
    const result = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.WIN,
      operationId,
      userId,
      amount: amountBN, // Use BigNumber directly for better precision
      asset: asset,
      description: 'Blackjack win',
    });

    if (!result.success) {
      this.logger.error(`Failed to credit winnings for user ${userId}`, {
        error: result.error,
        amount: amountBN.toString(),
        operationId,
      });
      throw new InternalServerErrorException('Failed to process winnings');
    }

    this.logger.log(
      `Credited ${amountBN.toString()} to user ${userId} (Operation: ${operationId})`,
    );
  }

  /**
   * CASINO STANDARD: Credit side bet winnings
   * Handles Perfect Pairs and 21+3 side bet payouts
   */
  async creditSideBetWinnings(
    userId: string,
    game: BlackjackGameEntity,
    perfectPairsResult?: ISideBetResult,
    twentyOnePlus3Result?: ISideBetResult,
  ): Promise<void> {
    if (!game.asset) {
      throw new BadRequestException('Game asset not found for side bet winnings');
    }

    let totalSideBetWinnings = new BigNumber(0);

    // Process Perfect Pairs winnings
    if (game.perfectPairsBet && perfectPairsResult) {
      const perfectPairsWin = this.calculateSideBetWinAmount(
        game.perfectPairsBet,
        perfectPairsResult.multiplier,
      );
      game.perfectPairsWin = perfectPairsWin.toFixed(8);
      totalSideBetWinnings = totalSideBetWinnings.plus(perfectPairsWin);

      this.logger.debug(
        `Perfect Pairs: ${game.perfectPairsBet} × ${perfectPairsResult.multiplier} = ${perfectPairsWin.toString()}`,
      );
    }

    // Process 21+3 winnings
    if (game.twentyOnePlusThreeBet && twentyOnePlus3Result) {
      const twentyOnePlus3Win = this.calculateSideBetWinAmount(
        game.twentyOnePlusThreeBet,
        twentyOnePlus3Result.multiplier,
      );
      game.twentyOnePlusThreeWin = twentyOnePlus3Win.toFixed(8);
      totalSideBetWinnings = totalSideBetWinnings.plus(twentyOnePlus3Win);

      this.logger.debug(
        `21+3: ${game.twentyOnePlusThreeBet} × ${twentyOnePlus3Result.multiplier} = ${twentyOnePlus3Win.toString()}`,
      );
    }

    // Credit total side bet winnings if any
    if (totalSideBetWinnings.isGreaterThan(0)) {
      const operationId = randomUUID();
      const result = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.WIN,
        operationId,
        userId,
        amount: totalSideBetWinnings,
        asset: game.asset as AssetTypeEnum,
        description: 'Blackjack side bet win',
      });

      if (!result.success) {
        this.logger.error(`Failed to credit side bet winnings for user ${userId}`, {
          error: result.error,
          amount: totalSideBetWinnings.toString(),
          operationId,
        });
        throw new InternalServerErrorException('Failed to process side bet winnings');
      }

      this.logger.log(
        `Credited side bet winnings ${totalSideBetWinnings.toString()} to user ${userId}`,
      );
    }
  }

  /**
   * ANTI-FRAUD: Validate payout amount
   */
  validatePayoutAmount(amount: number): boolean {
    return !isNaN(amount) && amount >= 0 && isFinite(amount);
  }

  /**
   * CASINO STANDARD: Calculate theoretical RTP percentage
   */
  getTheoreticalRTP(houseEdge: number): number {
    if (isNaN(houseEdge) || !isFinite(houseEdge) || houseEdge < 0 || houseEdge > 100) {
      return 100 - this.MATHEMATICAL_HOUSE_EDGE;
    }
    return 100 - houseEdge;
  }

  /**
   * MATHEMATICAL: Calculate expected value of a bet
   * EV = (Win Probability × Win Amount) - (Loss Probability × Bet Amount)
   */
  calculateExpectedValue(betAmount: string, winProbability: number): string {
    try {
      const betAmountBN = new BigNumber(betAmount);
      const multipliers = this.getHouseEdgeAdjustedMultipliers();

      // Simplified EV calculation for regular wins (not including blackjack probability)
      const winAmount = betAmountBN.multipliedBy(multipliers.winMultiplier);
      const lossProbability = 1 - winProbability;

      const expectedValue = winAmount
        .multipliedBy(winProbability)
        .minus(betAmountBN.multipliedBy(lossProbability));

      return expectedValue.toFixed(8);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error calculating expected value: ${errorMessage}`);
      return '0';
    }
  }

  /**
   * PRIVATE: Calculate side bet win amount
   * Side bets return original bet + winnings (bet × multiplier)
   */
  private calculateSideBetWinAmount(betAmount: string, multiplier: number): BigNumber {
    if (multiplier <= 0) {
      return new BigNumber(0);
    }

    const betAmountBN = new BigNumber(betAmount);
    // BUG FIX: Casino payout formula clarification
    // Multiplier represents winnings-only (e.g., 25 in "25:1")
    // Total return = original bet + winnings = bet × (multiplier + 1)
    // This is mathematically equivalent to: bet + (bet × multiplier)
    // Using explicit formula for clarity: bet × (1 + multiplier)
    const totalReturn = betAmountBN.multipliedBy(multiplier + 1);

    // Return with proper precision rounding (ROUND_HALF_UP)
    return totalReturn.decimalPlaces(8, BigNumber.ROUND_HALF_UP);
  }
}
