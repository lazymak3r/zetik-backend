import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';

export enum WithdrawStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('withdraw_requests', { schema: DATABASE_SCHEMAS.PAYMENTS })
@Index(['status'])
export class WithdrawRequestEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column()
  asset!: string;

  @Column('decimal', { precision: 36, scale: 18 })
  amount!: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  estimateNetworkFee?: string;

  @Column()
  toAddress!: string;

  @Column({
    type: 'enum',
    enum: WithdrawStatusEnum,
    default: WithdrawStatusEnum.PENDING,
  })
  status!: WithdrawStatusEnum;

  @Column({ type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  txId?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
