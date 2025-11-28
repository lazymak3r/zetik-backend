import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum GameType {
  BLACKJACK = 'blackjack',
  CRASH = 'crash',
  DICE = 'dice',
  KENO = 'keno',
  LIMBO = 'limbo',
  MINES = 'mines',
  PLINKO = 'plinko',
  ROULETTE = 'roulette',
  SLOTS = 'slots',
}

export enum GameStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance',
}

/**
 * Simplified game config - only contains basic status and description.
 * All game logic (multipliers, timeouts, etc.) is now hardcoded in game services.
 */

@Entity('game_configs', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['gameType'], { unique: true })
@Index(['status'])
export class GameConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: GameType,
    unique: true,
  })
  gameType!: GameType;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.ENABLED,
  })
  status!: GameStatus;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
