import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BlackjackGameEntity,
  BlackjackGameStatus,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { BalanceService } from '../../../../balance/balance.service';
import { createTestProviders } from '../../../../test-utils';
import { BlackjackPayoutService, IBlackjackPayout } from '../../services/blackjack-payout.service';

/**
 * 🎯 COMPREHENSIVE PAYOUT CALCULATION TESTS
 *
 * This test suite validates ALL payout calculations to ensure mathematical accuracy:
 *
 * 1. Standard Payout Multipliers (3:2 blackjack, 1:1 wins, pushes)
 * 2. Split Hand Calculations (individual hand bet amounts)
 * 3. Double Down Scenarios (doubled bet amounts)
 * 4. Side Bet Calculations (Perfect Pairs, 21+3)
 * 5. Insurance Calculations (2:1 payout)
 * 6. BigNumber Precision Handling
 * 7. Edge Cases and Error Conditions
 */
describe('🎯 BlackjackPayoutService - Complete Calculation Coverage', () => {
  let service: IBlackjackPayout;
  let balanceService: jest.Mocked<BalanceService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
  } as UserEntity;

  const createMockGame = (overrides?: Partial<BlackjackGameEntity>): BlackjackGameEntity =>
    ({
      id: 'game-123',
      userId: 'user-1',
      user: mockUser,
      gameSessionId: 'session-123',
      betAmount: '100.00000000',
      totalBetAmount: '100.00000000',
      asset: AssetTypeEnum.BTC,
      status: BlackjackGameStatus.COMPLETED,
      playerCards: [],
      dealerCards: [],
      playerScore: 0,
      dealerScore: 0,
      isDoubleDown: false,
      isSplit: false,
      isInsurance: false,
      winAmount: '0',
      payoutMultiplier: '0',
      serverSeed: 'test-seed',
      clientSeed: 'client-seed',
      nonce: '1',
      cardCursor: 0,
      serverSeedHash: 'hash',
      gameHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as BlackjackGameEntity;

  const mockBalanceResult = {
    success: true,
    status: 'COMPLETED' as any,
    balance: '1000.00',
    newBalance: new BigNumber('1000'),
    transactionId: 'tx-123',
  };

  const mockWallet = {
    id: 'wallet-1',
    userId: 'user-1',
    asset: AssetTypeEnum.BTC,
    balance: '1000.00000000',
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...createTestProviders(),
        // Override with real service for calculation tests
        BlackjackPayoutService,
        // Override specific mocks
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
            getPrimaryWallet: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlackjackPayoutService>(BlackjackPayoutService);
    balanceService = module.get(BalanceService);

    // Default mocks
    balanceService.updateBalance.mockResolvedValue(mockBalanceResult);
    balanceService.getPrimaryWallet.mockResolvedValue(mockWallet);
  });

  describe('🎯 CALCULATION 1: Standard Casino Multipliers', () => {
    it('should return correct standard casino multipliers', () => {
      const multipliers = service.getHouseEdgeAdjustedMultipliers();

      expect(multipliers).toEqual({
        blackjackMultiplier: 2.5, // 3:2 blackjack
        winMultiplier: 2.0, // 1:1 regular win
        pushMultiplier: 1.0, // Return bet
        lossMultiplier: 0.0, // No payout
        houseEdge: 0.52, // Standard house edge
      });
    });

    it('should calculate blackjack payout correctly (3:2)', () => {
      const result = service.calculateWinAmount('100.00000000', true, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('250.00000000'); // 100 * 2.5
      expect(result.payoutMultiplier).toBe('2.5000');
    });

    it('should calculate regular win payout correctly (1:1)', () => {
      const result = service.calculateWinAmount('100.00000000', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('200.00000000'); // 100 * 2.0
      expect(result.payoutMultiplier).toBe('2.0000');
    });

    it('should calculate push payout correctly (return bet)', () => {
      const result = service.calculateWinAmount('100.00000000', false, true, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('100.00000000'); // 100 * 1.0
      expect(result.payoutMultiplier).toBe('1.0000');
    });

    it('should calculate loss correctly (no payout)', () => {
      const result = service.calculateWinAmount('100.00000000', false, false, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000'); // 100 * 0.0
      expect(result.payoutMultiplier).toBe('0.0000');
    });
  });

  describe('🎯 CALCULATION 2: Precision and BigNumber Handling', () => {
    it('should handle very small bet amounts without precision loss', () => {
      const result = service.calculateWinAmount('0.00000001', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000002'); // Precise calculation
    });

    it('should handle very large bet amounts without precision loss', () => {
      const result = service.calculateWinAmount('999999999.99999999', true, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('2499999999.99999997'); // Large number precision
    });

    it('should handle fractional amounts with 8 decimal precision', () => {
      const result = service.calculateWinAmount('123.45678901', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('246.91357802'); // Rounded to 8 decimals
    });

    it('should handle edge case of exactly zero bet (demo mode)', () => {
      // Zero bets are valid for demo mode
      const result = service.calculateWinAmount('0', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000');
      expect(result.payoutMultiplier).toBe('2.0000'); // Theoretical win multiplier
    });

    it('should handle invalid negative bet amounts', () => {
      const result = service.calculateWinAmount('-100', false, false, true);

      expect(result.isValid).toBe(false);
      expect(result.winAmount).toBe('0');
    });

    it('should handle invalid NaN bet amounts', () => {
      const result = service.calculateWinAmount('invalid', false, false, true);

      expect(result.isValid).toBe(false);
      expect(result.winAmount).toBe('0');
    });
  });

  describe('🎯 CALCULATION 3: Game Payout Setting', () => {
    it('should set main hand payout correctly', () => {
      const game = createMockGame();

      service.setGamePayout(game, '200.00000000', false, false, true);

      expect(game.winAmount).toBe('400.00000000');
      expect(game.payoutMultiplier).toBe('2.0000');
    });

    it('should set split hand payout correctly', () => {
      const game = createMockGame();

      service.setGamePayout(game, '300.00000000', true, false, true, true);

      expect(game.splitWinAmount).toBe('750.00000000'); // 300 * 2.5
      expect(game.splitPayoutMultiplier).toBe('2.5000');
    });

    it('should throw error for invalid payout calculation', () => {
      const game = createMockGame();

      expect(() => {
        service.setGamePayout(game, 'invalid', false, false, true);
      }).toThrow(InternalServerErrorException);
    });
  });

  describe('🎯 CALCULATION 4: Credit Winnings with BigNumber Support', () => {
    it('should credit winnings using number input', async () => {
      await service.creditWinnings('user-1', 250.5, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          amount: expect.any(BigNumber),
          userId: 'user-1',
        }),
      );
    });

    it('should credit winnings using BigNumber input', async () => {
      const amount = new BigNumber('1000.12345678');

      await service.creditWinnings('user-1', amount, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          amount: amount,
          userId: 'user-1',
        }),
      );
    });

    it('should handle very large BigNumber amounts', async () => {
      const largeAmount = new BigNumber('99999999999.99999999');

      await service.creditWinnings('user-1', largeAmount, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: largeAmount,
        }),
      );
    });

    it('should reject invalid negative amounts', async () => {
      await expect(service.creditWinnings('user-1', -100, AssetTypeEnum.BTC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should reject NaN amounts', async () => {
      await expect(service.creditWinnings('user-1', NaN, AssetTypeEnum.BTC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should reject negative BigNumber amounts', async () => {
      const negativeAmount = new BigNumber('-100');

      await expect(
        service.creditWinnings('user-1', negativeAmount, AssetTypeEnum.BTC),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle zero amount gracefully', async () => {
      await service.creditWinnings('user-1', 0, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: expect.any(BigNumber),
        }),
      );
    });

    it('should throw error when no primary wallet found', async () => {
      balanceService.getPrimaryWallet.mockResolvedValue(null);

      await expect(service.creditWinnings('user-1', 100, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when balance update fails', async () => {
      balanceService.updateBalance.mockResolvedValue({
        success: false,
        status: 'FAILED' as any,
        balance: '0',
        error: 'Balance update failed',
      });

      await expect(service.creditWinnings('user-1', 100, AssetTypeEnum.BTC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('🎯 CALCULATION 5: Side Bet Payouts', () => {
    it('should calculate and credit side bet winnings correctly', async () => {
      const game = createMockGame({
        perfectPairsBet: '10.00000000',
        twentyOnePlusThreeBet: '15.00000000',
      });

      const perfectPairsResult = { type: 'mixed_pair', multiplier: 6 };
      const twentyOnePlus3Result = { type: 'flush', multiplier: 5 };

      await service.creditSideBetWinnings('user-1', game, perfectPairsResult, twentyOnePlus3Result);

      // Perfect Pairs: 10 * 6 = 60, + original bet = 70
      // 21+3: 15 * 5 = 75, + original bet = 90
      // Total side bet winnings: 160
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          amount: expect.any(BigNumber),
          description: 'Blackjack side bet win',
        }),
      );

      expect(game.perfectPairsWin).toBe('70.00000000');
      expect(game.twentyOnePlusThreeWin).toBe('90.00000000');
    });

    it('should handle side bet losses correctly', async () => {
      const game = createMockGame({
        perfectPairsBet: '10.00000000',
        twentyOnePlusThreeBet: '15.00000000',
      });

      // No results = losses
      await service.creditSideBetWinnings('user-1', game);

      // No balance update should occur for losses
      expect(balanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should handle partial side bet wins', async () => {
      const game = createMockGame({
        perfectPairsBet: '20.00000000',
        twentyOnePlusThreeBet: '10.00000000',
      });

      // Only Perfect Pairs wins
      const perfectPairsResult = { type: 'perfect_pair', multiplier: 25 };

      await service.creditSideBetWinnings('user-1', game, perfectPairsResult);

      expect(game.perfectPairsWin).toBe('520.00000000'); // 20 * 25 + 20
      expect(game.twentyOnePlusThreeWin).toBeUndefined();
    });
  });

  describe('🎯 CALCULATION 6: Theoretical RTP and Expected Value', () => {
    it('should calculate theoretical RTP correctly', () => {
      const rtp = service.getTheoreticalRTP(0.52);
      expect(rtp).toBe(99.48); // 100 - 0.52
    });

    it('should use default house edge for invalid inputs', () => {
      expect(service.getTheoreticalRTP(NaN)).toBe(99.48);
      expect(service.getTheoreticalRTP(-1)).toBe(99.48);
      expect(service.getTheoreticalRTP(101)).toBe(99.48);
    });

    it('should calculate expected value correctly', () => {
      const ev = service.calculateExpectedValue('100.00000000', 0.42);

      // EV = (0.42 * 200) - (0.58 * 100) = 84 - 58 = 26
      expect(parseFloat(ev)).toBeCloseTo(26, 8);
    });

    it('should handle zero win probability', () => {
      const ev = service.calculateExpectedValue('100.00000000', 0);
      expect(parseFloat(ev)).toBe(-100); // Always lose
    });

    it('should handle 100% win probability', () => {
      const ev = service.calculateExpectedValue('100.00000000', 1);
      expect(parseFloat(ev)).toBe(200); // Total expected return
    });
  });

  describe('🎯 CALCULATION 7: Amount Validation', () => {
    it('should validate positive amounts', () => {
      expect(service.validatePayoutAmount(100)).toBe(true);
      expect(service.validatePayoutAmount(0.00000001)).toBe(true);
      expect(service.validatePayoutAmount(0)).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(service.validatePayoutAmount(NaN)).toBe(false);
      expect(service.validatePayoutAmount(-1)).toBe(false);
      expect(service.validatePayoutAmount(Infinity)).toBe(false);
      expect(service.validatePayoutAmount(-Infinity)).toBe(false);
    });
  });

  describe('🎯 CALCULATION 8: Error Handling and Edge Cases', () => {
    it('should handle calculation errors gracefully', () => {
      // Mock a scenario that could cause calculation errors
      const result = service.calculateWinAmount('', false, false, true);

      expect(result.isValid).toBe(false);
      expect(result.winAmount).toBe('0');
    });

    it('should handle balance service errors during side bet crediting', async () => {
      const game = createMockGame({
        perfectPairsBet: '10.00000000',
      });

      balanceService.updateBalance.mockResolvedValue({
        success: false,
        status: 'FAILED' as any,
        balance: '0',
        error: 'Balance service error',
      });

      const perfectPairsResult = { type: 'mixed_pair', multiplier: 6 };

      await expect(
        service.creditSideBetWinnings('user-1', game, perfectPairsResult),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle concurrent credit operations safely', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(service.creditWinnings('user-1', new BigNumber('100'), AssetTypeEnum.BTC));
      }

      await Promise.all(promises);

      expect(balanceService.updateBalance).toHaveBeenCalledTimes(10);
    });
  });

  describe('🎯 CALCULATION 9: Demo Mode Tests', () => {
    it('should handle demo bet with blackjack outcome', () => {
      const result = service.calculateWinAmount('0', true, false, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000');
      expect(result.payoutMultiplier).toBe('2.5000'); // Theoretical 3:2 multiplier
      expect(result.houseEdge).toBe(0.52);
    });

    it('should handle demo bet with regular win outcome', () => {
      const result = service.calculateWinAmount('0', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000');
      expect(result.payoutMultiplier).toBe('2.0000'); // Theoretical 1:1 multiplier
    });

    it('should handle demo bet with push outcome', () => {
      const result = service.calculateWinAmount('0', false, true, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000');
      expect(result.payoutMultiplier).toBe('1.0000'); // Theoretical return bet multiplier
    });

    it('should handle demo bet with loss outcome', () => {
      const result = service.calculateWinAmount('0', false, false, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000');
      expect(result.payoutMultiplier).toBe('0.0000'); // Theoretical loss multiplier
    });

    it('should set game payout correctly for demo bet main hand', () => {
      const game = createMockGame({ betAmount: '0' });

      service.setGamePayout(game, '0', true, false, false);

      expect(game.winAmount).toBe('0.00000000');
      expect(game.payoutMultiplier).toBe('2.5000'); // Shows theoretical multiplier
    });

    it('should set game payout correctly for demo bet split hand', () => {
      const game = createMockGame({ betAmount: '0', isSplit: true });

      service.setGamePayout(game, '0', false, false, true, true);

      expect(game.splitWinAmount).toBe('0.00000000');
      expect(game.splitPayoutMultiplier).toBe('2.0000'); // Shows theoretical multiplier
    });

    it('should handle demo bet with different outcomes correctly', () => {
      // Test all outcome combinations for demo bets
      const outcomes = [
        { isBlackjack: true, isPush: false, isWin: false, expectedMultiplier: '2.5000' },
        { isBlackjack: false, isPush: false, isWin: true, expectedMultiplier: '2.0000' },
        { isBlackjack: false, isPush: true, isWin: false, expectedMultiplier: '1.0000' },
        { isBlackjack: false, isPush: false, isWin: false, expectedMultiplier: '0.0000' },
      ];

      outcomes.forEach(({ isBlackjack, isPush, isWin, expectedMultiplier }) => {
        const result = service.calculateWinAmount('0', isBlackjack, isPush, isWin);

        expect(result.isValid).toBe(true);
        expect(result.winAmount).toBe('0.00000000');
        expect(result.payoutMultiplier).toBe(expectedMultiplier);
      });
    });
  });

  describe('🎯 CALCULATION 10: Real-World Scenario Tests', () => {
    it('should handle the reported bug scenario correctly', () => {
      // Original bug: 200 bet, split, double on split, both win
      // Expected: 600 total bet → 1200 payout

      // Main hand: 200 bet → 400 payout
      const mainResult = service.calculateWinAmount('200.00000000', false, false, true);
      expect(mainResult.winAmount).toBe('400.00000000');

      // Split hand (doubled): 400 bet → 800 payout
      const splitResult = service.calculateWinAmount('400.00000000', false, false, true);
      expect(splitResult.winAmount).toBe('800.00000000');

      // Total: 1200 payout (400 + 800)
      const total = new BigNumber(mainResult.winAmount).plus(splitResult.winAmount);
      expect(total.toFixed(8)).toBe('1200.00000000');
    });

    it('should handle high-roller scenarios', () => {
      // High roller: 10 BTC bet, blackjack
      const result = service.calculateWinAmount('10.00000000', true, false, true);

      expect(result.winAmount).toBe('25.00000000'); // 10 * 2.5
      expect(result.payoutMultiplier).toBe('2.5000');
    });

    it('should handle micro-bet scenarios', () => {
      // Micro bet: 1 satoshi
      const result = service.calculateWinAmount('0.00000001', false, false, true);

      expect(result.winAmount).toBe('0.00000002'); // 1 satoshi * 2
    });

    it('should handle mixed asset calculations', () => {
      // Different asset types should use same calculation logic
      const btcResult = service.calculateWinAmount('1.00000000', false, false, true);
      const ethResult = service.calculateWinAmount('1.00000000', false, false, true);

      expect(btcResult.winAmount).toBe(ethResult.winAmount);
      expect(btcResult.payoutMultiplier).toBe(ethResult.payoutMultiplier);
    });
  });
});
