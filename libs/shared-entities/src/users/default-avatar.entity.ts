import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'default_avatars', schema: DATABASE_SCHEMAS.USERS })
@Index(['isActive', 'displayOrder'])
export class DefaultAvatarEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  avatarUrl!: string;

  @Column({ type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ type: 'integer' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 50 })
  mimeType!: string;

  @Column({ type: 'integer', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
