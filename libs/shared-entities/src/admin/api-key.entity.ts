import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('api_keys', { schema: DATABASE_SCHEMAS.ADMIN })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  key!: string;

  @Column('text', { array: true })
  permissions!: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
