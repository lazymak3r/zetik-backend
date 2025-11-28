import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from './users.entity';

export enum SelfExclusionTypeEnum {
  COOLDOWN = 'COOLDOWN',
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT',
  DEPOSIT_LIMIT = 'DEPOSIT_LIMIT',
  LOSS_LIMIT = 'LOSS_LIMIT',
  WAGER_LIMIT = 'WAGER_LIMIT',
}

export enum PlatformTypeEnum {
  SPORTS = 'SPORTS',
  CASINO = 'CASINO',
  PLATFORM = 'PLATFORM',
}

export enum LimitPeriodEnum {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  HALF_YEAR = 'HALF_YEAR',
  SESSION = 'SESSION',
}

@Entity('self_exclusions', { schema: DATABASE_SCHEMAS.USERS })
export class SelfExclusionEntity {
  @ApiProperty({
    description: 'Unique self-exclusion ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ApiProperty({
    description: 'Self-exclusion type',
    enum: SelfExclusionTypeEnum,
    example: SelfExclusionTypeEnum.TEMPORARY,
  })
  @Column({
    type: 'enum',
    enum: SelfExclusionTypeEnum,
  })
  type!: SelfExclusionTypeEnum;

  @ApiProperty({
    description: 'Platform type for the exclusion (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    example: PlatformTypeEnum.PLATFORM,
    required: false,
  })
  @Column({
    type: 'enum',
    enum: PlatformTypeEnum,
    default: PlatformTypeEnum.PLATFORM,
  })
  platformType!: PlatformTypeEnum;

  @ApiProperty({
    description: 'Period for limits (daily, weekly, monthly, session)',
    enum: LimitPeriodEnum,
    example: LimitPeriodEnum.DAILY,
    required: false,
  })
  @Column({
    type: 'enum',
    enum: LimitPeriodEnum,
    nullable: true,
  })
  period?: LimitPeriodEnum;

  @ApiProperty({
    description: 'Limit amount (for deposit and loss limits)',
    example: 1000,
    required: false,
  })
  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  limitAmount?: number | null;

  @ApiProperty({
    description: 'Start date of the exclusion',
    example: '2025-05-12T12:00:00Z',
  })
  @Column()
  startDate!: Date;

  @ApiProperty({
    description: 'End date of the exclusion (null for permanent exclusion)',
    example: '2025-06-12T12:00:00Z',
    required: false,
  })
  @Column({ nullable: true })
  endDate?: Date;

  @ApiProperty({
    description: 'Is the exclusion currently active',
    example: true,
  })
  @Column({ default: true })
  isActive!: boolean;

  @ApiProperty({
    description: 'Timestamp when user requested limit removal (24h countdown starts)',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  removalRequestedAt?: Date | null;

  @ApiProperty({
    description:
      'Timestamp marking end of 24h window after cooldown expires (for limit reinstatement)',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  postCooldownWindowEnd?: Date | null;

  @ApiProperty({
    description: 'Self-exclusion creation timestamp',
    example: '2025-05-12T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: 'Self-exclusion last update timestamp',
    example: '2025-05-12T12:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt!: Date;
}
