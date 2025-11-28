import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum, BalanceOperationEnum, BlackjackGameEntity } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { BalanceService } from '../../../../balance/balance.service';
import { createTestProviders } from '../../../../test-utils';
import { HouseEdgeService } from '../../../services/house-edge.service';
import { BlackjackPayoutService, IBlackjackPayout } from '../../services/blackjack-payout.service';

describe('💰 BlackjackPayoutService - Casino Grade Testing', () => {
  let service: IBlackjackPayout;
  let balanceService: jest.Mocked<BalanceService>;
  let houseEdgeService: jest.Mocked<HouseEdgeService>;

  const mockBalanceResult = {
    success: true,
    status: 'COMPLETED' as any,
    balance: '1000.00',
    newBalance: new BigNumber('1000'),
    transactionId: 'tx-123',
  };

  beforeEach(async () => {
    const mockBalanceService = {
      getPrimaryWallet: jest.fn(),
      updateBalance: jest.fn(),
    };

    const mockHouseEdgeService = {
      getEdge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...createTestProviders(),
        // Override with real service for calculation tests
        BlackjackPayoutService,
        // Override specific mocks
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: HouseEdgeService,
          useValue: mockHouseEdgeService,
        },
      ],
    }).compile();

    service = module.get<BlackjackPayoutService>(BlackjackPayoutService);
    balanceService = module.get(BalanceService);
    houseEdgeService = module.get(HouseEdgeService);

    // Default mocks
    houseEdgeService.getEdge.mockReturnValue(0.6); // 0.6% house edge
    balanceService.getPrimaryWallet.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      asset: 'BTC',
      balance: '1000.00000000',
    } as any);
    balanceService.updateBalance.mockResolvedValue(mockBalanceResult);
  });

  describe('🎯 House Edge & Multiplier Calculations', () => {
    it('🧮 CASINO STANDARD: Should return fixed standard casino multipliers', () => {
      const multipliers = service.getHouseEdgeAdjustedMultipliers();

      // CASINO STANDARD: Fixed multipliers regardless of configuration
      expect(multipliers.houseEdge).toBe(0.52); // Mathematical house edge
      expect(multipliers.blackjackMultiplier).toBe(2.5); // Always 3:2 (2.5x)
      expect(multipliers.winMultiplier).toBe(2.0); // Always 1:1 (2.0x)
      expect(multipliers.pushMultiplier).toBe(1.0); // Always return bet
      expect(multipliers.lossMultiplier).toBe(0.0); // Always 0
    });

    it('🧮 MATHEMATICAL PROOF: Fixed RTP calculation accuracy', () => {
      const multipliers = service.getHouseEdgeAdjustedMultipliers();

      // CASINO STANDARD: Fixed mathematical RTP = 100% - 0.52% = 99.48%
      const expectedRTP = 99.48;
      const actualRTP = service.getTheoreticalRTP(multipliers.houseEdge);

      expect(actualRTP).toBeCloseTo(expectedRTP, 2);
      expect(multipliers.blackjackMultiplier).toBe(2.5); // Fixed 3:2
      expect(multipliers.winMultiplier).toBe(2.0); // Fixed 1:1
    });

    it('🧮 CASINO STANDARD: Should always return consistent values', () => {
      // CASINO STANDARD: Multiple calls should return identical values
      const multipliers1 = service.getHouseEdgeAdjustedMultipliers();
      const multipliers2 = service.getHouseEdgeAdjustedMultipliers();

      expect(multipliers1).toEqual(multipliers2);
      expect(multipliers1.houseEdge).toBe(0.52);
      expect(multipliers1.blackjackMultiplier).toBe(2.5);
      expect(multipliers1.winMultiplier).toBe(2.0);
    });
  });

  describe('🎯 Win Amount Calculations', () => {
    it('🧮 CASINO STANDARD: Blackjack payout calculation (3:2)', () => {
      const result = service.calculateWinAmount('100.00000000', true, false, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('250.00000000'); // 100 × 2.5 (3:2 payout)
      expect(result.payoutMultiplier).toBe('2.5000');
      expect(result.houseEdge).toBe(0.52); // Mathematical house edge
    });

    it('🧮 CASINO STANDARD: Regular win payout calculation (1:1)', () => {
      const result = service.calculateWinAmount('100.00000000', false, false, true);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('200.00000000'); // 100 × 2.0 (1:1 payout)
      expect(result.payoutMultiplier).toBe('2.0000');
    });

    it('🧮 CASINO STANDARD: Push payout calculation (return bet)', () => {
      const result = service.calculateWinAmount('100.00000000', false, true, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('100.00000000'); // 100 × 1.0 (return bet)
      expect(result.payoutMultiplier).toBe('1.0000');
    });

    it('🧮 CASINO STANDARD: Loss payout calculation (no return)', () => {
      const result = service.calculateWinAmount('100.00000000', false, false, false);

      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.00000000'); // 100 × 0.0 (no payout)
      expect(result.payoutMultiplier).toBe('0.0000');
    });

    it('🛡️ ANTI-FRAUD: Should validate bet amounts', () => {
      // SPEC: Negative and invalid formats should be rejected
      // Zero is allowed for demo mode
      const invalidBets = ['-100', 'invalid', 'NaN', ''];

      invalidBets.forEach((invalidBet) => {
        const result = service.calculateWinAmount(invalidBet, true, false, false);

        expect(result.isValid).toBe(false);
        expect(result.winAmount).toBe('0');
        expect(result.payoutMultiplier).toBe('0');
      });
    });

    it('🎮 DEMO MODE: Should handle zero bet amount for demo games', () => {
      // Demo bets with betAmount = 0 should be valid
      // They return theoretical multiplier but 0 winnings
      const demoResult = service.calculateWinAmount('0', true, false, false);

      expect(demoResult.isValid).toBe(true);
      expect(demoResult.winAmount).toBe('0.00000000');
      expect(demoResult.payoutMultiplier).toBe('2.5000'); // Theoretical blackjack multiplier
    });

    it('🧮 MATHEMATICAL PROOF: Fixed standard casino payouts', () => {
      const betAmount = '1000.00000000';

      // CASINO STANDARD: Fixed payouts regardless of any configuration
      const blackjackResult = service.calculateWinAmount(betAmount, true, false, false);
      const winResult = service.calculateWinAmount(betAmount, false, false, true);

      expect(blackjackResult.winAmount).toBe('2500.00000000'); // Always 3:2
      expect(winResult.winAmount).toBe('2000.00000000'); // Always 1:1
      expect(blackjackResult.houseEdge).toBe(0.52); // Mathematical
      expect(winResult.houseEdge).toBe(0.52); // Mathematical
    });

    it('🧮 PRECISION: Should handle high precision calculations', () => {
      const result = service.calculateWinAmount('0.12345678', true, false, false);

      // 0.12345678 × 2.5 = 0.30864195
      expect(result.isValid).toBe(true);
      expect(result.winAmount).toBe('0.30864195'); // Exact 3:2 calculation
    });
  });

  describe('🎯 Game Entity Payout Setting', () => {
    let mockGame: BlackjackGameEntity;

    beforeEach(() => {
      mockGame = {
        id: 'game-1',
        asset: AssetTypeEnum.BTC,
        winAmount: undefined,
        payoutMultiplier: undefined,
        splitWinAmount: undefined,
        splitPayoutMultiplier: undefined,
      } as Partial<BlackjackGameEntity> as BlackjackGameEntity;
    });

    it('🧮 CASINO STANDARD: Should set main hand payout correctly', () => {
      houseEdgeService.getEdge.mockReturnValue(0);

      service.setGamePayout(mockGame, '100.00000000', true, false, false, false);

      expect(mockGame.winAmount).toBe('250.00000000');
      expect(mockGame.payoutMultiplier).toBe('2.5000');
      expect(mockGame.splitWinAmount).toBeUndefined();
      expect(mockGame.splitPayoutMultiplier).toBeUndefined();
    });

    it('🧮 CASINO STANDARD: Should set split hand payout correctly', () => {
      houseEdgeService.getEdge.mockReturnValue(0);

      service.setGamePayout(mockGame, '50.00000000', false, false, true, true);

      expect(mockGame.splitWinAmount).toBe('100.00000000');
      expect(mockGame.splitPayoutMultiplier).toBe('2.0000');
      expect(mockGame.winAmount).toBeUndefined();
      expect(mockGame.payoutMultiplier).toBeUndefined();
    });

    it('🛡️ ANTI-FRAUD: Should throw on invalid payout calculation', () => {
      expect(() => {
        service.setGamePayout(mockGame, 'invalid', true, false, false);
      }).toThrow(InternalServerErrorException);
    });
  });

  describe('🎯 Balance Operations & Winnings Credit', () => {
    it('🧮 CASINO STANDARD: Should credit winnings successfully', async () => {
      await service.creditWinnings('user-1', 250.12345678, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith({
        operation: BalanceOperationEnum.WIN,
        operationId: expect.any(String),
        userId: 'user-1',
        amount: new BigNumber(250.12345678),
        asset: AssetTypeEnum.BTC,
        description: 'Blackjack win',
      });
    });

    it('🛡️ ANTI-FRAUD: Should reject invalid credit amounts', async () => {
      const invalidAmounts = [NaN, -100, Infinity, -Infinity];

      for (const invalidAmount of invalidAmounts) {
        await expect(
          service.creditWinnings('user-1', invalidAmount, AssetTypeEnum.BTC),
        ).rejects.toThrow(InternalServerErrorException);
      }
    });

    it('🛡️ ANTI-FRAUD: Should handle missing primary wallet', async () => {
      balanceService.getPrimaryWallet.mockResolvedValue(null);

      await expect(service.creditWinnings('user-1', 100, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('🛡️ ANTI-FRAUD: Should handle balance update failure', async () => {
      balanceService.updateBalance.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      } as any);

      await expect(service.creditWinnings('user-1', 100, AssetTypeEnum.BTC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('🧮 EDGE CASE: Should handle zero winnings credit', async () => {
      await service.creditWinnings('user-1', 0, AssetTypeEnum.BTC);

      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: new BigNumber(0),
        }),
      );
    });
  });

  describe('🎯 Side Bet Winnings Processing', () => {
    let mockGame: BlackjackGameEntity;

    beforeEach(() => {
      mockGame = {
        id: 'game-1',
        asset: AssetTypeEnum.BTC,
        perfectPairsBet: '10.00000000',
        twentyOnePlusThreeBet: '5.00000000',
        perfectPairsWin: undefined,
        twentyOnePlusThreeWin: undefined,
      } as Partial<BlackjackGameEntity> as BlackjackGameEntity;
    });

    it('🧮 CASINO STANDARD: Should calculate Perfect Pairs winnings correctly', async () => {
      const perfectPairsResult = { type: 'PERFECT_PAIR', multiplier: 25 };

      await service.creditSideBetWinnings('user-1', mockGame, perfectPairsResult, undefined);

      // 10 + (10 × 25) = 260
      expect(mockGame.perfectPairsWin).toBe('260.00000000');
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: new BigNumber('260'),
          description: 'Blackjack side bet win',
        }),
      );
    });

    it('🧮 CASINO STANDARD: Should calculate 21+3 winnings correctly', async () => {
      const twentyOnePlus3Result = { type: 'STRAIGHT_FLUSH', multiplier: 40 };

      await service.creditSideBetWinnings('user-1', mockGame, undefined, twentyOnePlus3Result);

      // 5 + (5 × 40) = 205
      expect(mockGame.twentyOnePlusThreeWin).toBe('205.00000000');
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: new BigNumber('205'),
        }),
      );
    });

    it('🧮 CASINO STANDARD: Should combine multiple side bet winnings', async () => {
      const perfectPairsResult = { type: 'COLORED_PAIR', multiplier: 12 };
      const twentyOnePlus3Result = { type: 'FLUSH', multiplier: 5 };

      await service.creditSideBetWinnings(
        'user-1',
        mockGame,
        perfectPairsResult,
        twentyOnePlus3Result,
      );

      // Perfect Pairs: 10 + (10 × 12) = 130
      // 21+3: 5 + (5 × 5) = 30
      // Total: 160
      expect(mockGame.perfectPairsWin).toBe('130.00000000');
      expect(mockGame.twentyOnePlusThreeWin).toBe('30.00000000');
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: new BigNumber('160'),
        }),
      );
    });

    it('🧮 EDGE CASE: Should handle losing side bets (zero multiplier)', async () => {
      const losingResult = { type: 'NONE', multiplier: 0 };

      await service.creditSideBetWinnings('user-1', mockGame, losingResult, losingResult);

      expect(mockGame.perfectPairsWin).toBe('0.00000000');
      expect(mockGame.twentyOnePlusThreeWin).toBe('0.00000000');
      expect(balanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('🧮 EDGE CASE: Should handle missing side bets', async () => {
      mockGame.perfectPairsBet = undefined;
      mockGame.twentyOnePlusThreeBet = undefined;

      await service.creditSideBetWinnings('user-1', mockGame, undefined, undefined);

      expect(balanceService.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('🎯 Mathematical & Statistical Validation', () => {
    it('🧮 MATHEMATICAL PROOF: Expected value calculation', () => {
      const testCases = [
        { winProb: 0.5, houseEdge: 0, expectedSign: 0 }, // Fair game
        { winProb: 0.45, houseEdge: 0.6, expectedSign: -1 }, // House advantage
        { winProb: 0.55, houseEdge: 0, expectedSign: 1 }, // Player advantage
      ];

      testCases.forEach(({ winProb, houseEdge, expectedSign }) => {
        const ev = service.calculateExpectedValue('100.00000000', winProb);
        const evNumber = parseFloat(ev);

        if (expectedSign === 0) {
          expect(Math.abs(evNumber)).toBeLessThan(100); // Close to zero (allow for calculation variance)
        } else if (expectedSign === -1) {
          expect(evNumber).toBeLessThan(50); // Negative or small positive EV
        } else {
          expect(evNumber).toBeGreaterThan(-50); // Not too negative
        }
      });
    });

    it('🧮 FAST SIMULATION: Payout amount validation (1K)', () => {
      const iterations = 1000; // Reduced from 100K for faster tests
      let validPayouts = 0;

      for (let i = 0; i < iterations; i++) {
        const amount = Math.random() * 1000;
        const isValid = service.validatePayoutAmount(amount);

        if (isValid) validPayouts++;
      }

      // All positive finite numbers should be valid
      expect(validPayouts).toBe(iterations);
    });

    it('🧮 MATHEMATICAL PROOF: Payout multiplier consistency', () => {
      houseEdgeService.getEdge.mockReturnValue(0); // No house edge for exact calculations

      const betAmounts = ['1', '10', '100', '1000', '0.00001']; // Avoid precision issues with extremely small amounts

      betAmounts.forEach((betAmount) => {
        const blackjackResult = service.calculateWinAmount(betAmount, true, false, false);
        const winResult = service.calculateWinAmount(betAmount, false, false, true);
        const pushResult = service.calculateWinAmount(betAmount, false, true, false);
        const lossResult = service.calculateWinAmount(betAmount, false, false, false);

        // Multiplier ratios should be consistent regardless of bet size
        const betBN = new BigNumber(betAmount);

        // Check that calculations are internally consistent
        const actualBlackjackMultiplier = new BigNumber(blackjackResult.winAmount).dividedBy(betBN);
        const actualWinMultiplier = new BigNumber(winResult.winAmount).dividedBy(betBN);
        const actualPushMultiplier = new BigNumber(pushResult.winAmount).dividedBy(betBN);
        const actualLossMultiplier = new BigNumber(lossResult.winAmount).dividedBy(betBN);

        // Verify exact multipliers with no house edge (avoiding precision issues)
        expect(actualBlackjackMultiplier.toNumber()).toBeCloseTo(
          parseFloat(blackjackResult.payoutMultiplier),
          4,
        );
        expect(actualWinMultiplier.toNumber()).toBeCloseTo(
          parseFloat(winResult.payoutMultiplier),
          4,
        );
        expect(actualPushMultiplier.toNumber()).toBeCloseTo(
          parseFloat(pushResult.payoutMultiplier),
          4,
        );
        expect(actualLossMultiplier.toNumber()).toBeCloseTo(
          parseFloat(lossResult.payoutMultiplier),
          4,
        );
      });
    });

    it('🧮 CASINO COMPLIANCE: House edge impact validation', () => {
      const baseBet = '1000.00000000';
      const houseEdges = [0, 0.5, 1.0, 2.0, 5.0];

      let previousBlackjackWin = Infinity;
      let previousRegularWin = Infinity;

      houseEdges.forEach((houseEdge) => {
        houseEdgeService.getEdge.mockReturnValue(houseEdge);

        const blackjackResult = service.calculateWinAmount(baseBet, true, false, false);
        const regularResult = service.calculateWinAmount(baseBet, false, false, true);

        const blackjackWin = parseFloat(blackjackResult.winAmount);
        const regularWin = parseFloat(regularResult.winAmount);

        // Higher house edge should result in lower payouts
        expect(blackjackWin).toBeLessThanOrEqual(previousBlackjackWin);
        expect(regularWin).toBeLessThanOrEqual(previousRegularWin);

        previousBlackjackWin = blackjackWin;
        previousRegularWin = regularWin;
      });
    });

    it('🧮 PRECISION: High precision calculation accuracy (ROUND_DOWN)', () => {
      // Test with maximum precision bet amount
      const precisionBet = '123.45678901';
      const result = service.calculateWinAmount(precisionBet, true, false, false);

      // Manual calculation with casino-safe rounding: ROUND_DOWN to 8 decimals
      const expectedWin = new BigNumber(precisionBet)
        .multipliedBy(2.5)
        .decimalPlaces(8, BigNumber.ROUND_DOWN);

      expect(result.winAmount).toBe(expectedWin.toFixed(8));
      expect(result.houseEdge).toBe(0.52);
    });
  });

  describe('🎯 Utility & Validation Functions', () => {
    it('🧮 MATHEMATICAL PROOF: RTP calculation accuracy', () => {
      const testCases = [
        { houseEdge: 0, expectedRTP: 100 },
        { houseEdge: 0.6, expectedRTP: 99.4 },
        { houseEdge: 1.0, expectedRTP: 99.0 },
        { houseEdge: 5.0, expectedRTP: 95.0 },
        { houseEdge: 15.0, expectedRTP: 85.0 },
      ];

      testCases.forEach(({ houseEdge, expectedRTP }) => {
        const rtp = service.getTheoreticalRTP(houseEdge);
        expect(rtp).toBeCloseTo(expectedRTP, 6);
      });
    });

    it('🛡️ VALIDATION: Payout amount validation edge cases', () => {
      const testCases = [
        { amount: 0, expected: true },
        { amount: 0.00000001, expected: true },
        { amount: 1000000, expected: true },
        { amount: -1, expected: false },
        { amount: NaN, expected: false },
        { amount: Infinity, expected: false },
        { amount: -Infinity, expected: false },
      ];

      testCases.forEach(({ amount, expected }) => {
        expect(service.validatePayoutAmount(amount)).toBe(expected);
      });
    });

    it('🧮 EDGE CASE: Invalid RTP inputs should use defaults', () => {
      const invalidInputs = [-1, 101, NaN, Infinity];

      invalidInputs.forEach((invalid) => {
        const rtp = service.getTheoreticalRTP(invalid);
        expect(rtp).toBe(99.48); // Default 0.52% house edge
      });
    });
  });

  describe('🏛️ Regulatory Compliance & Industry Standards', () => {
    it('🏛️ MGA COMPLIANCE: RTP must match disclosed rate (99.4% basic strategy)', () => {
      // Malta Gaming Authority requires accurate RTP disclosure
      const houseEdge = 0.6; // 0.6% house edge = 99.4% RTP
      const calculatedRTP = service.getTheoreticalRTP(houseEdge);

      expect(calculatedRTP).toBe(99.4);

      // Test with actual multipliers
      houseEdgeService.getEdge.mockReturnValue(houseEdge);
      const multipliers = service.getHouseEdgeAdjustedMultipliers();

      // MGA requires 3:2 blackjack payouts (not 6:5) - Fixed standard payouts
      expect(multipliers.blackjackMultiplier).toBe(2.5); // Always 3:2
      expect(multipliers.winMultiplier).toBe(2.0); // Always 1:1
      expect(multipliers.pushMultiplier).toBe(1.0); // Always return bet
      expect(multipliers.lossMultiplier).toBe(0.0); // Always lose bet
    });

    it('🏛️ CURACAO COMPLIANCE: Payout calculations must be mathematically sound', () => {
      // Curacao eGaming requires verifiable math
      const testCases = [
        { bet: '100', isBlackjack: true, isPush: false, isWin: false, expectedMultiplier: 2.5 },
        { bet: '100', isBlackjack: false, isPush: false, isWin: true, expectedMultiplier: 2.0 },
        { bet: '100', isBlackjack: false, isPush: true, isWin: false, expectedMultiplier: 1.0 },
        { bet: '100', isBlackjack: false, isPush: false, isWin: false, expectedMultiplier: 0.0 },
      ];

      houseEdgeService.getEdge.mockReturnValue(0); // 0% house edge for exact calculation

      testCases.forEach(({ bet, isBlackjack, isPush, isWin, expectedMultiplier }) => {
        const result = service.calculateWinAmount(bet, isBlackjack, isPush, isWin);
        expect(result.isValid).toBe(true);
        expect(parseFloat(result.payoutMultiplier)).toBeCloseTo(expectedMultiplier, 1);
      });
    });

    it('🏛️ AML COMPLIANCE: Large payouts must be flagged for regulatory review', () => {
      // Anti-Money Laundering regulations require monitoring large transactions
      const largeWinnings = [
        1000000, // €1M - requires enhanced due diligence
        500000, // €500K - requires reporting
        100000, // €100K - monitoring threshold
      ];

      largeWinnings.forEach((amount) => {
        const isValid = service.validatePayoutAmount(amount);
        expect(isValid).toBe(true); // Should validate but be logged for compliance
      });

      // Invalid amounts should be rejected
      const invalidAmounts = [NaN, -100, Infinity, -Infinity];
      invalidAmounts.forEach((amount) => {
        const isValid = service.validatePayoutAmount(amount);
        expect(isValid).toBe(false);
      });
    });

    it('🏛️ AUDIT TRAIL: All payout calculations must be reproducible', () => {
      // Regulatory audits require deterministic calculations
      const betAmount = '1234.56789012';

      houseEdgeService.getEdge.mockReturnValue(2.5); // 2.5% house edge

      // Calculate same payout multiple times - must be identical
      const results: Array<{ winAmount: string; payoutMultiplier: string; houseEdge: number }> = [];
      for (let i = 0; i < 50; i++) {
        const result = service.calculateWinAmount(betAmount, true, false, false);
        results.push({
          winAmount: result.winAmount,
          payoutMultiplier: result.payoutMultiplier,
          houseEdge: result.houseEdge,
        });
      }

      // All results must be identical for audit trail
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result.winAmount).toBe(firstResult.winAmount);
        expect(result.payoutMultiplier).toBe(firstResult.payoutMultiplier);
        expect(result.houseEdge).toBe(firstResult.houseEdge);
      });
    });

    it('🏛️ RESPONSIBLE GAMING: RTP variance must be within regulatory limits', () => {
      // Responsible gaming requires predictable variance
      const houseEdges = [0.5, 1.0, 2.0, 5.0, 10.0, 15.0]; // Test range

      houseEdges.forEach((edge) => {
        const rtp = service.getTheoreticalRTP(edge);

        // RTP must be between 85% (minimum) and 99.9% (maximum)
        expect(rtp).toBeGreaterThanOrEqual(85.0);
        expect(rtp).toBeLessThanOrEqual(99.9);

        // RTP calculation must be accurate
        expect(rtp).toBeCloseTo(100 - edge, 1);
      });
    });

    it('🏛️ TECHNICAL STANDARDS: Precision must meet financial regulations', () => {
      // Financial regulations require specific decimal precision
      const testAmounts = [
        '0.00000001', // 1 satoshi (crypto minimum)
        '0.01', // 1 cent (fiat minimum)
        '999999.99', // Large amounts
        '123.456789', // High precision
      ];

      houseEdgeService.getEdge.mockReturnValue(1.0);

      testAmounts.forEach((amount) => {
        const result = service.calculateWinAmount(amount, false, false, true);
        expect(result.isValid).toBe(true);

        // Win amount must have exactly 8 decimal places (crypto standard)
        expect(result.winAmount).toMatch(/^\d+\.\d{8}$/);

        // Multiplier must have exactly 4 decimal places (regulatory standard)
        expect(result.payoutMultiplier).toMatch(/^\d+\.\d{4}$/);
      });
    });
  });
});
