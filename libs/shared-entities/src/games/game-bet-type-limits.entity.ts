import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { GameType } from './game-config.entity';

export enum BetTypeCategory {
  // Roulette bet types
  ROULETTE_INSIDE = 'roulette_inside', // straight, split, street, corner, line
  ROULETTE_OUTSIDE = 'roulette_outside', // red/black, odd/even, dozens, columns

  // Blackjack bet types
  BLACKJACK_MAIN = 'blackjack_main', // main bet
  BLACKJACK_21_PLUS_3 = 'blackjack_21_plus_3', // 21+3 side bet
  BLACKJACK_PERFECT_PAIRS = 'blackjack_perfect_pairs', // Perfect Pairs side bet

  // Default for games without specific bet types
  DEFAULT = 'default',
}

@Entity('game_bet_type_limits', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['gameType', 'betTypeCategory'], { unique: true })
@Index(['gameType'])
@Index(['isActive'])
export class GameBetTypeLimitsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: GameType,
  })
  gameType!: GameType;

  @Column({
    type: 'enum',
    enum: BetTypeCategory,
  })
  betTypeCategory!: BetTypeCategory;

  @Column({ type: 'varchar', length: 100 })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minBetUsd!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maxBetUsd!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
