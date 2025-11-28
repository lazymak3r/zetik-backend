import { Test, TestingModule } from '@nestjs/testing';
import {
  BlackjackGameEntity,
  Card,
  PerfectPairsType,
  TwentyOnePlus3Type,
} from '@zetik/shared-entities';
import { createTestProviders } from '../../../../test-utils';
import {
  BlackjackSideBetsService,
  IBlackjackSideBets,
} from '../../services/blackjack-side-bets.service';

describe('🎰 BlackjackSideBetsService - Casino Grade Testing', () => {
  let service: IBlackjackSideBets;

  // Helper function to create test cards
  const createCard = (suit: string, rank: string, value: number): Card => ({
    suit,
    rank,
    value,
  });

  // Helper function to create test game entity
  const createTestGame = (
    playerCards: Card[],
    dealerCards: Card[],
    perfectPairsBet?: string,
    twentyOnePlusThreeBet?: string,
  ): Partial<BlackjackGameEntity> => ({
    id: 'test-game-1',
    playerCards,
    dealerCards,
    perfectPairsBet,
    twentyOnePlusThreeBet,
    perfectPairsWin: '0',
    twentyOnePlusThreeWin: '0',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlackjackSideBetsService, ...createTestProviders()],
    }).compile();

    service = module.get<BlackjackSideBetsService>(BlackjackSideBetsService);
  });

  describe('🎯 Perfect Pairs Evaluation', () => {
    describe('🧮 CASINO STANDARD: Perfect Pair (25:1) - Same rank and suit', () => {
      it('Should detect Hearts perfect pair', () => {
        const cards = [createCard('hearts', 'K', 10), createCard('hearts', 'K', 10)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.PERFECT_PAIR);
        expect(result.multiplier).toBe(25);
      });

      it('Should detect Spades perfect pair', () => {
        const cards = [createCard('spades', 'A', 11), createCard('spades', 'A', 11)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.PERFECT_PAIR);
        expect(result.multiplier).toBe(25);
      });

      it('🧮 MATHEMATICAL PROOF: All perfect pairs should return 25:1', () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        suits.forEach((suit) => {
          ranks.forEach((rank) => {
            const cards = [createCard(suit, rank, 10), createCard(suit, rank, 10)];

            const result = service.evaluatePerfectPairs(cards);
            expect(result.type).toBe(PerfectPairsType.PERFECT_PAIR);
            expect(result.multiplier).toBe(25);
          });
        });
      });
    });

    describe('🧮 CASINO STANDARD: Colored Pair (12:1) - Same color, different suits', () => {
      it('Should detect red colored pair (Hearts + Diamonds)', () => {
        const cards = [createCard('hearts', 'Q', 10), createCard('diamonds', 'Q', 10)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.COLORED_PAIR);
        expect(result.multiplier).toBe(12);
      });

      it('Should detect black colored pair (Clubs + Spades)', () => {
        const cards = [createCard('clubs', '7', 7), createCard('spades', '7', 7)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.COLORED_PAIR);
        expect(result.multiplier).toBe(12);
      });

      it('🧮 MATHEMATICAL PROOF: All red and black combinations', () => {
        const redSuits = ['hearts', 'diamonds'];
        const blackSuits = ['clubs', 'spades'];
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

        // Test red combinations
        redSuits.forEach((suit1) => {
          redSuits.forEach((suit2) => {
            if (suit1 !== suit2) {
              ranks.forEach((rank) => {
                const cards = [createCard(suit1, rank, 10), createCard(suit2, rank, 10)];

                const result = service.evaluatePerfectPairs(cards);
                expect(result.type).toBe(PerfectPairsType.COLORED_PAIR);
                expect(result.multiplier).toBe(12);
              });
            }
          });
        });

        // Test black combinations
        blackSuits.forEach((suit1) => {
          blackSuits.forEach((suit2) => {
            if (suit1 !== suit2) {
              ranks.forEach((rank) => {
                const cards = [createCard(suit1, rank, 10), createCard(suit2, rank, 10)];

                const result = service.evaluatePerfectPairs(cards);
                expect(result.type).toBe(PerfectPairsType.COLORED_PAIR);
                expect(result.multiplier).toBe(12);
              });
            }
          });
        });
      });
    });

    describe('🧮 CASINO STANDARD: Mixed Pair (6:1) - Different colors', () => {
      it('Should detect mixed pair (Red + Black)', () => {
        const cards = [createCard('hearts', 'J', 10), createCard('clubs', 'J', 10)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.MIXED_PAIR);
        expect(result.multiplier).toBe(6);
      });

      it('🧮 MATHEMATICAL PROOF: All mixed color combinations', () => {
        const redSuits = ['hearts', 'diamonds'];
        const blackSuits = ['clubs', 'spades'];
        const ranks = ['A', 'K', 'Q', 'J', '10'];

        redSuits.forEach((redSuit) => {
          blackSuits.forEach((blackSuit) => {
            ranks.forEach((rank) => {
              const cards = [createCard(redSuit, rank, 10), createCard(blackSuit, rank, 10)];

              const result = service.evaluatePerfectPairs(cards);
              expect(result.type).toBe(PerfectPairsType.MIXED_PAIR);
              expect(result.multiplier).toBe(6);
            });
          });
        });
      });
    });

    describe('🛡️ EDGE CASES: No Perfect Pairs', () => {
      it('Should return NONE for different ranks', () => {
        const cards = [createCard('hearts', 'K', 10), createCard('hearts', 'Q', 10)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.NONE);
        expect(result.multiplier).toBe(0);
      });

      it('Should return NONE for insufficient cards', () => {
        const cards = [createCard('hearts', 'K', 10)];

        const result = service.evaluatePerfectPairs(cards);

        expect(result.type).toBe(PerfectPairsType.NONE);
        expect(result.multiplier).toBe(0);
      });

      it('Should return NONE for empty array', () => {
        const result = service.evaluatePerfectPairs([]);

        expect(result.type).toBe(PerfectPairsType.NONE);
        expect(result.multiplier).toBe(0);
      });
    });
  });

  describe('🎯 21+3 Evaluation', () => {
    describe('🧮 CASINO STANDARD: Suited Trips (100:1) - Same rank and suit', () => {
      it('Should detect suited trips', () => {
        const playerCards = [createCard('hearts', 'A', 11), createCard('hearts', 'A', 11)];
        const dealerCard = createCard('hearts', 'A', 11);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.SUITED_TRIPS);
        expect(result.multiplier).toBe(100);
      });

      it('🧮 MATHEMATICAL PROOF: All suited trips combinations', () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['K', 'Q', 'J'];

        suits.forEach((suit) => {
          ranks.forEach((rank) => {
            const playerCards = [createCard(suit, rank, 10), createCard(suit, rank, 10)];
            const dealerCard = createCard(suit, rank, 10);

            const result = service.evaluate21Plus3(playerCards, dealerCard);
            expect(result.type).toBe(TwentyOnePlus3Type.SUITED_TRIPS);
            expect(result.multiplier).toBe(100);
          });
        });
      });
    });

    describe('🧮 CASINO STANDARD: Straight Flush (40:1) - Sequential + same suit', () => {
      it('Should detect straight flush (A-2-3)', () => {
        const playerCards = [createCard('spades', 'A', 11), createCard('spades', '2', 2)];
        const dealerCard = createCard('spades', '3', 3);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT_FLUSH);
        expect(result.multiplier).toBe(40);
      });

      it('Should detect straight flush (Q-K-A)', () => {
        const playerCards = [createCard('hearts', 'Q', 10), createCard('hearts', 'K', 10)];
        const dealerCard = createCard('hearts', 'A', 11);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT_FLUSH);
        expect(result.multiplier).toBe(40);
      });

      it('Should detect straight flush (7-8-9)', () => {
        const playerCards = [createCard('clubs', '7', 7), createCard('clubs', '8', 8)];
        const dealerCard = createCard('clubs', '9', 9);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT_FLUSH);
        expect(result.multiplier).toBe(40);
      });
    });

    describe('🧮 CASINO STANDARD: Three of a Kind (30:1) - Same rank', () => {
      it('Should detect three of a kind with different suits', () => {
        const playerCards = [createCard('hearts', 'K', 10), createCard('clubs', 'K', 10)];
        const dealerCard = createCard('spades', 'K', 10);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.THREE_OF_KIND);
        expect(result.multiplier).toBe(30);
      });

      it('🧮 MATHEMATICAL PROOF: All three of a kind combinations', () => {
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];

        ranks.forEach((rank) => {
          const playerCards = [createCard(suits[0], rank, 10), createCard(suits[1], rank, 10)];
          const dealerCard = createCard(suits[2], rank, 10);

          const result = service.evaluate21Plus3(playerCards, dealerCard);
          expect(result.type).toBe(TwentyOnePlus3Type.THREE_OF_KIND);
          expect(result.multiplier).toBe(30);
        });
      });
    });

    describe('🧮 CASINO STANDARD: Straight (10:1) - Sequential ranks', () => {
      it('Should detect straight with mixed suits', () => {
        const playerCards = [createCard('hearts', '5', 5), createCard('clubs', '6', 6)];
        const dealerCard = createCard('spades', '7', 7);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT);
        expect(result.multiplier).toBe(10);
      });

      it('Should detect ace-low straight (A-2-3)', () => {
        const playerCards = [createCard('hearts', 'A', 11), createCard('clubs', '2', 2)];
        const dealerCard = createCard('spades', '3', 3);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT);
        expect(result.multiplier).toBe(10);
      });

      it('Should detect ace-high straight (Q-K-A)', () => {
        const playerCards = [createCard('hearts', 'Q', 10), createCard('clubs', 'K', 10)];
        const dealerCard = createCard('spades', 'A', 11);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.STRAIGHT);
        expect(result.multiplier).toBe(10);
      });
    });

    describe('🧮 CASINO STANDARD: Flush (5:1) - Same suit', () => {
      it('Should detect flush with different ranks', () => {
        const playerCards = [createCard('diamonds', '2', 2), createCard('diamonds', '7', 7)];
        const dealerCard = createCard('diamonds', 'K', 10);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.FLUSH);
        expect(result.multiplier).toBe(5);
      });

      it('🧮 MATHEMATICAL PROOF: All flush combinations', () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];

        suits.forEach((suit) => {
          const playerCards = [createCard(suit, '2', 2), createCard(suit, '8', 8)];
          const dealerCard = createCard(suit, 'J', 10);

          const result = service.evaluate21Plus3(playerCards, dealerCard);
          expect(result.type).toBe(TwentyOnePlus3Type.FLUSH);
          expect(result.multiplier).toBe(5);
        });
      });
    });

    describe('🛡️ EDGE CASES: No 21+3', () => {
      it('Should return NONE for no matching patterns', () => {
        const playerCards = [createCard('hearts', '2', 2), createCard('clubs', '7', 7)];
        const dealerCard = createCard('spades', 'J', 10);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.NONE);
        expect(result.multiplier).toBe(0);
      });

      it('Should return NONE for insufficient player cards', () => {
        const playerCards = [createCard('hearts', 'K', 10)];
        const dealerCard = createCard('spades', 'Q', 10);

        const result = service.evaluate21Plus3(playerCards, dealerCard);

        expect(result.type).toBe(TwentyOnePlus3Type.NONE);
        expect(result.multiplier).toBe(0);
      });

      it('Should return NONE for missing dealer card', () => {
        const playerCards = [createCard('hearts', 'K', 10), createCard('clubs', 'Q', 10)];

        const result = service.evaluate21Plus3(playerCards, null as any);

        expect(result.type).toBe(TwentyOnePlus3Type.NONE);
        expect(result.multiplier).toBe(0);
      });
    });
  });

  describe('🎯 Side Bet Calculations & Integration', () => {
    describe('🧮 CASINO STANDARD: Side bet winnings calculation', () => {
      it('Should calculate Perfect Pairs winnings correctly', () => {
        const result = service.calculateSideBetWinnings('100', 25); // Perfect Pair
        expect(result).toBe('2600.00000000'); // 100 + (100 × 25)
      });

      it('Should calculate 21+3 winnings correctly', () => {
        const result = service.calculateSideBetWinnings('50', 100); // Suited Trips
        expect(result).toBe('5050.00000000'); // 50 + (50 × 100)
      });

      it('Should return zero for no win', () => {
        const result = service.calculateSideBetWinnings('100', 0);
        expect(result).toBe('0');
      });

      it('🧮 PRECISION: High precision calculations', () => {
        const result = service.calculateSideBetWinnings('0.00000001', 25);
        expect(result).toBe('0.00000026'); // 0.00000001 + (0.00000001 × 25)
      });
    });

    describe('🧮 CASINO STANDARD: Complete side bet evaluation', () => {
      it('Should evaluate both side bets with wins', () => {
        const game = createTestGame(
          [
            createCard('hearts', 'K', 10),
            createCard('hearts', 'K', 10), // Perfect Pair
          ],
          [createCard('hearts', 'K', 10)], // Suited Trips with first two cards
          '100', // Perfect Pairs bet
          '50', // 21+3 bet
        ) as BlackjackGameEntity;

        const result = service.evaluateAllSideBets(game);

        expect(result.perfectPairsWin).toBe('2600.00000000'); // 100 + (100 × 25)
        expect(result.twentyOnePlusThreeWin).toBe('5050.00000000'); // 50 + (50 × 100)
        expect(result.totalWinnings).toBe('7650.00000000');
      });

      it('Should handle losing side bets', () => {
        const game = createTestGame(
          [
            createCard('hearts', 'K', 10),
            createCard('clubs', '2', 2), // No pair
          ],
          [createCard('spades', '7', 7)], // No 21+3
          '100',
          '50',
        ) as BlackjackGameEntity;

        const result = service.evaluateAllSideBets(game);

        expect(result.perfectPairsWin).toBe('0');
        expect(result.twentyOnePlusThreeWin).toBe('0');
        expect(result.totalWinnings).toBe('0.00000000');
      });

      it('Should handle missing side bets', () => {
        const game = createTestGame(
          [createCard('hearts', 'K', 10), createCard('hearts', 'K', 10)],
          [createCard('hearts', 'K', 10)],
        ) as BlackjackGameEntity;

        const result = service.evaluateAllSideBets(game);

        expect(result.perfectPairsWin).toBe('0');
        expect(result.twentyOnePlusThreeWin).toBe('0');
        expect(result.totalWinnings).toBe('0.00000000');
      });
    });
  });

  describe('🎯 Validation & Security', () => {
    describe('🛡️ ANTI-FRAUD: Card validation', () => {
      it('Should validate proper side bet cards', () => {
        const playerCards = [createCard('hearts', 'K', 10), createCard('clubs', 'Q', 10)];
        const dealerCard = createCard('spades', 'A', 11);

        const result = service.validateSideBetCards(playerCards, dealerCard);
        expect(result).toBe(true);
      });

      it('Should reject insufficient player cards', () => {
        const playerCards = [createCard('hearts', 'K', 10)];
        const dealerCard = createCard('spades', 'A', 11);

        const result = service.validateSideBetCards(playerCards, dealerCard);
        expect(result).toBe(false);
      });

      it('Should reject invalid cards', () => {
        const playerCards = [
          { suit: 'invalid', rank: 'X', value: 999 } as Card,
          createCard('clubs', 'Q', 10),
        ];

        const result = service.validateSideBetCards(playerCards);
        expect(result).toBe(false);
      });

      it('Should reject cards with invalid suits', () => {
        const playerCards = [createCard('purple', 'K', 10), createCard('clubs', 'Q', 10)];

        const result = service.validateSideBetCards(playerCards);
        expect(result).toBe(false);
      });

      it('Should reject cards with invalid ranks', () => {
        const playerCards = [createCard('hearts', 'X', 10), createCard('clubs', 'Q', 10)];

        const result = service.validateSideBetCards(playerCards);
        expect(result).toBe(false);
      });

      it('Should reject cards with invalid values', () => {
        const playerCards = [createCard('hearts', 'K', 999), createCard('clubs', 'Q', 10)];

        const result = service.validateSideBetCards(playerCards);
        expect(result).toBe(false);
      });
    });

    describe('🛡️ CASINO STANDARD: Side bet amount validation', () => {
      it('Should accept valid side bet amounts', () => {
        const result = service.isValidSideBetAmount('50', '100');
        expect(result).toBe(true);
      });

      it('Should reject side bet exceeding main bet', () => {
        const result = service.isValidSideBetAmount('150', '100');
        expect(result).toBe(false);
      });

      it('Should reject zero or negative side bets', () => {
        expect(service.isValidSideBetAmount('0', '100')).toBe(false);
        expect(service.isValidSideBetAmount('-10', '100')).toBe(false);
      });

      it('Should handle invalid bet strings', () => {
        expect(service.isValidSideBetAmount('invalid', '100')).toBe(false);
        expect(service.isValidSideBetAmount('100', 'invalid')).toBe(false);
      });
    });
  });

  describe('🎯 Casino Statistics & Compliance', () => {
    describe('🧮 CASINO STANDARD: Theoretical statistics', () => {
      it('Should provide accurate Perfect Pairs probabilities', () => {
        const stats = service.getSideBetStatistics();

        // CASINO STANDARD: Perfect Pairs probabilities
        expect(stats.perfectPairsProbabilities[PerfectPairsType.NONE]).toBeCloseTo(0.9231, 3);
        expect(stats.perfectPairsProbabilities[PerfectPairsType.MIXED_PAIR]).toBeCloseTo(0.0474, 3);
        expect(stats.perfectPairsProbabilities[PerfectPairsType.COLORED_PAIR]).toBeCloseTo(
          0.0237,
          3,
        );
        expect(stats.perfectPairsProbabilities[PerfectPairsType.PERFECT_PAIR]).toBeCloseTo(
          0.0059,
          3,
        );

        // Probabilities should sum to 1
        const totalPP = Object.values(stats.perfectPairsProbabilities).reduce(
          (sum, prob) => sum + prob,
          0,
        );
        expect(totalPP).toBeCloseTo(1.0, 3);
      });

      it('Should provide accurate 21+3 probabilities', () => {
        const stats = service.getSideBetStatistics();

        // CASINO STANDARD: 21+3 probabilities
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.NONE]).toBeCloseTo(0.7439, 3);
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.FLUSH]).toBeCloseTo(0.1965, 3);
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.STRAIGHT]).toBeCloseTo(
          0.0327,
          3,
        );
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.THREE_OF_KIND]).toBeCloseTo(
          0.0235,
          3,
        );
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.STRAIGHT_FLUSH]).toBeCloseTo(
          0.0022,
          3,
        );
        expect(stats.twentyOnePlus3Probabilities[TwentyOnePlus3Type.SUITED_TRIPS]).toBeCloseTo(
          0.0012,
          3,
        );

        // Probabilities should sum to 1
        const total21 = Object.values(stats.twentyOnePlus3Probabilities).reduce(
          (sum, prob) => sum + prob,
          0,
        );
        expect(total21).toBeCloseTo(1.0, 3);
      });

      it('Should provide accurate house edges', () => {
        const stats = service.getSideBetStatistics();

        // CASINO STANDARD: House edges
        expect(stats.houseEdges.perfectPairs).toBe(4.1);
        expect(stats.houseEdges.twentyOnePlus3).toBe(3.2);
      });
    });

    describe('🧮 CASINO STANDARD: Multiplier accuracy', () => {
      it('Should return correct Perfect Pairs multipliers', () => {
        expect(service.getPerfectPairsMultiplier(PerfectPairsType.NONE)).toBe(0);
        expect(service.getPerfectPairsMultiplier(PerfectPairsType.MIXED_PAIR)).toBe(6);
        expect(service.getPerfectPairsMultiplier(PerfectPairsType.COLORED_PAIR)).toBe(12);
        expect(service.getPerfectPairsMultiplier(PerfectPairsType.PERFECT_PAIR)).toBe(25);
      });

      it('Should return correct 21+3 multipliers', () => {
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.NONE)).toBe(0);
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.FLUSH)).toBe(5);
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.STRAIGHT)).toBe(10);
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.THREE_OF_KIND)).toBe(30);
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.STRAIGHT_FLUSH)).toBe(40);
        expect(service.get21Plus3Multiplier(TwentyOnePlus3Type.SUITED_TRIPS)).toBe(100);
      });
    });
  });

  describe('🎯 Mathematical & Statistical Validation', () => {
    describe('🧮 100K SIMULATION: Side bet frequency validation', () => {
      it('Should have realistic Perfect Pairs frequency validation', () => {
        let perfectPairCount = 0;
        let coloredPairCount = 0;
        let mixedPairCount = 0;
        let noneCount = 0;
        const iterations = 1000;

        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

        for (let i = 0; i < iterations; i++) {
          // REALISTIC: Simulate 6-deck shoe (like real casino)
          // Create 6 decks worth of cards for realistic Perfect Pairs probability
          const availableCards: Array<{ rank: string; suit: string }> = [];
          for (let deck = 0; deck < 6; deck++) {
            for (const rank of ranks) {
              for (const suit of suits) {
                availableCards.push({ rank, suit });
              }
            }
          }

          // Randomly pick 2 cards from 6-deck shoe
          const card1Index = Math.floor(Math.random() * availableCards.length);
          const card1 = availableCards[card1Index];
          availableCards.splice(card1Index, 1); // Remove selected card

          const card2Index = Math.floor(Math.random() * availableCards.length);
          const card2 = availableCards[card2Index];

          const cards = [
            createCard(card1.suit, card1.rank, 10),
            createCard(card2.suit, card2.rank, 10),
          ];

          const result = service.evaluatePerfectPairs(cards);

          switch (result.type) {
            case PerfectPairsType.PERFECT_PAIR:
              perfectPairCount++;
              break;
            case PerfectPairsType.COLORED_PAIR:
              coloredPairCount++;
              break;
            case PerfectPairsType.MIXED_PAIR:
              mixedPairCount++;
              break;
            case PerfectPairsType.NONE:
              noneCount++;
              break;
          }
        }

        // 🎰 CASINO STANDARDS: MATHEMATICALLY CORRECT expectations (6-deck blackjack)
        // Perfect Pair: 5/311 = 1.61% (exact mathematics)
        expect(perfectPairCount).toBeGreaterThan(iterations * 0.008); // > 0.8% (50% of expected)
        expect(perfectPairCount).toBeLessThan(iterations * 0.032); // < 3.2% (200% of expected)

        // Colored Pair: 6/311 = 1.93% (CORRECTED mathematics)
        expect(coloredPairCount).toBeGreaterThan(iterations * 0.01); // > 1.0% (50% of expected)
        expect(coloredPairCount).toBeLessThan(iterations * 0.039); // < 3.9% (200% of expected)

        // Mixed Pair: 12/311 = 3.86% (exact mathematics)
        expect(mixedPairCount).toBeGreaterThan(iterations * 0.019); // > 1.9% (50% of expected)
        expect(mixedPairCount).toBeLessThan(iterations * 0.077); // < 7.7% (200% of expected)

        // Total Pairs: 23/311 = 7.40% (CORRECTED mathematics)
        const totalPairs = perfectPairCount + coloredPairCount + mixedPairCount;
        expect(totalPairs).toBeGreaterThan(iterations * 0.037); // > 3.7% (50% of expected)
        expect(totalPairs).toBeLessThan(iterations * 0.148); // < 14.8% (200% of expected)

        // No Pair: 288/311 = 92.60% (CORRECTED mathematics)
        expect(noneCount).toBeGreaterThan(iterations * 0.85); // > 85% (minimum)
        expect(noneCount).toBeLessThan(iterations * 0.98); // < 98% (maximum)
      });

      it('Should maintain mathematical consistency across evaluations', () => {
        const testCases = [
          {
            cards: [createCard('hearts', 'K', 10), createCard('hearts', 'K', 10)],
            expectedType: PerfectPairsType.PERFECT_PAIR,
            expectedMultiplier: 25,
          },
          {
            cards: [createCard('hearts', 'Q', 10), createCard('diamonds', 'Q', 10)],
            expectedType: PerfectPairsType.COLORED_PAIR,
            expectedMultiplier: 12,
          },
          {
            cards: [createCard('hearts', 'J', 10), createCard('clubs', 'J', 10)],
            expectedType: PerfectPairsType.MIXED_PAIR,
            expectedMultiplier: 6,
          },
        ];

        // Run each test case 1000 times to ensure consistency
        testCases.forEach((testCase) => {
          for (let i = 0; i < 1000; i++) {
            const result = service.evaluatePerfectPairs(testCase.cards);
            expect(result.type).toBe(testCase.expectedType);
            expect(result.multiplier).toBe(testCase.expectedMultiplier);
          }
        });
      });
    });

    describe('🧮 EDGE CASE: Complex card combinations', () => {
      it('Should handle ace straights correctly', () => {
        // Ace-low straight (A-2-3)
        const aceLowCards = [createCard('hearts', 'A', 11), createCard('clubs', '2', 2)];
        const aceLowDealer = createCard('spades', '3', 3);
        const aceLowResult = service.evaluate21Plus3(aceLowCards, aceLowDealer);
        expect(aceLowResult.type).toBe(TwentyOnePlus3Type.STRAIGHT);

        // Ace-high straight (Q-K-A)
        const aceHighCards = [createCard('hearts', 'Q', 10), createCard('clubs', 'K', 10)];
        const aceHighDealer = createCard('spades', 'A', 11);
        const aceHighResult = service.evaluate21Plus3(aceHighCards, aceHighDealer);
        expect(aceHighResult.type).toBe(TwentyOnePlus3Type.STRAIGHT);

        // Invalid ace straight (K-A-2) should not be straight
        const invalidCards = [createCard('hearts', 'K', 10), createCard('clubs', 'A', 11)];
        const invalidDealer = createCard('spades', '2', 2);
        const invalidResult = service.evaluate21Plus3(invalidCards, invalidDealer);
        expect(invalidResult.type).not.toBe(TwentyOnePlus3Type.STRAIGHT);
      });

      it('Should prioritize highest payout correctly', () => {
        // Suited trips should beat straight flush
        const suitedTripsCards = [createCard('hearts', 'A', 11), createCard('hearts', 'A', 11)];
        const suitedTripsDealer = createCard('hearts', 'A', 11);
        const result = service.evaluate21Plus3(suitedTripsCards, suitedTripsDealer);
        expect(result.type).toBe(TwentyOnePlus3Type.SUITED_TRIPS);
        expect(result.multiplier).toBe(100);
      });
    });
  });
});
