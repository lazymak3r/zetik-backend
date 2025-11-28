import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('affiliate_wallets', { schema: DATABASE_SCHEMAS.AFFILIATE })
@Index(['userId', 'asset'], { unique: true })
@Index(['userId'])
export class AffiliateWalletEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @PrimaryColumn({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: '0' })
  totalEarned!: string;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: '0' })
  totalClaimed!: string;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: '0' })
  balance!: string;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: '0' })
  wagered!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
