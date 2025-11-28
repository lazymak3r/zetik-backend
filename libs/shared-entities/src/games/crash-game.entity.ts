import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { CrashBetEntity } from './crash-bet.entity';

export enum CrashGameStatusEnum {
  WAITING = 'WAITING',
  STARTING = 'STARTING',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED',
  ENDED = 'ENDED',
}

@Entity('crash_games', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['status', 'createdAt'])
@Index(['status', 'nonce'])
export class CrashGameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: CrashGameStatusEnum,
    default: CrashGameStatusEnum.WAITING,
  })
  status!: CrashGameStatusEnum;

  @Column('decimal', { precision: 12, scale: 2 })
  crashPoint!: string;

  @Column({ length: 64 })
  serverSeed!: string;

  @Column({ length: 64 })
  serverSeedHash!: string;

  @Column({ type: 'bigint' })
  nonce!: string;

  @Column({ type: 'integer', nullable: true })
  gameIndex?: number;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  crashedAt?: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @Column({ type: 'json', nullable: true })
  gameData?: {
    totalBets: number;
    totalBetAmount: string;
    totalWinAmount: string;
    maxMultiplier: string;
    playerCount: number;
  };

  @OneToMany(() => CrashBetEntity, (bet) => bet.crashGame)
  bets!: CrashBetEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
