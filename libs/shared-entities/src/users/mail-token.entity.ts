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
import { MailTokenTypeEnum } from './enums/mail-token-type.enum';
import { UserEntity } from './users.entity';

@Entity('mail_tokens', { schema: DATABASE_SCHEMAS.USERS })
export class MailTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  token!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'enum', enum: MailTokenTypeEnum, name: 'type' })
  type!: MailTokenTypeEnum;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
