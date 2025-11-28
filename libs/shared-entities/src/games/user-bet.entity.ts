import { CurrencyEnum, GameTypeEnum } from '@zetik/common';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

// Game display names mapping
export const GAME_DISPLAY_NAMES: Record<GameTypeEnum, string> = {
  [GameTypeEnum.CRASH]: 'Crash',
  [GameTypeEnum.DICE]: 'Dice',
  [GameTypeEnum.MINES]: 'Mines',
  [GameTypeEnum.BLACKJACK]: 'Blackjack',
  [GameTypeEnum.ROULETTE]: 'Roulette',
  [GameTypeEnum.PLINKO]: 'Plinko',
  [GameTypeEnum.LIMBO]: 'Limbo',
  [GameTypeEnum.KENO]: 'Keno',
  [GameTypeEnum.PROVIDER]: 'Provider Game',
  [GameTypeEnum.SPORTSBOOK]: 'Sportsbook',
};

@Entity({ name: 'user_bets', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'createdAt'])
@Index(['game', 'createdAt'])
export class UserBetEntity {
  @PrimaryColumn('varchar', { length: 50 })
  game!: GameTypeEnum;

  @Column('varchar', { length: 50, nullable: true })
  gameName?: string;

  @PrimaryColumn('uuid')
  betId!: string;

  @Column('uuid')
  userId!: string;

  @Column('decimal', { precision: 20, scale: 8 })
  betAmount!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
  })
  asset!: AssetTypeEnum;

  @Column('decimal', { precision: 10, scale: 4 })
  multiplier!: string;

  @Column('decimal', { precision: 20, scale: 8, default: '0' })
  payout!: string;

  // USD equivalent fields for weekly race tracking
  @Column('decimal', { precision: 20, scale: 4, default: '0' })
  betAmountUsd!: string;

  @Column('decimal', { precision: 20, scale: 4, default: '0' })
  payoutUsd!: string;

  // Fiat currency tracking for exact user input preservation
  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  originalFiatAmount?: string; // The exact fiat amount user entered (e.g., 3000.00)

  @Column({
    type: 'enum',
    enum: CurrencyEnum,
    nullable: true,
  })
  originalFiatCurrency?: CurrencyEnum; // The user's selected fiat currency (INR, EUR, etc.)

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  fiatToUsdRate?: string; // Exchange rate used at time of bet for exact recreation

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
