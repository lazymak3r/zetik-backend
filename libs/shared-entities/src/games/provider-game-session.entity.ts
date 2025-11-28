import { CurrencyEnum } from '@zetik/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { ProviderGameEntity } from './provider-game.entity';

export enum ProviderGameStatusEnum {
  PENDING = 'PENDING',
  STARTED = 'STARTED',
}

@Entity('provider_game_sessions', { schema: DATABASE_SCHEMAS.GAMES })
export class ProviderGameSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column()
  gameCode!: string;

  @ManyToOne(() => ProviderGameEntity)
  @JoinColumn({ name: 'code' })
  game!: ProviderGameEntity;

  @Column({ type: 'enum', enum: ProviderGameStatusEnum, default: ProviderGameStatusEnum.PENDING })
  status!: ProviderGameStatusEnum;

  @Column({
    type: 'enum',
    enum: CurrencyEnum,
  })
  currency!: CurrencyEnum;

  @Column('decimal', { precision: 36, scale: 18, default: '0' })
  betAmount!: string;

  @Column('decimal', { precision: 36, scale: 18, default: '0' })
  winAmount!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
