import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BonusCalculationLogEntity,
  BonusCalculationStatusEnum,
  BonusJobTypeEnum,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';

import { IBonusJobResult } from '../interfaces/bonus-job-data.interface';

@Injectable()
export class BonusCalculationLogService {
  private readonly logger = new Logger(BonusCalculationLogService.name);

  constructor(
    @InjectRepository(BonusCalculationLogEntity)
    private readonly logRepository: Repository<BonusCalculationLogEntity>,
  ) {}

  async updateJobStatus(
    jobId: string,
    status: BonusCalculationStatusEnum,
    updates?: Partial<{
      usersProcessed: number;
      usersFailed: number;
      totalBonusAmount: string;
      errorMessage: string;
      userErrors: string[];
      metadata: Record<string, any>;
      startedAt: Date;
      completedAt: Date;
    }>,
  ): Promise<void> {
    const updateData: Partial<BonusCalculationLogEntity> = { status };

    if (status === BonusCalculationStatusEnum.RUNNING && !updates?.startedAt) {
      updateData.startedAt = new Date();
    }

    if (
      status === BonusCalculationStatusEnum.COMPLETED ||
      status === BonusCalculationStatusEnum.FAILED
    ) {
      updateData.completedAt = new Date();
    }

    if (updates) {
      Object.assign(updateData, updates);
    }

    await this.logRepository.update({ jobId }, updateData);

    this.logger.log(`Updated job ${jobId} status to ${status}`, {
      updates: updateData,
    });
  }

  async recordJobResult(jobId: string, result: IBonusJobResult): Promise<void> {
    const status =
      result.failed > 0 && result.processed === 0
        ? BonusCalculationStatusEnum.FAILED
        : BonusCalculationStatusEnum.COMPLETED;

    await this.updateJobStatus(jobId, status, {
      usersProcessed: result.processed,
      usersFailed: result.failed,
      totalBonusAmount: result.totalBonus,
      userErrors: result.errors,
    });
  }

  async getJobHistory(
    jobType?: BonusJobTypeEnum,
    status?: BonusCalculationStatusEnum,
    limit = 50,
  ): Promise<BonusCalculationLogEntity[]> {
    const queryBuilder = this.logRepository.createQueryBuilder('log');

    if (jobType) {
      queryBuilder.andWhere('log.jobType = :jobType', { jobType });
    }

    if (status) {
      queryBuilder.andWhere('log.status = :status', { status });
    }

    return queryBuilder.orderBy('log.createdAt', 'DESC').limit(limit).getMany();
  }

  async getJobStats(
    fromDate?: Date,
    toDate?: Date,
  ): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalUsersProcessed: number;
    totalBonusDistributed: string;
  }> {
    const queryBuilder = this.logRepository.createQueryBuilder('log');

    if (fromDate) {
      queryBuilder.andWhere('log.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('log.createdAt <= :toDate', { toDate });
    }

    const [logs, totalJobs] = await queryBuilder.getManyAndCount();

    const stats = logs.reduce(
      (acc, log) => {
        if (log.status === BonusCalculationStatusEnum.COMPLETED) {
          acc.completedJobs++;
        } else if (log.status === BonusCalculationStatusEnum.FAILED) {
          acc.failedJobs++;
        }

        acc.totalUsersProcessed += log.usersProcessed;
        acc.totalBonusDistributed = (
          parseFloat(acc.totalBonusDistributed) + parseFloat(log.totalBonusAmount)
        ).toString();

        return acc;
      },
      {
        totalJobs,
        completedJobs: 0,
        failedJobs: 0,
        totalUsersProcessed: 0,
        totalBonusDistributed: '0',
      },
    );

    return stats;
  }

  async createJobLogAtomic(
    jobId: string,
    jobType: BonusJobTypeEnum,
    periodFrom: Date,
    periodTo: Date,
    metadata?: Record<string, any>,
  ): Promise<{ created: boolean; log: BonusCalculationLogEntity }> {
    try {
      // Try to create with unique constraint
      const log = this.logRepository.create({
        jobId,
        jobType,
        periodFrom,
        periodTo,
        status: BonusCalculationStatusEnum.PENDING,
        usersProcessed: 0,
        usersFailed: 0,
        totalBonusAmount: '0',
        metadata,
      });

      const savedLog = await this.logRepository.save(log);
      this.logger.log(`Created bonus calculation log for job ${jobId}`, {
        logId: savedLog.id,
        jobType,
        period: `${periodFrom.toISOString()} to ${periodTo.toISOString()}`,
      });

      return { created: true, log: savedLog };
    } catch (error: unknown) {
      // Check if it's a unique constraint violation
      const isDuplicateKeyError = (err: unknown): boolean => {
        if (!err || typeof err !== 'object') return false;

        // PostgreSQL unique constraint violation
        if ('code' in err && err.code === '23505') return true;

        // Generic duplicate key error
        if ('message' in err) {
          const message = (err as { message: unknown }).message;
          return typeof message === 'string' && message.includes('duplicate key');
        }

        return false;
      };

      if (isDuplicateKeyError(error)) {
        // Find any existing log for this period - if completed, we skip; if running/failed, we may retry
        const existingLog = await this.logRepository.findOne({
          where: {
            jobType,
            periodFrom,
            periodTo,
          },
          order: { createdAt: 'DESC' },
        });

        if (existingLog) {
          // If job is completed, skip processing
          if (existingLog.status === BonusCalculationStatusEnum.COMPLETED) {
            this.logger.warn(
              `Found existing completed job during atomic create for ${jobType} period ${periodFrom.toISOString()} to ${periodTo.toISOString()}`,
              { existingLogId: existingLog.id, jobId },
            );
            return { created: false, log: existingLog };
          }

          // If job is failed or running for too long, we could allow retry
          // For now, we'll be conservative and skip any existing job
          this.logger.warn(
            `Found existing job (status: ${existingLog.status}) during atomic create for ${jobType} period ${periodFrom.toISOString()} to ${periodTo.toISOString()}`,
            { existingLogId: existingLog.id, existingStatus: existingLog.status, jobId },
          );
          return { created: false, log: existingLog };
        }
      }
      throw error;
    }
  }
}
