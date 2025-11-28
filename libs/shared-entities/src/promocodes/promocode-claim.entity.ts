import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { PromocodeEntity } from './promocode.entity';

@Entity({ name: 'promocode_claims', schema: DATABASE_SCHEMAS.PROMOCODES })
@Index(['promocodeId'])
@Index(['userId'])
@Index(['ipAddress'])
export class PromocodeClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'promocode_id' })
  promocodeId!: string;

  @ManyToOne(() => PromocodeEntity, (promocode) => promocode.claims, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promocode_id' })
  promocode?: PromocodeEntity;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount!: string;

  @Column({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'device_fingerprint' })
  deviceFingerprint?: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'uuid', name: 'balance_operation_id' })
  balanceOperationId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
