import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('slot_images', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['directory'])
@Index(['key'], { unique: true })
export class SlotImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  directory!: string;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 512, unique: true })
  key!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({ type: 'varchar', length: 255 })
  uploadedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
