import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { AssetTypeEnum } from './enums/asset-type.enum';
import { VaultDirectionEnum } from './enums/vault-direction.enum';

@Entity('vault_history', { schema: DATABASE_SCHEMAS.BALANCE })
@Index(['userId', 'asset', 'createdAt'])
export class BalanceVaultHistoryEntity {
  @PrimaryColumn('uuid')
  operationId!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'enum', enum: VaultDirectionEnum })
  direction!: VaultDirectionEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: '0' })
  amount!: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: '0' })
  previousVaultBalance!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}
