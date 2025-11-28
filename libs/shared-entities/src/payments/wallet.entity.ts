import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('wallets', { schema: DATABASE_SCHEMAS.PAYMENTS })
@Index(['vaultId'])
export class WalletEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ nullable: true, type: 'varchar' })
  vaultId?: string | null = null; // Store the Fireblocks vault account ID

  @Column({ type: 'jsonb', default: {} })
  addresses!: Record<string, string>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
