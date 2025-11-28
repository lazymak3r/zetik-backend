import { GameTypeEnum } from '@zetik/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { GameResultEntity } from './game-result.entity';

export enum GameStatusEnum {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('game_sessions', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'gameType', 'status'])
@Index(['gameType', 'status', 'createdAt'])
@Index(['userId', 'gameType', 'status', 'createdAt'])
@Index(['userId', 'completedAt', 'createdAt'])
@Index(['asset', 'betAmount'])
export class GameSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: GameTypeEnum,
  })
  gameType!: GameTypeEnum;

  @Column({
    type: 'enum',
    enum: GameStatusEnum,
    default: GameStatusEnum.PENDING,
  })
  status!: GameStatusEnum;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
  })
  asset!: AssetTypeEnum;

  @Column('decimal', { precision: 36, scale: 18 })
  betAmount!: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  winAmount?: string;

  @Column({ length: 64 })
  serverSeed!: string;

  @Column({ length: 64, nullable: true })
  clientSeed?: string;

  @Column({ type: 'bigint' })
  nonce!: string;

  @Column({ type: 'json', nullable: true })
  gameConfig?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  gameState?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  result?: Record<string, any>;

  @OneToMany(() => GameResultEntity, (result) => result.gameSession)
  gameResults!: GameResultEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  completedAt?: Date;
}
