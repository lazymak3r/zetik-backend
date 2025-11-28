import { Test, TestingModule } from '@nestjs/testing';
import { BlackjackGameEntity, BlackjackGameStatus, Card, HandStatus } from '@zetik/shared-entities';
import { createTestProviders } from '../../../../test-utils';
import { BlackjackUtilsService, IBlackjackUtils } from '../../services/blackjack-utils.service';

describe('🔧 BlackjackUtilsService - Casino Grade Testing', () => {
  let service: IBlackjackUtils;

  // Helper function to create test cards
  const createCard = (suit: string, rank: string, value: number): Card => ({
    suit,
    rank,
    value,
  });

  // Helper function to create test game entity
  const createTestGame = (
    overrides: Partial<BlackjackGameEntity> = {},
  ): Partial<BlackjackGameEntity> => ({
    id: 'test-game-1',
    status: BlackjackGameStatus.ACTIVE,
    playerHandStatus: HandStatus.ACTIVE,
    splitHandStatus: undefined,
    activeHand: 'main',
    isSplit: false,
    playerScore: 15,
    dealerScore: 10,
    betAmount: '100.00000000',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlackjackUtilsService, ...createTestProviders()],
    }).compile();

    service = module.get<BlackjackUtilsService>(BlackjackUtilsService);
  });

  describe('🎯 Split Game Management', () => {
    describe('🧮 CASINO STANDARD: Split game completion logic', () => {
      it('Should return false for non-split games', () => {
        const game = createTestGame({
          isSplit: false,
        }) as BlackjackGameEntity;

        const result = service.checkIfGameCompleted(game);

        expect(result).toBe(false);
      });

      it('Should switch to split hand when main hand finished', () => {
        const game = createTestGame({
          isSplit: true,
          activeHand: 'main',
          playerHandStatus: HandStatus.STAND,
          splitHandStatus: HandStatus.ACTIVE,
        }) as BlackjackGameEntity;

        const result = service.checkIfGameCompleted(game);

        expect(result).toBe(false);
        expect(game.activeHand).toBe('split');
      });

      it('Should complete game when both hands finished', () => {
        const game = createTestGame({
          isSplit: true,
          activeHand: 'split',
          playerHandStatus: HandStatus.STAND,
          splitHandStatus: HandStatus.STAND,
        }) as BlackjackGameEntity;

        const result = service.checkIfGameCompleted(game);

        expect(result).toBe(true);
        expect(game.status).toBe(BlackjackGameStatus.COMPLETED);
      });

      it('🧮 MATHEMATICAL PROOF: All hand finish combinations', () => {
        const finishedStatuses = [
          HandStatus.STAND,
          HandStatus.BUST,
          HandStatus.BLACKJACK,
          HandStatus.COMPLETED,
        ];

        finishedStatuses.forEach((mainStatus) => {
          finishedStatuses.forEach((splitStatus) => {
            const game = createTestGame({
              isSplit: true,
              playerHandStatus: mainStatus,
              splitHandStatus: splitStatus,
              activeHand: 'split',
            }) as BlackjackGameEntity;

            const result = service.checkIfGameCompleted(game);
            expect(result).toBe(true);
            expect(game.status).toBe(BlackjackGameStatus.COMPLETED);
          });
        });
      });
    });

    describe('🧮 CASINO STANDARD: Split game status analysis', () => {
      it('Should analyze non-split game correctly', () => {
        const game = createTestGame({
          isSplit: false,
        }) as BlackjackGameEntity;

        const status = service.getSplitGameStatus(game);

        expect(status.bothHandsFinished).toBe(false);
        expect(status.shouldSwitchToSplit).toBe(false);
        expect(status.mainHandFinished).toBe(false);
        expect(status.splitHandFinished).toBe(false);
        expect(status.gameCompleted).toBe(false);
      });

      it('Should detect when to switch to split hand', () => {
        const game = createTestGame({
          isSplit: true,
          activeHand: 'main',
          playerHandStatus: HandStatus.BUST,
          splitHandStatus: HandStatus.ACTIVE,
        }) as BlackjackGameEntity;

        const status = service.getSplitGameStatus(game);

        expect(status.shouldSwitchToSplit).toBe(true);
        expect(status.mainHandFinished).toBe(true);
        expect(status.splitHandFinished).toBe(false);
        expect(status.gameCompleted).toBe(false);
      });

      it('Should detect game completion', () => {
        const game = createTestGame({
          isSplit: true,
          playerHandStatus: HandStatus.BLACKJACK,
          splitHandStatus: HandStatus.STAND,
        }) as BlackjackGameEntity;

        const status = service.getSplitGameStatus(game);

        expect(status.bothHandsFinished).toBe(true);
        expect(status.gameCompleted).toBe(true);
      });

      it('🧮 EDGE CASE: Handle undefined hand statuses', () => {
        const game = createTestGame({
          isSplit: true,
          playerHandStatus: undefined,
          splitHandStatus: undefined,
        }) as BlackjackGameEntity;

        const status = service.getSplitGameStatus(game);

        expect(status.mainHandFinished).toBe(false);
        expect(status.splitHandFinished).toBe(false);
        expect(status.bothHandsFinished).toBe(false);
      });
    });
  });

  describe('🎯 Game State Validation', () => {
    describe('🧮 CASINO STANDARD: Game state analysis', () => {
      it('Should validate active game state', () => {
        const game = createTestGame({
          status: BlackjackGameStatus.ACTIVE,
          playerHandStatus: HandStatus.ACTIVE,
        }) as BlackjackGameEntity;

        const validation = service.validateGameState(game);

        expect(validation.isGameActive).toBe(true);
        expect(validation.canPerformActions).toBe(true);
        expect(validation.requiresDealerPlay).toBe(false);
        expect(validation.isCompleted).toBe(false);
      });

      it('Should validate dealer turn state', () => {
        const game = createTestGame({
          status: BlackjackGameStatus.DEALER_TURN,
          playerHandStatus: HandStatus.STAND,
        }) as BlackjackGameEntity;

        const validation = service.validateGameState(game);

        expect(validation.isGameActive).toBe(true);
        expect(validation.canPerformActions).toBe(false);
        expect(validation.requiresDealerPlay).toBe(true);
        expect(validation.isCompleted).toBe(false);
      });

      it('Should validate completed game state', () => {
        const game = createTestGame({
          status: BlackjackGameStatus.COMPLETED,
          playerHandStatus: HandStatus.COMPLETED,
        }) as BlackjackGameEntity;

        const validation = service.validateGameState(game);

        expect(validation.isGameActive).toBe(false);
        expect(validation.canPerformActions).toBe(false);
        expect(validation.requiresDealerPlay).toBe(false);
        expect(validation.isCompleted).toBe(true);
      });

      it('Should validate split game actions', () => {
        const game = createTestGame({
          status: BlackjackGameStatus.ACTIVE,
          isSplit: true,
          playerHandStatus: HandStatus.STAND,
          splitHandStatus: HandStatus.ACTIVE,
        }) as BlackjackGameEntity;

        const validation = service.validateGameState(game);

        expect(validation.canPerformActions).toBe(true); // Can act on split hand
      });
    });
  });

  describe('🎯 Bet Amount Formatting & Calculations', () => {
    describe('🧮 CASINO STANDARD: Bet amount formatting', () => {
      it('Should format string bet amounts correctly', () => {
        expect(service.formatBetAmount('100')).toBe('100.00000000');
        expect(service.formatBetAmount('50.5')).toBe('50.50000000');
        expect(service.formatBetAmount('0.00000001')).toBe('0.00000001');
      });

      it('Should format number bet amounts correctly', () => {
        expect(service.formatBetAmount(100)).toBe('100.00000000');
        expect(service.formatBetAmount(50.5)).toBe('50.50000000');
        expect(service.formatBetAmount(0.00000001)).toBe('0.00000001');
      });

      it('Should handle custom precision', () => {
        expect(service.formatBetAmount('100.123456789', 4)).toBe('100.1235');
        expect(service.formatBetAmount('50.5', 2)).toBe('50.50');
      });

      it('Should handle invalid amounts gracefully', () => {
        expect(service.formatBetAmount('invalid')).toBe('0.00000000');
        expect(service.formatBetAmount('')).toBe('0.00000000');
        expect(service.formatBetAmount(NaN)).toBe('0.00000000');
      });

      it('🧮 PRECISION: High precision calculations', () => {
        const preciseAmount = '123.12345678';
        const result = service.formatBetAmount(preciseAmount);
        expect(result).toBe('123.12345678');
      });
    });

    describe('🧮 CASINO STANDARD: Split bet calculations', () => {
      it('Should calculate single hand bet correctly', () => {
        expect(service.calculateSingleHandBet('200.00000000')).toBe('100.00000000');
        expect(service.calculateSingleHandBet('100')).toBe('50.00000000');
        expect(service.calculateSingleHandBet('0.00000002')).toBe('0.00000001');
      });

      it('Should handle odd amounts correctly', () => {
        const result = service.calculateSingleHandBet('100.00000001');
        expect(result).toBe('50.00000001'); // 100.00000001 / 2 = 50.000000005 → 50.00000001
      });

      it('Should handle invalid bet amounts', () => {
        expect(service.calculateSingleHandBet('invalid')).toBe('0.00000000');
        expect(service.calculateSingleHandBet('')).toBe('0.00000000');
      });

      it('🧮 MATHEMATICAL PROOF: Division consistency', () => {
        const testAmounts = ['100', '200', '1000', '0.00000002', '0.1'];

        testAmounts.forEach((amount) => {
          const singleHand = service.calculateSingleHandBet(amount);
          const doubleCheck = parseFloat(singleHand) * 2;
          const originalAmount = parseFloat(amount);

          expect(doubleCheck).toBeCloseTo(originalAmount, 7); // 7 decimal precision
        });
      });
    });
  });

  describe('🎯 Validation & Security', () => {
    describe('🛡️ ANTI-FRAUD: Bet amount validation', () => {
      it('Should accept valid bet amounts', () => {
        expect(service.validateBetAmount('100')).toBe(true);
        expect(service.validateBetAmount('0.00000001')).toBe(true); // Minimum bet
        expect(service.validateBetAmount('999999')).toBe(true);
      });

      it('Should reject invalid bet amounts', () => {
        expect(service.validateBetAmount('0')).toBe(false); // Zero bet
        expect(service.validateBetAmount('-10')).toBe(false); // Negative bet
        expect(service.validateBetAmount('0.000000001')).toBe(false); // Too precise
        expect(service.validateBetAmount('1000001')).toBe(false); // Exceeds max
      });

      it('Should reject invalid formats', () => {
        expect(service.validateBetAmount('invalid')).toBe(false);
        expect(service.validateBetAmount('')).toBe(false);
        expect(service.validateBetAmount('NaN')).toBe(false);
        expect(service.validateBetAmount('Infinity')).toBe(false);
      });

      it('🧮 BOUNDARY TESTING: Min/max limits', () => {
        expect(service.validateBetAmount('0.00000001')).toBe(true); // Exact min
        expect(service.validateBetAmount('0.000000001')).toBe(false); // Below min precision
        expect(service.validateBetAmount('1000000')).toBe(true); // Exact max
        expect(service.validateBetAmount('1000000.1')).toBe(false); // Above max
      });
    });

    describe('🛡️ SECURITY: UUID validation', () => {
      it('Should validate proper UUIDs', () => {
        expect(service.isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(service.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      });

      it('Should reject invalid UUIDs', () => {
        expect(service.isValidUUID('invalid-uuid')).toBe(false);
        expect(service.isValidUUID('123')).toBe(false);
        expect(service.isValidUUID('')).toBe(false);
        expect(service.isValidUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Too short
      });

      it('Should handle edge cases', () => {
        expect(service.isValidUUID(null as any)).toBe(false);
        expect(service.isValidUUID(undefined as any)).toBe(false);
        expect(service.isValidUUID(123 as any)).toBe(false);
      });
    });

    describe('🛡️ SECURITY: Data sanitization', () => {
      it('Should sanitize game data correctly', () => {
        const game = createTestGame({
          userId: 'sensitive-user-id',
          cardCursor: 5, // Infinite deck cursor
          playerCards: [createCard('hearts', 'K', 10)],
        }) as BlackjackGameEntity;

        const sanitized = service.sanitizeGameData(game);

        expect(sanitized.id).toBe(game.id);
        expect(sanitized.status).toBe(game.status);
        expect(sanitized.betAmount).toBe(game.betAmount);
        expect(sanitized.userId).toBeUndefined(); // Removed
        expect(sanitized.cardCursor).toBeUndefined(); // Removed sensitive data
        expect(sanitized.playerCards).toBeUndefined(); // Not in essential fields
      });

      it('Should preserve essential fields only', () => {
        const game = createTestGame() as BlackjackGameEntity;
        const sanitized = service.sanitizeGameData(game);

        const expectedFields = [
          'id',
          'status',
          'betAmount',
          'playerHandStatus',
          'splitHandStatus',
          'activeHand',
          'isSplit',
          'playerScore',
          'dealerScore',
          'createdAt',
        ];

        expectedFields.forEach((field) => {
          expect(sanitized).toHaveProperty(field);
        });
      });
    });
  });

  describe('🎯 Utility Functions', () => {
    describe('🧮 CASINO STANDARD: Card display formatting', () => {
      it('Should format cards with suit symbols', () => {
        const cards = [
          createCard('hearts', 'A', 11),
          createCard('spades', 'K', 10),
          createCard('diamonds', 'Q', 10),
          createCard('clubs', 'J', 10),
        ];

        const result = service.formatCardDisplay(cards);
        expect(result).toBe('A♥, K♠, Q♦, J♣');
      });

      it('Should handle empty card arrays', () => {
        expect(service.formatCardDisplay([])).toBe('[]');
        expect(service.formatCardDisplay(null as any)).toBe('[]');
      });

      it('Should handle unknown suits gracefully', () => {
        const cards = [createCard('unknown', 'A', 11)];
        const result = service.formatCardDisplay(cards);
        expect(result).toBe('AU'); // First letter uppercase
      });
    });

    describe('🧮 CASINO STANDARD: Debug message formatting', () => {
      it('Should format debug messages consistently', () => {
        const result = service.formatDebugMessage('TEST', 'game-123', 'Player hit');
        expect(result).toBe('🎯 TEST: Player hit (Game: game-123)');
      });

      it('Should handle empty messages', () => {
        const result = service.formatDebugMessage('', '', '');
        expect(result).toBe('🎯 :  (Game: )');
      });
    });

    describe('🧮 MATHEMATICAL VALIDATION: Probability calculations', () => {
      it('Should provide accurate blackjack probabilities', () => {
        const probabilities = service.getBlackjackProbabilities();

        expect(probabilities.playerBlackjack).toBeCloseTo(0.048, 3);
        expect(probabilities.dealerBlackjack).toBeCloseTo(0.048, 3);
        expect(probabilities.playerBust).toBeCloseTo(0.28, 2);
        expect(probabilities.dealerBust).toBeCloseTo(0.28, 2);
        expect(probabilities.push).toBeCloseTo(0.09, 2);
      });

      it('Should calculate expected value correctly', () => {
        const scenarios = {
          winProbability: 0.43,
          lossProbability: 0.48,
          pushProbability: 0.09,
          blackjackProbability: 0.048,
        };

        const result = service.calculateExpectedValue('100', scenarios);
        const expectedValue = parseFloat(result);

        // Expected calculation: 100 * (0.048 * 1.5 + 0.43 * 1 + 0.09 * 0 + 0.48 * (-1))
        // = 100 * (0.072 + 0.43 + 0 - 0.48) = 100 * 0.022 = 2.2
        expect(expectedValue).toBeCloseTo(2.2, 1); // Slightly positive (player favored in this scenario)
      });

      it('Should handle invalid EV calculations', () => {
        const scenarios = {
          winProbability: 0.5,
          lossProbability: 0.5,
          pushProbability: 0,
          blackjackProbability: 0,
        };

        const result = service.calculateExpectedValue('invalid', scenarios);
        expect(result).toBe('0.00000000');
      });
    });

    describe('🧮 CASINO STANDARD: Dealer logic validation', () => {
      it('Should determine dealer should hit on 16', () => {
        const cards = [createCard('hearts', '10', 10), createCard('spades', '6', 6)];

        const result = service.shouldDealerContinue(cards);
        expect(result).toBe(true);
      });

      it('Should determine dealer should stand on hard 17', () => {
        const cards = [createCard('hearts', '10', 10), createCard('spades', '7', 7)];

        const result = service.shouldDealerContinue(cards);
        expect(result).toBe(false);
      });

      it('Should determine dealer should stand on soft 17', () => {
        const cards = [createCard('hearts', 'A', 11), createCard('spades', '6', 6)];

        const result = service.shouldDealerContinue(cards);
        expect(result).toBe(false); // Soft 17, dealer stands (S17 rule)
      });

      it('Should determine dealer should stand on soft 18', () => {
        const cards = [createCard('hearts', 'A', 11), createCard('spades', '7', 7)];

        const result = service.shouldDealerContinue(cards);
        expect(result).toBe(false); // Soft 18, dealer stands
      });

      it('Should handle empty dealer cards', () => {
        const result = service.shouldDealerContinue([]);
        expect(result).toBe(false);
      });

      it('🧮 MATHEMATICAL PROOF: All dealer scenarios', () => {
        // Test hard totals 12-21
        for (let total = 12; total <= 16; total++) {
          const cards = [
            createCard('hearts', '10', 10),
            createCard('spades', (total - 10).toString(), total - 10),
          ];
          expect(service.shouldDealerContinue(cards)).toBe(true);
        }

        for (let total = 17; total <= 21; total++) {
          const cards = [
            createCard('hearts', '10', 10),
            createCard('spades', (total - 10).toString(), total - 10),
          ];
          expect(service.shouldDealerContinue(cards)).toBe(false);
        }
      });
    });
  });

  describe('🎯 Performance & Edge Cases', () => {
    describe('🧮 PERFORMANCE: Large data handling', () => {
      it('Should handle large bet amounts efficiently', () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
          service.formatBetAmount('999999.99999999');
          service.validateBetAmount('999999.99999999');
          service.calculateSingleHandBet('999999.99999999');
        }

        const end = performance.now();
        expect(end - start).toBeLessThan(500); // Allow realistic CI variance
      });

      it('Should handle multiple game state validations efficiently', () => {
        const games = Array.from(
          { length: 1000 },
          (_, i) => createTestGame({ id: `game-${i}` }) as BlackjackGameEntity,
        );

        const start = performance.now();

        games.forEach((game) => {
          service.validateGameState(game);
          service.getSplitGameStatus(game);
        });

        const end = performance.now();
        expect(end - start).toBeLessThan(150); // Allow realistic CI variance
      });
    });

    describe('🧮 EDGE CASES: Boundary conditions', () => {
      it('Should handle extreme bet amounts', () => {
        expect(service.formatBetAmount('0.00000001')).toBe('0.00000001');
        expect(service.formatBetAmount('999999.99999999')).toBe('999999.99999999');
      });

      it('Should handle malformed game entities', () => {
        const malformedGame = {} as BlackjackGameEntity;

        expect(() => service.validateGameState(malformedGame)).not.toThrow();
        expect(() => service.getSplitGameStatus(malformedGame)).not.toThrow();
        expect(() => service.checkIfGameCompleted(malformedGame)).not.toThrow();
      });

      it('Should handle null/undefined inputs gracefully', () => {
        expect(service.formatCardDisplay(null as any)).toBe('[]');
        expect(service.validateBetAmount(null as any)).toBe(false);
        expect(service.isValidUUID(null as any)).toBe(false);
        expect(service.calculateExpectedValue(null as any, {} as any)).toBe('0.00000000');
      });
    });
  });
});
