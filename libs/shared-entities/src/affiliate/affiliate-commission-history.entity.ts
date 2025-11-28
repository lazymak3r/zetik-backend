import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { AffiliateCommissionOperationEnum } from './enums/affiliate-commission-operation.enum';

@Entity('affiliate_commission_history', { schema: DATABASE_SCHEMAS.AFFILIATE })
@Index(['userId'])
@Index(['campaignId'])
@Index(['createdAt'])
@Index(['balanceOperationId'], { unique: true, where: '"balanceOperationId" IS NOT NULL' })
export class AffiliateCommissionHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid', { nullable: true })
  campaignId?: string;

  @Column({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'decimal', precision: 25, scale: 10 })
  amount!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  amountCents!: string;

  @Column({ type: 'enum', enum: AffiliateCommissionOperationEnum })
  operation!: AffiliateCommissionOperationEnum;

  @Column('uuid', { nullable: true })
  balanceOperationId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
