import { Injectable } from '@nestjs/common';
import { Card } from '@zetik/shared-entities';
import * as crypto from 'crypto';

export interface IBlackjackCard {
  hashServerSeed(serverSeed: string): string;
  isValidCard(card: Card): boolean;
  // Infinite deck methods
  generateCard(serverSeed: string, clientSeed: string, nonce: string, cursor: number): Card;
  generateCards(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    count: number,
    startCursor?: number,
  ): Card[];
  verifyCard(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    cursor: number,
    expectedCard: Card,
  ): boolean;
}

@Injectable()
export class BlackjackCardService implements IBlackjackCard {
  /**
   * CASINO STANDARD: Hash server seed for client verification
   * Uses SHA-256 for one-way hash function
   */
  hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Validate if a card object is properly formed
   */
  isValidCard(card: Card): boolean {
    const validSuits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const validRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    if (!validSuits.includes(card.suit) || !validRanks.includes(card.rank)) {
      return false;
    }

    // Validate value matches rank
    const expectedValue = this.getCardValue(card.rank);
    return card.value === expectedValue;
  }

  /**
   * CASINO STANDARD: Get card value according to blackjack rules
   * A = 11, Face cards = 10, Numbers = face value
   */
  private getCardValue(rank: string): number {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank, 10);
  }

  /**
   * INFINITE DECK: Generate a single card using cursor-based provably fair method
   * Each card is independent and generated on-demand
   *
   * @param serverSeed - Casino generated seed
   * @param clientSeed - Player provided seed
   * @param nonce - Unique game identifier
   * @param cursor - Card index (0, 1, 2, ...)
   * @returns Single card
   */
  generateCard(serverSeed: string, clientSeed: string, nonce: string, cursor: number): Card {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Card['rank'][] = [
      'A',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      'J',
      'Q',
      'K',
    ];

    // Generate random value using HMAC with cursor
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:${cursor}`;
    hmac.update(data);
    const hash = hmac.digest('hex');

    // Convert first 8 characters to decimal
    const hexSubstring = hash.substring(0, 8);
    const decimalValue = parseInt(hexSubstring, 16);

    // Normalize to 0-1 range
    const normalizedValue = decimalValue / (0x100000000 - 1);

    // Map to card (0-51 range for 52 possible cards)
    const cardIndex = Math.floor(normalizedValue * 52);

    const suitIndex = Math.floor(cardIndex / 13);
    const rankIndex = cardIndex % 13;

    const suit = suits[suitIndex];
    const rank = ranks[rankIndex];
    const value = this.getCardValue(rank);

    return { suit, rank, value } as Card;
  }

  /**
   * INFINITE DECK: Generate multiple cards using cursor-based method
   *
   * @param serverSeed - Casino generated seed
   * @param clientSeed - Player provided seed
   * @param nonce - Unique game identifier
   * @param count - Number of cards to generate
   * @param startCursor - Starting cursor value (default 0)
   * @returns Array of cards
   */
  generateCards(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    count: number,
    startCursor: number = 0,
  ): Card[] {
    const cards: Card[] = [];

    for (let i = 0; i < count; i++) {
      const card = this.generateCard(serverSeed, clientSeed, nonce, startCursor + i);
      cards.push(card);
    }

    return cards;
  }

  /**
   * INFINITE DECK: Verify a generated card using the same algorithm
   *
   * @param serverSeed - Casino generated seed
   * @param clientSeed - Player provided seed
   * @param nonce - Unique game identifier
   * @param cursor - Card cursor
   * @param expectedCard - Card to verify
   * @returns true if card matches expected result
   */
  verifyCard(
    serverSeed: string,
    clientSeed: string,
    nonce: string,
    cursor: number,
    expectedCard: Card,
  ): boolean {
    const generatedCard = this.generateCard(serverSeed, clientSeed, nonce, cursor);

    return (
      generatedCard.suit === expectedCard.suit &&
      generatedCard.rank === expectedCard.rank &&
      generatedCard.value === expectedCard.value
    );
  }
}
