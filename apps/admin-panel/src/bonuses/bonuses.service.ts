import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CancelBonusesDto, CancelBonusesResponseDto } from './dto/cancel-bonuses.dto';
import { GetBonusesFilterDto } from './dto/get-bonuses-filter.dto';
import { WeeklyReloadActivationDto } from './dto/weekly-reload-activation.dto';
import { WeeklyReloadCalculationDto } from './dto/weekly-reload-calculation.dto';

export interface IBonusFilters {
  status?: BonusTransactionStatusEnum[];
  bonusType?: BonusTypeEnum[];
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface IBonusesWithFiltersResult {
  bonuses: BonusTransactionEntity[];
  total: number;
}

export interface ICancelBonusesResult {
  success: number;
  failed: string[];
}

@Injectable()
export class BonusesService {
  private readonly logger = new Logger(BonusesService.name);

  constructor(
    @InjectRepository(BonusTransactionEntity)
    private readonly bonusRepo: Repository<BonusTransactionEntity>,
    @InjectRepository(WeeklyRacePrizeEntity)
    private readonly weeklyPrizeRepo: Repository<WeeklyRacePrizeEntity>,
    private readonly configService: ConfigService,
  ) {}

  private centsToDollars(cents: string): number {
    return parseFloat(cents) / 100;
  }

  async getWeeklyRacePrizes(): Promise<Array<{ place: number; amount: number }>> {
    const rows = await this.weeklyPrizeRepo.find({ order: { place: 'ASC' } });
    return rows.map((r) => ({ place: r.place, amount: parseFloat(r.amountUsd) }));
  }

  async updateWeeklyRacePrizes(
    prizes: Array<{ place: number; amount: number }>,
  ): Promise<Array<{ place: number; amount: number }>> {
    const normalized = prizes
      .map((p) => ({ place: Number(p.place), amount: Number(p.amount) }))
      .filter(
        (p) =>
          Number.isFinite(p.place) && Number.isFinite(p.amount) && p.place > 0 && p.amount >= 0,
      );

    const places = normalized.map((p) => p.place);

    // Delete any places not present in the submitted list (full replace semantics)
    if (places.length > 0) {
      await this.weeklyPrizeRepo
        .createQueryBuilder()
        .delete()
        .from(WeeklyRacePrizeEntity)
        .where('place NOT IN (:...places)', { places })
        .execute();
    } else {
      await this.weeklyPrizeRepo.clear();
    }

    // Upsert provided places
    const entities = normalized.map((p) =>
      this.weeklyPrizeRepo.create({ place: p.place, amountUsd: p.amount.toFixed(2) }),
    );
    await this.weeklyPrizeRepo.save(entities);
    return this.getWeeklyRacePrizes();
  }

  private convertBonusToDollars(bonus: BonusTransactionEntity): BonusTransactionEntity {
    return {
      ...bonus,
      amount: this.centsToDollars(bonus.amount).toString(),
    };
  }

  async getBonusesWithFilters(filters: GetBonusesFilterDto): Promise<IBonusesWithFiltersResult> {
    const queryBuilder = this.bonusRepo.createQueryBuilder('bonus');

    if (filters.status?.length) {
      queryBuilder.andWhere('bonus.status IN (:...statuses)', {
        statuses: filters.status as BonusTransactionStatusEnum[],
      });
    }

    if (filters.bonusType?.length) {
      queryBuilder.andWhere('bonus.bonusType IN (:...types)', {
        types: filters.bonusType as BonusTypeEnum[],
      });
    }

    if (filters.userId) {
      queryBuilder.andWhere('bonus.userId = :userId', { userId: filters.userId });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('bonus.createdAt >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('bonus.createdAt <= :dateTo', {
        dateTo: new Date(filters.dateTo),
      });
    }

    const total = await queryBuilder.getCount();

    const bonuses = await queryBuilder
      .orderBy('bonus.createdAt', 'DESC')
      .skip(((filters.page || 1) - 1) * (filters.limit || 20))
      .take(filters.limit || 20)
      .getMany();

    // Convert amounts from cents to dollars
    const bonusesInDollars = bonuses.map((bonus) => this.convertBonusToDollars(bonus));

    return { bonuses: bonusesInDollars, total };
  }

  async cancelBonusesBatch(
    dto: CancelBonusesDto,
    adminId: string,
  ): Promise<CancelBonusesResponseDto> {
    const results: ICancelBonusesResult = { success: 0, failed: [] };

    for (const bonusId of dto.bonusIds) {
      try {
        const bonus = await this.bonusRepo.findOne({
          where: { id: bonusId, status: BonusTransactionStatusEnum.PENDING },
        });

        if (!bonus) {
          results.failed.push(bonusId);
          continue;
        }

        // Update the bonus entity
        bonus.status = BonusTransactionStatusEnum.CANCELED;
        bonus.updatedBy = adminId;
        bonus.metadata = {
          ...bonus.metadata,
          cancellationReason: dto.reason || 'Cancelled by admin panel',
          canceledAt: new Date().toISOString(),
          originalStatus: BonusTransactionStatusEnum.PENDING,
          canceledBy: adminId,
        };

        await this.bonusRepo.save(bonus);
        results.success++;
      } catch (error) {
        this.logger.error(`Failed to cancel bonus ${bonusId}:`, error);
        results.failed.push(bonusId);
      }
    }

    this.logger.log(
      `Batch cancel completed: ${results.success} success, ${results.failed.length} failed`,
    );

    return {
      success: results.success,
      failed: results.failed,
      total: dto.bonusIds.length,
    };
  }

  async calculateWeeklyReload(userId: string): Promise<WeeklyReloadCalculationDto> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    try {
      const response = await fetch(`${backendUrl}/v1/weekly-reload-admin/calculate/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': adminApiSecret!,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Extract error message from nested structure: errorData.message can be an object
        const errorMessage =
          errorData.message?.message ||
          errorData.message ||
          errorData.error ||
          JSON.stringify(errorData) ||
          'Unknown error';
        throw new Error(`Backend API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();

      return {
        userId: data.userId,
        totalWeeklyAmount: data.totalWeeklyAmount / 100, // Convert cents to dollars
        dailyAmount: data.dailyAmount / 100, // Convert cents to dollars
        vipLevel: data.vipLevel,
        appliedPercentage: data.appliedPercentage,
        effectiveEdge: data.effectiveEdge / 100, // Convert cents to dollars
        netResult: data.netResult / 100, // Convert cents to dollars
        isProfitable: data.isProfitable,
        periodAnalyzed: data.periodAnalyzed,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate weekly reload for user ${userId}:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to calculate weekly reload: ${message}`);
    }
  }

  async activateWeeklyReload(userId: string, adminId: string): Promise<WeeklyReloadActivationDto> {
    // Fixed error handling for better debugging
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    try {
      const response = await fetch(`${backendUrl}/v1/weekly-reload-admin/activate/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': adminApiSecret!,
        },
        body: JSON.stringify({ adminId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error('🔍 DEBUG activateWeeklyReload - Raw errorData:', {
          errorData,
          type: typeof errorData,
          keys: Object.keys(errorData || {}),
          stringified: JSON.stringify(errorData),
        });
        // Extract error message from nested structure: errorData.message can be an object
        const errorMessage =
          errorData.message?.message ||
          errorData.message ||
          errorData.error ||
          JSON.stringify(errorData) ||
          'Unknown error';
        this.logger.error('🔍 DEBUG activateWeeklyReload - Final errorMessage:', { errorMessage });
        throw new Error(`Backend API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();

      return {
        success: data.success,
        message: data.message,
        bonusesCreated: data.bonusesCreated,
        totalWeeklyAmount: data.totalWeeklyAmount / 100, // Convert cents to dollars
        dailyAmount: data.dailyAmount / 100, // Convert cents to dollars
        bonusDetails: data.bonusDetails.map((bonus: any) => ({
          bonusId: bonus.bonusId,
          amount: bonus.amount / 100, // Convert cents to dollars
          activateAt: bonus.activateAt,
          expiredAt: bonus.expiredAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to activate weekly reload for user ${userId}:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to activate weekly reload: ${message}`);
    }
  }
}
