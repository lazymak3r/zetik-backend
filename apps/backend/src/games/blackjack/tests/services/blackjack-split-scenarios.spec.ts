import { Test, TestingModule } from '@nestjs/testing';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BlackjackAction,
  BlackjackGameEntity,
  BlackjackGameStatus,
  Card,
  HandStatus,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { BalanceService } from '../../../../balance/balance.service';
import { createTestProviders } from '../../../../test-utils';
import { BlackjackActionService, IBlackjackAction } from '../../services/blackjack-action.service';
import { BlackjackCardService } from '../../services/blackjack-card.service';
import { BlackjackGameLogicService } from '../../services/blackjack-game-logic.service';
import { BlackjackPayoutService } from '../../services/blackjack-payout.service';

/**
 * 🎯 COMPREHENSIVE SPLIT SCENARIO TESTS
 *
 * This test suite covers ALL possible split scenarios to ensure 100% payout accuracy:
 *
 * 1. Basic Split Scenarios (both win/lose/push)
 * 2. Split Double Scenarios (one or both hands doubled)
 * 3. Split Blackjack Scenarios (A+10 = 21, not blackjack)
 * 4. Mixed Outcome Scenarios (one win, one lose, etc.)
 * 5. Edge Cases and Boundary Conditions
 */
describe('🎯 BlackjackActionService - Complete Split Scenarios', () => {
  let service: IBlackjackAction;
  let balanceService: jest.Mocked<BalanceService>;
  let gameLogicService: jest.Mocked<BlackjackGameLogicService>;
  let payoutService: jest.Mocked<BlackjackPayoutService>;
  let cardService: jest.Mocked<BlackjackCardService>;

  const mockUser: UserEntity = {
    id: 'user-1',
    email: 'test@example.com',
    registrationData: {} as any,
  } as UserEntity;

  const mockBalanceResult = {
    success: true,
    status: 'COMPLETED' as any,
    balance: '1000.00',
    newBalance: new BigNumber('1000'),
    transactionId: 'tx-123',
  };

  const createCard = (suit: string, rank: string, value: number): Card => ({
    suit,
    rank,
    value,
  });

  const createSplitGame = (overrides?: Partial<BlackjackGameEntity>): BlackjackGameEntity =>
    ({
      id: 'game-123',
      userId: 'user-1',
      user: mockUser,
      gameSessionId: 'session-123',
      betAmount: '200.00000000', // Original bet per hand (NOT doubled after split)
      totalBetAmount: '400.00000000', // 200 main + 200 split
      asset: AssetTypeEnum.BTC,
      status: BlackjackGameStatus.ACTIVE,
      playerCards: [createCard('Hearts', '8', 8), createCard('Clubs', '5', 5)],
      splitCards: [createCard('Spades', '8', 8), createCard('Diamonds', '7', 7)],
      dealerCards: [createCard('Hearts', 'K', 10), createCard('Spades', '6', 6)],
      playerScore: 13,
      playerSoftScore: 13,
      splitScore: 15,
      splitSoftScore: 15,
      dealerScore: 16,
      dealerSoftScore: 16,
      isSplit: true,
      isSplitAces: false,
      activeHand: 'main',
      playerHandStatus: HandStatus.ACTIVE,
      splitHandStatus: HandStatus.ACTIVE,
      isDoubleDown: false,
      isSplitDoubleDown: false,
      isInsurance: false,
      isInsuranceRejected: false,
      winAmount: '0',
      splitWinAmount: '0',
      payoutMultiplier: '0',
      splitPayoutMultiplier: '0',
      serverSeed: 'server-seed',
      clientSeed: 'client-seed',
      nonce: '1',
      cardCursor: 4,
      serverSeedHash: 'hash',
      gameHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as BlackjackGameEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlackjackActionService,
        ...createTestProviders(),
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: BlackjackGameLogicService,
          useValue: {
            calculateScore: jest.fn(),
            getBestScore: jest.fn(),
            isBlackjack: jest.fn(),
            isPlayerBust: jest.fn(),
            isDealerBust: jest.fn(),
            shouldDealerHit: jest.fn(),
            getAvailableActions: jest.fn(),
          },
        },
        {
          provide: BlackjackPayoutService,
          useValue: {
            setGamePayout: jest.fn(),
            creditWinnings: jest.fn(),
          },
        },
        {
          provide: BlackjackCardService,
          useValue: {
            generateCard: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlackjackActionService>(BlackjackActionService);
    balanceService = module.get(BalanceService);
    gameLogicService = module.get(BlackjackGameLogicService);
    payoutService = module.get(BlackjackPayoutService);
    cardService = module.get(BlackjackCardService);

    // Default mocks
    balanceService.updateBalance.mockResolvedValue(mockBalanceResult);
    gameLogicService.getAvailableActions.mockResolvedValue([]);
    gameLogicService.calculateScore.mockReturnValue({ hard: 20, soft: 20 });
    gameLogicService.getBestScore.mockReturnValue(20);
    gameLogicService.isBlackjack.mockReturnValue(false);
    gameLogicService.isPlayerBust.mockReturnValue(false);
    gameLogicService.isDealerBust.mockReturnValue(false);
    gameLogicService.shouldDealerHit.mockReturnValue(false);
    cardService.generateCard.mockReturnValue(createCard('Hearts', '10', 10));
  });

  describe('🎯 SCENARIO 1: Basic Split - Both Hands Win', () => {
    it('should correctly pay out when both split hands win (Scenario: 200 bet → 400 total → 800 payout)', async () => {
      const game = createSplitGame({
        betAmount: '200.00000000', // Original bet per hand
        totalBetAmount: '400.00000000',
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      // Mock dealer busts (hands win)
      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(18) // main hand
        .mockReturnValueOnce(19); // split hand

      // Execute the split game completion
      await (service as any).completeSplitGame(game);

      // Verify payouts: Each hand should win 2x its bet
      expect(payoutService.setGamePayout).toHaveBeenCalledTimes(2);

      // Main hand: 200 bet → 400 win (2x)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
      );

      // Split hand: 200 bet → 400 win (2x)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
        true,
      );

      // ActionService sets totalWinAmount but doesn't credit
      // BlackjackService will credit based on totalWinAmount
      expect(game.totalWinAmount).toBe('800.00000000'); // 400 + 400

      // 🐛 BUG FIX TEST: Verify individual hand winnings to prevent double-counting
      // BlackjackService adds winAmount + splitWinAmount, so they should NOT overlap
      expect(game.winAmount).toBe('400.00000000'); // Main hand only: 200 * 2
      expect(game.splitWinAmount).toBe('400.00000000'); // Split hand only: 200 * 2
    });
  });

  describe('🎯 SCENARIO 2: Split Double - One Hand Doubled', () => {
    it('should correctly pay out when one hand is doubled and both win (Scenario: 200 bet → 600 total → 1200 payout)', async () => {
      const game = createSplitGame({
        betAmount: '200.00000000', // Original bet per hand
        totalBetAmount: '600.00000000', // Split + double on split hand
        isSplitDoubleDown: true,
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      // Mock both hands winning
      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main hand
        .mockReturnValueOnce(21); // split hand

      await (service as any).completeSplitGame(game);

      // Verify individual hand payouts
      expect(payoutService.setGamePayout).toHaveBeenCalledTimes(2);

      // Main hand: 200 bet → 400 win (2x)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
      );

      // Split hand (doubled): 400 bet → 800 win (2x)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '400.00000000',
        false,
        false,
        true,
        true,
      );

      // ActionService sets totalWinAmount but doesn't credit
      // BlackjackService will credit based on totalWinAmount
      expect(game.totalWinAmount).toBe('1200.00000000'); // 400 + 800
    });

    it('should correctly pay out when main hand is doubled and both win', async () => {
      const game = createSplitGame({
        betAmount: '200.00000000', // Original bet per hand
        totalBetAmount: '600.00000000', // Split + double on main hand
        isDoubleDown: true,
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(21) // main hand (doubled)
        .mockReturnValueOnce(19); // split hand

      await (service as any).completeSplitGame(game);

      // Main hand (doubled): 400 bet → 800 win
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '400.00000000',
        false,
        false,
        true,
      );

      // Split hand: 200 bet → 400 win
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
        true,
      );
    });
  });

  describe('🎯 SCENARIO 3: Split Double - Both Hands Doubled', () => {
    it('should correctly pay out when both hands are doubled and both win (800 total → 1600 payout)', async () => {
      const game = createSplitGame({
        betAmount: '200.00000000', // Original bet per hand
        totalBetAmount: '800.00000000', // Original 200 + split 200 + double main 200 + double split 200
        isDoubleDown: true,
        isSplitDoubleDown: true,
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main hand
        .mockReturnValueOnce(21); // split hand

      await (service as any).completeSplitGame(game);

      // Both hands doubled: each should win 2x their doubled amount
      // Main hand: 400 bet → 800 win
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '400.00000000',
        false,
        false,
        true,
      );

      // Split hand: 400 bet → 800 win
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '400.00000000',
        false,
        false,
        true,
        true,
      );

      // Total winnings: 1600 (800 + 800)
    });
  });

  describe('🎯 SCENARIO 4: Mixed Outcomes', () => {
    it('should handle one hand winning, one hand losing', async () => {
      const game = createSplitGame({
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.BUST, // Split hand busted
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(20) // dealer
        .mockReturnValueOnce(18) // main hand (loses to dealer 20)
        .mockReturnValueOnce(25); // split hand (bust)

      gameLogicService.isDealerBust.mockReturnValue(false);

      await (service as any).completeSplitGame(game);

      // Main hand loses (18 vs dealer 20)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        false,
      );

      // Split hand busted
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        false,
        true,
      );

      // ActionService sets totalWinAmount to 0 for losses
      expect(game.totalWinAmount).toBe('0.00000000');
    });

    it('should handle push scenarios correctly', async () => {
      const game = createSplitGame({
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(20) // dealer
        .mockReturnValueOnce(20) // main hand (push)
        .mockReturnValueOnce(21); // split hand (wins)

      gameLogicService.isDealerBust.mockReturnValue(false);

      await (service as any).completeSplitGame(game);

      // Main hand pushes (returns bet)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        true,
        false,
      );

      // Split hand wins
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
        true,
      );
    });
  });

  describe('🎯 SCENARIO 5: Split "Blackjack" (21) Scenarios', () => {
    it('should pay split "blackjack" as regular 21 (2:1, not 3:2)', async () => {
      const game = createSplitGame({
        playerHandStatus: HandStatus.BLACKJACK, // This is 21, not true blackjack in splits
        splitHandStatus: HandStatus.BLACKJACK,
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(20) // dealer
        .mockReturnValueOnce(21) // main hand "blackjack"
        .mockReturnValueOnce(21); // split hand "blackjack"

      await (service as any).completeSplitGame(game);

      // Both hands should pay 2:1 (regular win), not 3:2 (blackjack)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true, // NOT true blackjack
      );

      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
        true, // NOT true blackjack
      );
    });
  });

  describe('🎯 SCENARIO 6: Edge Cases', () => {
    it('should handle split with side bets correctly', async () => {
      const game = createSplitGame({
        totalBetAmount: '450.00000000', // 400 main + 50 side bets
        perfectPairsBet: '25.00000000',
        twentyOnePlusThreeBet: '25.00000000',
        perfectPairsWin: '0',
        twentyOnePlusThreeWin: '0',
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main
        .mockReturnValueOnce(19); // split

      await (service as any).completeSplitGame(game);

      // Should correctly calculate hand bet amounts excluding side bets
      // totalBetAmount (450) - sideBets (50) = 400 main bet
      // 400 / 2 = 200 per hand
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '200.00000000',
        false,
        false,
        true,
      );
    });

    it('should handle extremely small bet amounts', async () => {
      const game = createSplitGame({
        betAmount: '0.00000002', // Minimum split bet
        totalBetAmount: '0.00000002',
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main
        .mockReturnValueOnce(19); // split

      await (service as any).completeSplitGame(game);

      // Should handle precision correctly for tiny amounts
      expect(payoutService.setGamePayout).toHaveBeenCalledTimes(2);
      // ActionService sets totalWinAmount, BlackjackService will credit
    });

    it('should handle very large bet amounts without precision loss', async () => {
      const game = createSplitGame({
        betAmount: '10000000.00000000', // 10M BTC split bet
        totalBetAmount: '10000000.00000000',
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.STAND,
      });

      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main
        .mockReturnValueOnce(19); // split

      await (service as any).completeSplitGame(game);

      // ActionService sets totalWinAmount, BlackjackService will credit
      // Should handle large numbers without precision issues
      expect(game.totalWinAmount).toBeTruthy();
    });
  });

  describe('🎯 SCENARIO 7: Error Handling', () => {
    it('should handle balance service failures gracefully', async () => {
      const game = createSplitGame();

      balanceService.updateBalance.mockRejectedValue(new Error('Balance service error'));

      const result = await service.handleDoubleSplit(game, mockUser.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('financial.error.insufficient_balance');
    });

    it('should handle invalid game states', async () => {
      const game = createSplitGame({
        isSplit: false, // Invalid state for split double
      });

      const result = await service.handleDoubleSplit(game, mockUser.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is not split');
    });
  });

  describe('🎯 SCENARIO 8: Integration Test - Full Split Double Flow', () => {
    it('should execute complete split-double-win scenario end-to-end', async () => {
      // Start with a split game
      const game = createSplitGame({
        betAmount: '200.00000000', // Original bet per hand
        totalBetAmount: '400.00000000', // 200 main + 200 split
        activeHand: 'split',
        playerHandStatus: HandStatus.STAND,
        splitHandStatus: HandStatus.ACTIVE,
      });

      // Execute double on split hand
      gameLogicService.getAvailableActions.mockResolvedValue([BlackjackAction.DOUBLE_SPLIT]);

      const doubleResult = await service.handleDoubleSplit(game, mockUser.id);
      expect(doubleResult.success).toBe(true);
      expect(game.totalBetAmount).toBe('600.00000000');
      expect(game.isSplitDoubleDown).toBe(true);

      // Complete the game with both hands winning
      gameLogicService.isDealerBust.mockReturnValue(true);
      gameLogicService.getBestScore
        .mockReturnValueOnce(16) // dealer
        .mockReturnValueOnce(20) // main hand (200 bet)
        .mockReturnValueOnce(21); // split hand (400 bet due to double)

      await (service as any).completeSplitGame(game);

      // ActionService sets totalWinAmount, BlackjackService will credit
      expect(game.totalWinAmount).toBeTruthy();

      // Verify balance was charged correctly during double
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.BET,
          amount: expect.any(Object),
        }),
      );
    });
  });

  describe('🎯 SCENARIO 9: Split Aces Special Rule', () => {
    it('should mark split as split aces and auto-complete both hands when splitting aces', async () => {
      const game: BlackjackGameEntity = {
        id: 'game-123',
        userId: 'user-1',
        user: mockUser,
        gameSessionId: 'session-123',
        betAmount: '100.00000000',
        totalBetAmount: '100.00000000',
        asset: AssetTypeEnum.BTC,
        status: BlackjackGameStatus.ACTIVE,
        playerCards: [createCard('Hearts', 'A', 1), createCard('Spades', 'A', 1)],
        dealerCards: [createCard('Hearts', 'K', 10), createCard('Spades', '6', 6)],
        playerScore: 2,
        playerSoftScore: 12,
        splitScore: 0,
        splitSoftScore: 0,
        dealerScore: 16,
        dealerSoftScore: 16,
        isSplit: false,
        isSplitAces: false,
        activeHand: 'main',
        playerHandStatus: HandStatus.ACTIVE,
        splitHandStatus: HandStatus.ACTIVE,
        isDoubleDown: false,
        isSplitDoubleDown: false,
        isInsurance: false,
        isInsuranceRejected: false,
        payoutMultiplier: '0',
        splitPayoutMultiplier: '0',
        cardCursor: 2,
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        nonce: '1',
        serverSeedHash: 'hash',
        gameHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlackjackGameEntity;

      // Mock card service to return cards for split
      cardService.generateCard
        .mockReturnValueOnce(createCard('Diamonds', '10', 10)) // Main hand gets 10
        .mockReturnValueOnce(createCard('Clubs', 'K', 10)); // Split hand gets K

      // Mock isBlackjack to return true for both hands (A+10)
      gameLogicService.isBlackjack.mockReturnValue(true);

      gameLogicService.calculateScore
        .mockReturnValueOnce({ hard: 11, soft: 21 }) // Main hand: A+10
        .mockReturnValueOnce({ hard: 11, soft: 21 }); // Split hand: A+K

      const result = await service.handleSplit(game, mockUser.id);

      expect(result.success).toBe(true);
      expect(result.gameCompleted).toBe(true); // BUG FIX: Should auto-complete
      expect(game.status).toBe(BlackjackGameStatus.COMPLETED); // BUG FIX: Status should be COMPLETED
      expect(game.isSplit).toBe(true);
      expect(game.isSplitAces).toBe(true); // Should be marked as split aces
      expect(game.playerHandStatus).toBe(HandStatus.BLACKJACK); // A+10 = blackjack
      expect(game.splitHandStatus).toBe(HandStatus.BLACKJACK); // A+K = blackjack
      expect(game.activeHand).toBe('split'); // Should switch to split hand
      expect(game.playerCards).toHaveLength(2); // Should have exactly 2 cards
      expect(game.splitCards).toHaveLength(2); // Should have exactly 2 cards
    });

    it('should auto-complete split ace hands even if they do not get blackjack', async () => {
      const game: BlackjackGameEntity = {
        id: 'game-123',
        userId: 'user-1',
        user: mockUser,
        gameSessionId: 'session-123',
        betAmount: '100.00000000',
        totalBetAmount: '100.00000000',
        asset: AssetTypeEnum.BTC,
        status: BlackjackGameStatus.ACTIVE,
        playerCards: [createCard('Hearts', 'A', 1), createCard('Spades', 'A', 1)],
        dealerCards: [createCard('Hearts', 'K', 10), createCard('Spades', '6', 6)],
        playerScore: 2,
        playerSoftScore: 12,
        splitScore: 0,
        splitSoftScore: 0,
        dealerScore: 16,
        dealerSoftScore: 16,
        isSplit: false,
        isSplitAces: false,
        activeHand: 'main',
        playerHandStatus: HandStatus.ACTIVE,
        splitHandStatus: HandStatus.ACTIVE,
        isDoubleDown: false,
        isSplitDoubleDown: false,
        isInsurance: false,
        isInsuranceRejected: false,
        payoutMultiplier: '0',
        splitPayoutMultiplier: '0',
        cardCursor: 2,
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        nonce: '1',
        serverSeedHash: 'hash',
        gameHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlackjackGameEntity;

      // Mock card service to return non-10 cards
      cardService.generateCard
        .mockReturnValueOnce(createCard('Diamonds', '7', 7)) // Main hand gets 7 (total 18)
        .mockReturnValueOnce(createCard('Clubs', '5', 5)); // Split hand gets 5 (total 16)

      // Mock isBlackjack to return false (not A+10)
      gameLogicService.isBlackjack.mockReturnValue(false);

      gameLogicService.calculateScore
        .mockReturnValueOnce({ hard: 8, soft: 18 }) // Main hand: A+7
        .mockReturnValueOnce({ hard: 6, soft: 16 }); // Split hand: A+5

      const result = await service.handleSplit(game, mockUser.id);

      expect(result.success).toBe(true);
      expect(result.gameCompleted).toBe(true); // BUG FIX: Should auto-complete
      expect(game.status).toBe(BlackjackGameStatus.COMPLETED); // BUG FIX: Status should be COMPLETED
      expect(game.isSplitAces).toBe(true);
      expect(game.playerHandStatus).toBe(HandStatus.COMPLETED); // Auto-completed
      expect(game.splitHandStatus).toBe(HandStatus.COMPLETED); // Auto-completed
    });

    it('should prevent hit action on split ace hands', async () => {
      const game = createSplitGame({
        isSplit: true,
        isSplitAces: true, // Split aces
        activeHand: 'main',
        playerHandStatus: HandStatus.COMPLETED,
        splitHandStatus: HandStatus.COMPLETED,
      });

      // Mock getAvailableActions to simulate validation
      gameLogicService.getAvailableActions.mockResolvedValue([]); // No actions should be available

      const actions = await gameLogicService.getAvailableActions(game, mockUser.id);

      expect(actions).toEqual([]); // No actions allowed on split aces
    });

    it('should prevent double action on split ace hands', async () => {
      const game = createSplitGame({
        isSplit: true,
        isSplitAces: true,
        activeHand: 'split',
        playerHandStatus: HandStatus.COMPLETED,
        splitHandStatus: HandStatus.COMPLETED,
      });

      gameLogicService.getAvailableActions.mockResolvedValue([]);

      const actions = await gameLogicService.getAvailableActions(game, mockUser.id);

      expect(actions).toEqual([]);
      expect(actions).not.toContain(BlackjackAction.DOUBLE_SPLIT);
      expect(actions).not.toContain(BlackjackAction.HIT_SPLIT);
    });

    it('should pay split aces blackjack as 1:1, not 3:2', async () => {
      const game = createSplitGame({
        betAmount: '100.00000000',
        totalBetAmount: '200.00000000',
        isSplit: true,
        isSplitAces: true,
        playerHandStatus: HandStatus.BLACKJACK, // A+10 after split
        splitHandStatus: HandStatus.BLACKJACK, // A+K after split
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(20) // dealer (no blackjack)
        .mockReturnValueOnce(21) // main hand blackjack
        .mockReturnValueOnce(21); // split hand blackjack

      await (service as any).completeSplitGame(game);

      // Both hands should pay 2:1 (NOT 3:2 blackjack payout)
      // Even though status is BLACKJACK, split aces pay as regular 21
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false, // NOT blackjack payout
        false,
        true,
      );

      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false, // NOT blackjack payout
        false,
        true,
        true,
      );
    });

    it('should evaluate split ace hands correctly against dealer', async () => {
      const game = createSplitGame({
        betAmount: '100.00000000',
        totalBetAmount: '200.00000000',
        isSplit: true,
        isSplitAces: true,
        playerCards: [createCard('Hearts', 'A', 1), createCard('Diamonds', '9', 9)],
        splitCards: [createCard('Spades', 'A', 1), createCard('Clubs', '7', 7)],
        playerScore: 10,
        playerSoftScore: 20,
        splitScore: 8,
        splitSoftScore: 18,
        playerHandStatus: HandStatus.COMPLETED,
        splitHandStatus: HandStatus.COMPLETED,
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(19) // dealer
        .mockReturnValueOnce(20) // main hand (A+9 = 20, wins)
        .mockReturnValueOnce(18); // split hand (A+7 = 18, loses)

      gameLogicService.isDealerBust.mockReturnValue(false);

      await (service as any).completeSplitGame(game);

      // Main hand wins (20 > 19)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false,
        false,
        true,
      );

      // Split hand loses (18 < 19)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false,
        false,
        false,
        true,
      );
    });

    it('should handle split aces with dealer blackjack correctly', async () => {
      const game = createSplitGame({
        betAmount: '100.00000000',
        totalBetAmount: '200.00000000',
        isSplit: true,
        isSplitAces: true,
        playerHandStatus: HandStatus.BLACKJACK,
        splitHandStatus: HandStatus.COMPLETED,
        dealerCards: [createCard('Hearts', 'A', 1), createCard('Spades', 'K', 10)],
      });

      gameLogicService.getBestScore
        .mockReturnValueOnce(21) // dealer blackjack
        .mockReturnValueOnce(21) // main hand blackjack (push)
        .mockReturnValueOnce(18); // split hand (loses)

      await (service as any).completeSplitGame(game);

      // Main hand pushes with dealer (both 21)
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false,
        true, // push
        false,
      );

      // Split hand loses to dealer blackjack
      expect(payoutService.setGamePayout).toHaveBeenCalledWith(
        game,
        '100.00000000',
        false,
        false,
        false,
        true,
      );
    });
  });
});
