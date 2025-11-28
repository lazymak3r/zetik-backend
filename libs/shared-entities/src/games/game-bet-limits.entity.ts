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

/**
 * Simplified bet limits entity that only stores USD-based min/max bet amounts per game.
 * All other game logic (multipliers, etc.) is hardcoded in game services.
 */

@Entity('game_bet_limits', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['gameType'], { unique: true })
@Index(['isActive'])
export class GameBetLimitsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: GameType,
    unique: true,
  })
  gameType!: GameType;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // USD-based bet limits
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  minBetUsd!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  maxBetUsd!: number;

  // Maximum payout amount in USD - auto cashout when exceeded
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 100000 })
  maxPayoutUsd!: number;

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
