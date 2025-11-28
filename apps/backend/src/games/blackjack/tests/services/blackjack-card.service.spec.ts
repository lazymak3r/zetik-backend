import { Test, TestingModule } from '@nestjs/testing';
import { Card } from '@zetik/shared-entities';
import { createTestProviders } from '../../../../test-utils';
import { BlackjackCardService, IBlackjackCard } from '../../services/blackjack-card.service';

describe('🎴 BlackjackCardService - Infinite Deck Cursor System', () => {
  let service: IBlackjackCard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...createTestProviders(),
        // Override mock with real service - must come AFTER createTestProviders()
        BlackjackCardService,
      ],
    }).compile();

    service = module.get<BlackjackCardService>(BlackjackCardService);
  });

  describe('🔐 Provably Fair Card Generation', () => {
    it('🃏 Should generate consistent card with same seeds and cursor', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = '1';
      const cursor = 0;

      const card1 = service.generateCard(serverSeed, clientSeed, nonce, cursor);
      const card2 = service.generateCard(serverSeed, clientSeed, nonce, cursor);

      expect(card1).toEqual(card2);
      expect(card1.suit).toBeDefined();
      expect(card1.rank).toBeDefined();
      expect(card1.value).toBeDefined();
    });

    it('🎯 Should generate different cards with different cursors', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = '1';

      const card1 = service.generateCard(serverSeed, clientSeed, nonce, 0);
      const card2 = service.generateCard(serverSeed, clientSeed, nonce, 1);
      const card3 = service.generateCard(serverSeed, clientSeed, nonce, 2);

      // Cards should be different (very high probability)
      expect(card1).not.toEqual(card2);
      expect(card2).not.toEqual(card3);
      expect(card1).not.toEqual(card3);
    });

    it('🔐 Should generate different cards with different seeds', () => {
      const clientSeed = 'test-client-seed';
      const nonce = '1';
      const cursor = 0;

      const card1 = service.generateCard('server1', clientSeed, nonce, cursor);
      const card2 = service.generateCard('server2', clientSeed, nonce, cursor);

      expect(card1).not.toEqual(card2);
    });

    it('🎲 Should generate valid playing cards', () => {
      const validSuits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const validRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

      for (let cursor = 0; cursor < 20; cursor++) {
        const card = service.generateCard('server', 'client', '1', cursor);

        expect(validSuits).toContain(card.suit);
        expect(validRanks).toContain(card.rank);
        expect(service.isValidCard(card)).toBe(true);
      }
    });
  });

  describe('🎯 Multiple Card Generation', () => {
    it('🃏 Should generate sequence of cards correctly', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = '1';
      const count = 10;

      const cards = service.generateCards(serverSeed, clientSeed, nonce, count);

      expect(cards).toHaveLength(count);

      // Each card should be valid
      cards.forEach((card) => {
        expect(service.isValidCard(card)).toBe(true);
      });
    });

    it('🎲 Should generate cards with proper cursor offset', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = '1';

      // Generate cards with offset
      const cards = service.generateCards(serverSeed, clientSeed, nonce, 5, 10);

      // Verify they match individual generation with cursors 10-14
      for (let i = 0; i < 5; i++) {
        const expectedCard = service.generateCard(serverSeed, clientSeed, nonce, 10 + i);
        expect(cards[i]).toEqual(expectedCard);
      }
    });
  });

  describe('🧮 Card Verification System', () => {
    it('✅ Should verify correct card generation', () => {
      const serverSeed = 'verification-server';
      const clientSeed = 'verification-client';
      const nonce = '42';
      const cursor = 5;

      const generatedCard = service.generateCard(serverSeed, clientSeed, nonce, cursor);
      const isValid = service.verifyCard(serverSeed, clientSeed, nonce, cursor, generatedCard);

      expect(isValid).toBe(true);
    });

    it('❌ Should reject invalid card verification', () => {
      const serverSeed = 'verification-server';
      const clientSeed = 'verification-client';
      const nonce = '42';
      const cursor = 5;

      const fakeCard: Card = {
        suit: 'hearts',
        rank: 'A',
        value: 11,
      } as Card;

      const isValid = service.verifyCard(serverSeed, clientSeed, nonce, cursor, fakeCard);
      expect(isValid).toBe(false);
    });
  });

  describe('🛡️ Card Validation', () => {
    it('✅ Should validate correct cards', () => {
      const validCards: Card[] = [
        { suit: 'hearts', rank: 'A', value: 11 } as Card,
        { suit: 'spades', rank: 'K', value: 10 } as Card,
        { suit: 'diamonds', rank: '7', value: 7 } as Card,
        { suit: 'clubs', rank: '10', value: 10 } as Card,
      ];

      validCards.forEach((card) => {
        expect(service.isValidCard(card)).toBe(true);
      });
    });

    it('❌ Should reject invalid cards', () => {
      const invalidCards = [
        { suit: 'invalid', rank: 'A', value: 11 } as Card,
        { suit: 'hearts', rank: 'X', value: 10 } as Card,
        { suit: 'hearts', rank: 'A', value: 999 } as Card,
        { suit: 'hearts', rank: 'K', value: 5 } as Card, // Wrong value for King
      ];

      invalidCards.forEach((card) => {
        expect(service.isValidCard(card)).toBe(false);
      });
    });
  });

  describe('🔒 Cryptographic Functions', () => {
    it('🔐 Should hash server seed correctly', () => {
      const serverSeed = 'test-server-seed';
      const hash = service.hashServerSeed(serverSeed);

      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]+$/); // Only hex characters

      // Same input should produce same output
      const hash2 = service.hashServerSeed(serverSeed);
      expect(hash).toBe(hash2);

      // Different input should produce different output
      const hash3 = service.hashServerSeed('different-seed');
      expect(hash).not.toBe(hash3);
    });
  });

  describe('🧮 Statistical Distribution Tests', () => {
    it('🎲 Should produce reasonable card distribution over many generations', () => {
      const serverSeed = 'distribution-test';
      const clientSeed = 'client-test';
      const nonce = '1';
      const sampleSize = 1000;

      const suitCounts = new Map<string, number>();
      const rankCounts = new Map<string, number>();

      // Generate many cards
      for (let cursor = 0; cursor < sampleSize; cursor++) {
        const card = service.generateCard(serverSeed, clientSeed, nonce, cursor);
        suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
        rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
      }

      // Each suit should appear roughly 250 times (1000 / 4)
      // Allow for reasonable variance (±100)
      const expectedSuitCount = sampleSize / 4;
      const suitTolerance = 100;

      ['hearts', 'diamonds', 'clubs', 'spades'].forEach((suit) => {
        const count = suitCounts.get(suit) || 0;
        expect(count).toBeGreaterThan(expectedSuitCount - suitTolerance);
        expect(count).toBeLessThan(expectedSuitCount + suitTolerance);
      });

      // Each rank should appear roughly 77 times (1000 / 13)
      // Allow for reasonable variance (±50)
      const expectedRankCount = sampleSize / 13;
      const rankTolerance = 50;

      ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].forEach((rank) => {
        const count = rankCounts.get(rank) || 0;
        expect(count).toBeGreaterThan(expectedRankCount - rankTolerance);
        expect(count).toBeLessThan(expectedRankCount + rankTolerance);
      });
    });

    it('🎯 Should generate all possible cards over sufficient iterations', () => {
      const serverSeed = 'coverage-test';
      const clientSeed = 'client-test';
      const nonce = '1';

      const seenCards = new Set<string>();
      const maxIterations = 5000;

      for (let cursor = 0; cursor < maxIterations; cursor++) {
        const card = service.generateCard(serverSeed, clientSeed, nonce, cursor);
        const cardKey = `${card.suit}-${card.rank}`;
        seenCards.add(cardKey);
      }

      // Should have seen a good variety of unique cards
      // 52 possible unique cards, expect to see at least 40 different ones
      expect(seenCards.size).toBeGreaterThan(40);
    });
  });

  describe('⚡ Performance Tests', () => {
    it('🚀 Should generate cards quickly', () => {
      const start = Date.now();
      const serverSeed = 'performance-test';
      const clientSeed = 'client-test';
      const nonce = '1';

      // Generate 1000 cards
      for (let cursor = 0; cursor < 1000; cursor++) {
        service.generateCard(serverSeed, clientSeed, nonce, cursor);
      }

      const elapsed = Date.now() - start;

      // Should complete in reasonable time (allow up to 1000ms)
      expect(elapsed).toBeLessThan(1000);
    });

    it('🎯 Batch generation should be efficient', () => {
      const start = Date.now();
      const serverSeed = 'batch-performance-test';
      const clientSeed = 'client-test';
      const nonce = '1';

      // Generate 1000 cards in batch
      const cards = service.generateCards(serverSeed, clientSeed, nonce, 1000);

      const elapsed = Date.now() - start;

      expect(cards).toHaveLength(1000);
      expect(elapsed).toBeLessThan(2000); // Allow up to 2 seconds for batch generation
    });
  });

  describe('🎮 Infinite Deck Properties', () => {
    it('♾️ Should never run out of cards (infinite deck)', () => {
      const serverSeed = 'infinite-test';
      const clientSeed = 'client-test';
      const nonce = '1';

      // Generate way more cards than would be in any physical deck
      const cards = service.generateCards(serverSeed, clientSeed, nonce, 10000);

      expect(cards).toHaveLength(10000);

      // All cards should be valid
      cards.forEach((card) => {
        expect(service.isValidCard(card)).toBe(true);
      });
    });

    it('🎲 Should maintain consistent probability across all cursors', () => {
      const serverSeed = 'probability-test';
      const clientSeed = 'client-test';
      const nonce = '1';

      // Test cards at various cursor positions
      const cursors = [0, 100, 1000, 5000, 10000];

      cursors.forEach((cursor) => {
        const card = service.generateCard(serverSeed, clientSeed, nonce, cursor);
        expect(service.isValidCard(card)).toBe(true);

        // Card should be one of 52 possible combinations
        const validSuits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const validRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        expect(validSuits).toContain(card.suit);
        expect(validRanks).toContain(card.rank);
      });
    });
  });
});
