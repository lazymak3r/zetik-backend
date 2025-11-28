import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { BalanceHistoryStatusEnum } from './enums/balance-history-status.enum';
import { BalanceOperationEnum } from './enums/balance-operation.enum';

@Entity('balance_history', { schema: DATABASE_SCHEMAS.BALANCE })
@Index(['userId', 'createdAt'])
@Index(['userId', 'operation'])
@Index(['userId', 'operation', 'createdAt'])
export class BalanceHistoryEntity {
  @PrimaryColumn('varchar')
  operationId!: string;

  @PrimaryColumn({ type: 'varchar', enum: BalanceOperationEnum })
  operation!: BalanceOperationEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  asset!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  rate!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  amountCents!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  previousBalance!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    enum: BalanceHistoryStatusEnum,
    default: BalanceHistoryStatusEnum.CONFIRMED,
  })
  status!: BalanceHistoryStatusEnum;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'House edge percentage for bet operations',
  })
  houseEdge?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
