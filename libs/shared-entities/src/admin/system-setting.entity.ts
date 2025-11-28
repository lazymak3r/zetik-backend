import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('system_settings', { schema: DATABASE_SCHEMAS.ADMIN })
export class SystemSettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  key!: string;

  @Column('jsonb')
  value!: any;

  @Column({ nullable: true })
  description?: string;

  @Column()
  category!: string;

  @Column({ default: 'string' })
  type!: string; // 'string' | 'number' | 'boolean' | 'json'

  @Column({ default: false })
  isSecret!: boolean;

  @Column({ nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
