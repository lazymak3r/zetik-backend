import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { AdminRole } from './admin-role.enum';

@Entity({ name: 'admin_users', schema: DATABASE_SCHEMAS.ADMIN })
export class AdminEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column({ select: false })
  password!: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.ADMIN })
  role!: AdminRole;

  @Column({ type: 'uuid', nullable: true, unique: true })
  userId?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 1 })
  tokenVersion!: number;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: Record<string, boolean>;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ nullable: true })
  lastLoginIp?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
