import { ApiProperty } from '@nestjs/swagger';
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
import { ModerationActionTypeEnum } from './enums/moderation-action-type.enum';
import { UserEntity } from './users.entity';

@Entity('user_moderation_history', { schema: DATABASE_SCHEMAS.USERS })
@Index(['userId'])
@Index(['adminId'])
@Index(['createdAt'])
export class UserModerationHistoryEntity {
  @ApiProperty({
    description: 'Unique ID for the moderation history record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'ID of the user who was moderated',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Index()
  @Column('uuid')
  userId!: string;

  @ApiProperty({
    description: 'ID of the admin who performed the action',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Index()
  @Column('uuid')
  adminId!: string;

  @ApiProperty({
    description: 'Type of moderation action',
    enum: ModerationActionTypeEnum,
    example: ModerationActionTypeEnum.MUTE,
  })
  @Column({
    type: 'enum',
    enum: ModerationActionTypeEnum,
  })
  actionType!: ModerationActionTypeEnum;

  @ApiProperty({
    description: 'Reason for the moderation action',
    example: 'Spam in chat',
    required: false,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason?: string;

  @ApiProperty({
    description: 'Duration of the action in minutes',
    example: 60,
  })
  @Column('integer')
  durationMinutes!: number;

  @ApiProperty({
    description: 'When the moderation action was created',
    example: '2025-05-12T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: 'User who was moderated',
  })
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ApiProperty({
    description: 'Admin who performed the action',
  })
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'adminId' })
  admin!: UserEntity;
}
