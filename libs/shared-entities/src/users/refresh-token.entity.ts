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

/**
 * Entity for storing refresh tokens
 * Note: The '!' symbols after properties are TypeScript non-null assertion operators
 * They tell the TypeScript compiler that these properties will never be null or undefined
 * This is necessary due to strictNullChecks being enabled in tsconfig.json
 */
@Entity('refresh_tokens', { schema: DATABASE_SCHEMAS.USERS })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'text' })
  token!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column()
  @Index()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo?: string;

  @Column()
  lastUse!: Date;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string;
}
