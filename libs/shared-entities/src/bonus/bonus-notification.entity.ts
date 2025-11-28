import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'bonus_notifications', schema: DATABASE_SCHEMAS.BONUS })
export class BonusNotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', comment: 'User ID who should receive the notification' })
  userId!: string;

  @Column({ type: 'uuid', comment: 'Related bonus transaction ID' })
  bonusTransactionId!: string;

  @Column({ type: 'varchar', length: 100, comment: 'Type of notification' })
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
    comment: 'Whether the notification has been viewed by the user',
  })
  isViewed!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn({ nullable: true })
  viewedAt?: Date;
}
