import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum AdminActionTypeEnum {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  VIEW_AFFILIATE_CAMPAIGNS = 'VIEW_AFFILIATE_CAMPAIGNS',
  VIEW_AFFILIATE_CAMPAIGN_DETAILS = 'VIEW_AFFILIATE_CAMPAIGN_DETAILS',
  DELETE_AFFILIATE_CAMPAIGN = 'DELETE_AFFILIATE_CAMPAIGN',
}

@Entity({ name: 'admin_audit_logs', schema: DATABASE_SCHEMAS.ADMIN })
export class AdminAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  adminId!: string;

  @Column()
  adminEmail!: string;

  @Column({ type: 'enum', enum: AdminActionTypeEnum })
  action!: AdminActionTypeEnum;

  @Column()
  resource!: string; // e.g., 'users', 'transactions', 'games'

  @Column({ nullable: true })
  resourceId?: string; // ID of the affected resource

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>; // Additional action details

  @Column({ type: 'jsonb', nullable: true })
  previousValues?: Record<string, any>; // For UPDATE actions

  @Column({ type: 'jsonb', nullable: true })
  newValues?: Record<string, any>; // For CREATE/UPDATE actions

  @Column()
  ipAddress!: string;

  @Column()
  userAgent!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
