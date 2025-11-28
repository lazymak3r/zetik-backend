import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum TransactionTypeEnum {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}

@Entity('transactions', { schema: DATABASE_SCHEMAS.PAYMENTS })
export class TransactionEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'enum', enum: TransactionTypeEnum })
  type!: TransactionTypeEnum;

  @Column({
    type: 'enum',
    enum: TransactionStatusEnum,
    default: TransactionStatusEnum.PENDING,
  })
  status!: TransactionStatusEnum;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount!: string;

  @Column({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ nullable: true })
  address?: string;

  @Column({ default: false })
  isCredited!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  creditedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  fbCreatedAt?: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  amountUSD?: string | null = null;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  networkFee?: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  txHash?: string | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
