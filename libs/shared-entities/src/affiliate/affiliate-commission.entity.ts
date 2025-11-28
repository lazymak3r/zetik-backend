import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('affiliate_commissions', { schema: DATABASE_SCHEMAS.AFFILIATE })
export class AffiliateCommissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  campaignId!: string;

  @Index()
  @Column('uuid')
  campaignOwnerId!: string;

  @Index()
  @Column('uuid')
  referredUserId!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  amount!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  depositAmount!: string;

  @Column({ type: 'varchar', length: 10 })
  asset!: AssetTypeEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  rate!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  amountCents!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  depositAmountCents!: string;

  @Column({ type: 'varchar' })
  operationId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
