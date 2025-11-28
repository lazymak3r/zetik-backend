import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminEntity } from '../admin/admin.entity';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { PromocodeEntity } from '../promocodes/promocode.entity';
import { PromocodeAuditActionEnum } from './enums/promocode-audit-action.enum';

@Entity({ name: 'promocode_audit', schema: DATABASE_SCHEMAS.PROMOCODES })
@Index(['promocodeId'])
export class PromocodeAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'promocode_id' })
  promocodeId!: string;

  @ManyToOne(() => PromocodeEntity, (promocode) => promocode.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promocode_id' })
  promocode?: PromocodeEntity;

  @Column({ type: 'uuid', name: 'admin_id' })
  adminId!: string;

  @ManyToOne(() => AdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin?: AdminEntity;

  @Column({ type: 'enum', enum: PromocodeAuditActionEnum })
  action!: PromocodeAuditActionEnum;

  @Column({ type: 'jsonb', nullable: true, name: 'previous_values' })
  previousValues?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
