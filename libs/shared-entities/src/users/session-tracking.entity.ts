import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from './users.entity';

@Entity('session_tracking', { schema: DATABASE_SCHEMAS.USERS })
@Index(['userId', 'lastActivityAt'])
@Index(['lastActivityAt'])
@Index(['tokenHash'])
export class SessionTrackingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo?: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'timestamp' })
  lastActivityAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
