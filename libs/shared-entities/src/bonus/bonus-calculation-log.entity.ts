import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { BonusCalculationStatusEnum } from './enums/bonus-calculation-status.enum';
import { BonusJobTypeEnum } from './enums/bonus-job-type.enum';

@Entity({ name: 'bonus_calculation_logs', schema: DATABASE_SCHEMAS.BONUS })
@Unique('UQ_bonus_calculation_period', ['jobType', 'periodFrom', 'periodTo'])
@Index('IDX_bonus_calculation_period', ['jobType', 'periodFrom', 'periodTo'])
@Index('IDX_bonus_calculation_status', ['status', 'createdAt'])
@Index('IDX_bonus_calculation_completed', ['jobType', 'periodFrom', 'periodTo', 'status'])
export class BonusCalculationLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: BonusJobTypeEnum,
    comment: 'Type of bonus calculation job',
  })
  jobType!: BonusJobTypeEnum;

  @Column({
    type: 'date',
    comment: 'Start date of the calculation period',
  })
  periodFrom!: Date;

  @Column({
    type: 'date',
    comment: 'End date of the calculation period',
  })
  periodTo!: Date;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'Unique job ID from Bull queue',
  })
  jobId!: string;

  @Column({
    type: 'enum',
    enum: BonusCalculationStatusEnum,
    default: BonusCalculationStatusEnum.PENDING,
    comment: 'Current status of the job execution',
  })
  status!: BonusCalculationStatusEnum;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of users successfully processed',
  })
  usersProcessed!: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of users that failed processing',
  })
  usersFailed!: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 8,
    default: '0.00000000',
    comment: 'Total bonus amount distributed',
  })
  totalBonusAmount!: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When the job execution started',
  })
  startedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When the job execution completed',
  })
  completedAt?: Date;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Error message if job failed',
  })
  errorMessage?: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional metadata and execution details',
  })
  metadata?: Record<string, any>;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Array of error messages for individual users',
  })
  userErrors?: string[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'When this log record was created',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: 'When this log record was last updated',
  })
  updatedAt!: Date;
}
