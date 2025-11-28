import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { PlatformTypeEnum } from './self-exclusion.entity';

@Entity({ name: 'daily_gambling_stats', schema: DATABASE_SCHEMAS.USERS })
@Index(['userId', 'date', 'platformType'], { unique: true })
export class DailyGamblingStatsEntity {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column()
  userId!: string;

  @ApiProperty({
    description: 'Date of the statistics (YYYY-MM-DD)',
    example: '2023-01-01',
  })
  @Column({ type: 'date' })
  date!: Date;

  @ApiProperty({
    description: 'Platform type (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    example: PlatformTypeEnum.PLATFORM,
  })
  @Column({
    type: 'enum',
    enum: PlatformTypeEnum,
    default: PlatformTypeEnum.PLATFORM,
  })
  platformType!: PlatformTypeEnum;

  @ApiProperty({
    description: 'Total amount wagered in cents',
    example: 10000,
  })
  @Column({ type: 'decimal', precision: 20, scale: 0, default: 0 })
  wagerAmountCents!: string;

  @ApiProperty({
    description: 'Total amount won in cents',
    example: 5000,
  })
  @Column({ type: 'decimal', precision: 20, scale: 0, default: 0 })
  winAmountCents!: string;

  @ApiProperty({
    description: 'Total amount lost in cents (wager - win, if positive)',
    example: 5000,
  })
  @Column({ type: 'decimal', precision: 20, scale: 0, default: 0 })
  lossAmountCents!: string;

  @ApiProperty({
    description: 'Total amount deposited in cents',
    example: 20000,
  })
  @Column({ type: 'decimal', precision: 20, scale: 0, default: 0 })
  depositAmountCents!: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt!: Date;
}
