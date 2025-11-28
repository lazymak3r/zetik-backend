import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { BonusTransactionStatusEnum } from './enums/bonus-transaction-status.enum';
import { BonusTypeEnum } from './enums/bonus-type.enum';

@Entity({ name: 'bonuses_transactions', schema: DATABASE_SCHEMAS.BONUS })
export class BonusTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: BonusTransactionStatusEnum,
    default: BonusTransactionStatusEnum.PENDING,
  })
  status!: BonusTransactionStatusEnum;

  @Column({ type: 'uuid', comment: 'User ID who received the bonus' })
  userId!: string;

  @Column({ type: 'varchar', length: 50, comment: 'Type of bonus awarded' })
  bonusType!: BonusTypeEnum;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    comment: 'Amount of the bonus awarded in cents',
  })
  amount!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'smallint',
    nullable: true,
    comment: 'VIP Tier level related to this bonus (e.g. for LevelUp)',
  })
  relatedVipTierLevel?: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional metadata: cancellation reason, investigation data, etc.',
  })
  metadata?: Record<string, any>;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Activation date; if null, provide anytime',
  })
  activateAt?: Date;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'User who last modified this transaction (claimant or canceling admin)',
  })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiredAt?: Date;
}
