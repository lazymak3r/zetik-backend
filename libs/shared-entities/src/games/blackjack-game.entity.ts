import { CurrencyEnum } from '@zetik/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';

export interface Card {
  suit: string;
  rank: string;
  value: number;
}

export enum PerfectPairsType {
  NONE = 'none',
  MIXED_PAIR = 'mixed_pair', // Different colors (6:1)
  COLORED_PAIR = 'colored_pair', // Same color, different suits (12:1)
  PERFECT_PAIR = 'perfect_pair', // Same rank and suit (25:1)
}

export enum TwentyOnePlus3Type {
  NONE = 'none',
  FLUSH = 'flush', // Same suit (5:1)
  STRAIGHT = 'straight', // Sequential ranks (10:1)
  THREE_OF_KIND = 'three_of_kind', // Same rank (30:1)
  STRAIGHT_FLUSH = 'straight_flush', // Sequential + same suit (40:1)
  SUITED_TRIPS = 'suited_trips', // Same rank + same suit (100:1)
}

export interface PerfectPairsResult {
  type: PerfectPairsType;
  multiplier: number;
}

export interface TwentyOnePlus3Result {
  type: TwentyOnePlus3Type;
  multiplier: number;
}

// New interface for describing payout ratios
export interface BlackjackPayoutRatio {
  main?: string; // Main hand: "3:2", "1:1", "1:0"
  split?: string; // Split hand: "3:2", "1:1", "1:0"
  perfectPairs?: string; // Perfect Pairs: "6:1", "12:1", "25:1"
  twentyOnePlusThree?: string; // 21+3: "5:1", "10:1", "30:1", "40:1", "100:1"
  insurance?: string; // Insurance: "2:1"
}

export enum BlackjackGameStatus {
  ACTIVE = 'active',
  PLAYER_STAND = 'player_stand',
  DEALER_TURN = 'dealer_turn',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum BlackjackAction {
  HIT = 'hit',
  STAND = 'stand',
  DOUBLE = 'double',
  SPLIT = 'split',
  INSURANCE = 'insurance',
  NO_INSURANCE = 'no_insurance',
  HIT_SPLIT = 'hit_split',
  STAND_SPLIT = 'stand_split',
  DOUBLE_SPLIT = 'double_split',
}

export enum HandStatus {
  ACTIVE = 'active',
  STAND = 'stand',
  BUST = 'bust',
  BLACKJACK = 'blackjack',
  COMPLETED = 'completed',
}

@Entity({ name: 'blackjack_games', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'status'])
@Index(['gameSessionId'])
export class BlackjackGameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ nullable: true })
  gameSessionId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  betAmount!: string;

  // Track total amount actually charged to user (including splits and doubles)
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  totalBetAmount?: string;

  // Track total winnings credited across all bet types (main/split + side bets + insurance)
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true, default: '0' })
  totalWinAmount?: string;

  @Column({ default: 'USDT' })
  asset!: string;

  @Column({
    type: 'enum',
    enum: BlackjackGameStatus,
    default: BlackjackGameStatus.ACTIVE,
  })
  status!: BlackjackGameStatus;

  @Column('jsonb')
  playerCards!: Card[];

  @Column('jsonb')
  dealerCards!: Card[];

  // INFINITE DECK MODEL: Track cursor position instead of storing deck
  @Column({ type: 'int', default: 0 })
  cardCursor!: number;

  // Split hand support
  @Column('jsonb', { nullable: true })
  splitCards?: Card[];

  @Column({ type: 'int', default: 0 })
  playerScore!: number;

  @Column({ type: 'int', default: 0 })
  dealerScore!: number;

  @Column({ type: 'int', default: 0 })
  playerSoftScore!: number;

  @Column({ type: 'int', default: 0 })
  dealerSoftScore!: number;

  // Split hand scoring
  @Column({ type: 'int', default: 0 })
  splitScore!: number;

  @Column({ type: 'int', default: 0 })
  splitSoftScore!: number;

  @Column({ default: false })
  isDoubleDown!: boolean;

  @Column({ default: false })
  isSplitDoubleDown!: boolean;

  @Column({ default: false })
  isInsurance!: boolean;

  @Column({ default: false })
  isInsuranceRejected!: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  insuranceBet?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  insuranceWin?: string;

  // Split game state
  @Column({ default: false })
  isSplit!: boolean;

  // Track if this is a split aces game (special rule: 1 card only, no further actions)
  @Column({ default: false })
  isSplitAces!: boolean;

  @Column({
    type: 'enum',
    enum: HandStatus,
    default: HandStatus.ACTIVE,
  })
  playerHandStatus!: HandStatus;

  @Column({
    type: 'enum',
    enum: HandStatus,
    default: HandStatus.ACTIVE,
    nullable: true,
  })
  splitHandStatus?: HandStatus;

  @Column({ default: 'main' })
  activeHand!: string; // 'main' | 'split'

  // Side bets fields
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  perfectPairsBet?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  twentyOnePlusThreeBet?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  perfectPairsWin?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  twentyOnePlusThreeWin?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  winAmount?: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: '2.00' })
  payoutMultiplier!: string;

  // Split hand winnings
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  splitWinAmount?: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: '2.00' })
  splitPayoutMultiplier!: string;

  @Column()
  serverSeed!: string;

  @Column()
  serverSeedHash!: string;

  @Column()
  clientSeed!: string;

  @Column({ type: 'bigint', default: '1' })
  nonce!: string;

  @Column('jsonb', { nullable: true })
  gameHistory?: any[];

  // Fiat currency preservation fields for display consistency
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  originalFiatAmount?: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  originalFiatCurrency?: CurrencyEnum;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  fiatToUsdRate?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
