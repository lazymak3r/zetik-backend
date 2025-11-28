import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminEntity } from '../admin/admin.entity';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { PromocodeStatusEnum } from '../bonus/enums/promocode-status.enum';
import { PromocodeAuditEntity } from '../bonus/promocode-audit.entity';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { PromocodeClaimEntity } from './promocode-claim.entity';

@Entity({ name: 'promocodes', schema: DATABASE_SCHEMAS.PROMOCODES })
@Index(['code'], { unique: true })
@Index(['status'])
export class PromocodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'uuid', name: 'created_by_admin_id' })
  createdByAdminId!: string;

  @ManyToOne(() => AdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_admin_id' })
  createdByAdmin?: AdminEntity;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'value_per_claim' })
  valuePerClaim!: string;

  @Column({ type: 'int', name: 'total_claims' })
  totalClaims!: number;

  @Column({ type: 'int', name: 'claimed_count', default: 0 })
  claimedCount!: number;

  @Column({ type: 'enum', enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @Column({ type: 'timestamp', name: 'starts_at' })
  startsAt!: Date;

  @Column({ type: 'timestamp', name: 'ends_at' })
  endsAt!: Date;

  @Column({ type: 'enum', enum: PromocodeStatusEnum, default: PromocodeStatusEnum.ACTIVE })
  status!: PromocodeStatusEnum;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'jsonb', name: 'eligibility_rules' })
  eligibilityRules!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PromocodeClaimEntity, (claim) => claim.promocode)
  claims?: PromocodeClaimEntity[];

  @OneToMany(() => PromocodeAuditEntity, (audit) => audit.promocode)
  auditLogs?: PromocodeAuditEntity[];
}
