import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'notifications', schema: DATABASE_SCHEMAS.USERS })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', comment: 'User ID who should receive the notification' })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Type of notification (deposit, withdrawal, etc.)',
  })
  type!: string;

  @Column({ type: 'varchar', length: 255, comment: 'Notification title' })
  title!: string;

  @Column({ type: 'text', comment: 'Notification message' })
  message!: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Additional notification data',
  })
  data?: Record<string, any>;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Whether the notification has been read by the user',
  })
  isRead!: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Whether the notification has been deleted by the user',
  })
  isDeleted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn({ nullable: true })
  readAt?: Date;

  @UpdateDateColumn({ nullable: true })
  deletedAt?: Date;
}
