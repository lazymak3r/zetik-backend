import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { AssetTypeEnum } from './enums/asset-type.enum';

@Entity('wallets', { schema: DATABASE_SCHEMAS.BALANCE })
@Index(['userId', 'asset'], { unique: true })
export class BalanceWalletEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @PrimaryColumn({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: '0' })
  balance!: string;

  @Column({ default: false })
  isPrimary!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
