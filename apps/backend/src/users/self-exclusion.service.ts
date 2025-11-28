import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LimitPeriodEnum,
  PlatformTypeEnum,
  SelfExclusionEntity,
  SelfExclusionTypeEnum,
} from '@zetik/shared-entities';
import { isUUID } from 'class-validator';
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { EmailTemplateEnum } from '../email/email-templates.enum';
import { MailgunService } from '../email/mailgun.service';
import { DailyGamblingStatsService } from './daily-gambling-stats.service';
import { CreateSelfExclusionDto } from './dto/create-self-exclusion.dto';
import { GamblingLimitDto, GamblingLimitsResponseDto } from './dto/gambling-limits-response.dto';
import { SelfExclusionResponseDto } from './dto/self-exclusion-response.dto';

@Injectable()
export class SelfExclusionService {
  private readonly logger = new Logger(SelfExclusionService.name);

  constructor(
    @InjectRepository(SelfExclusionEntity)
    private readonly selfExclusionRepository: Repository<SelfExclusionEntity>,
    private readonly dailyGamblingStatsService: DailyGamblingStatsService,
    private readonly mailgunService: MailgunService,
  ) {}

  async createSelfExclusion(
    userId: string,
    userEmail: string,
    createDto: CreateSelfExclusionDto,
  ): Promise<{ exclusion: SelfExclusionResponseDto }> {
    // Validate required fields based on type
    if (createDto.type === SelfExclusionTypeEnum.TEMPORARY && !createDto.endDate) {
      throw new BadRequestException('End date is required for temporary exclusion');
    }

    // Set default platform type if not provided
    const platformType = createDto.platformType || PlatformTypeEnum.PLATFORM;

    // Check for existing active cooldown for the same platform type
    if (createDto.type === SelfExclusionTypeEnum.COOLDOWN) {
      const existingCooldown = await this.selfExclusionRepository.findOne({
        where: {
          userId,
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType,
          isActive: true,
        },
      });

      if (existingCooldown) {
        // Deactivate the existing cooldown
        existingCooldown.isActive = false;
        await this.selfExclusionRepository.save(existingCooldown);
      }

      // Create a new cooldown with 24-hour duration
      const cooldownEndDate = new Date();
      cooldownEndDate.setHours(cooldownEndDate.getHours() + 24);

      const selfExclusion = this.selfExclusionRepository.create({
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType,
        startDate: new Date(),
        endDate: cooldownEndDate,
        isActive: true,
      });

      const savedExclusion = await this.selfExclusionRepository.save(selfExclusion);

      // Send cooldown confirmation email
      try {
        await this.mailgunService.sendTemplateEmail(
          userEmail,
          EmailTemplateEnum.SELF_EXCLUSION_COOLDOWN,
          {
            platformType: platformType.toLowerCase(),
            endDate: cooldownEndDate.toISOString(),
            endDateFormatted: cooldownEndDate.toLocaleString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
          },
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send cooldown confirmation email to ${userEmail}`,
          emailError instanceof Error ? emailError.stack : emailError,
        );
      }

      // Cooldown doesn't require logout
      return {
        exclusion: this.mapToResponseDto(savedExclusion),
      };
    }

    // Check for existing active exclusions of the same type and platform
    const existingExclusions = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: createDto.type,
        platformType,
        isActive: true,
      },
    });

    // For deposit, loss, and wager limits, check if there's already a limit for the same period
    if (
      (createDto.type === SelfExclusionTypeEnum.DEPOSIT_LIMIT ||
        createDto.type === SelfExclusionTypeEnum.LOSS_LIMIT ||
        createDto.type === SelfExclusionTypeEnum.WAGER_LIMIT) &&
      createDto.period
    ) {
      const existingPeriodExclusion = existingExclusions.find(
        (exclusion) => exclusion.period === createDto.period,
      );

      // If limitAmount is 0 or null, treat it as a removal request
      if (createDto.limitAmount === 0 || createDto.limitAmount === null) {
        if (existingPeriodExclusion) {
          existingPeriodExclusion.isActive = false;
          await this.selfExclusionRepository.save(existingPeriodExclusion);
          return {
            exclusion: this.mapToResponseDto(existingPeriodExclusion),
          };
        } else {
          throw new NotFoundException(
            `No active ${createDto.type.toLowerCase()} found for ${createDto.period.toLowerCase()} period`,
          );
        }
      }

      // Validate max limits: only 1 active loss limit + 1 active wager limit allowed
      if (createDto.type === SelfExclusionTypeEnum.LOSS_LIMIT) {
        const existingLossLimits = await this.selfExclusionRepository.find({
          where: {
            userId,
            type: SelfExclusionTypeEnum.LOSS_LIMIT,
            isActive: true,
          },
        });
        if (existingLossLimits.length > 0 && !existingPeriodExclusion) {
          throw new BadRequestException('You can only have one active loss limit at a time');
        }
      }

      if (createDto.type === SelfExclusionTypeEnum.WAGER_LIMIT) {
        const existingWagerLimits = await this.selfExclusionRepository.find({
          where: {
            userId,
            type: SelfExclusionTypeEnum.WAGER_LIMIT,
            isActive: true,
          },
        });
        if (existingWagerLimits.length > 0 && !existingPeriodExclusion) {
          throw new BadRequestException('You can only have one active wager limit at a time');
        }
      }

      if (existingPeriodExclusion) {
        // Deactivate the existing exclusion
        existingPeriodExclusion.isActive = false;
        await this.selfExclusionRepository.save(existingPeriodExclusion);
      }
    } else if (
      createDto.type === SelfExclusionTypeEnum.TEMPORARY ||
      createDto.type === SelfExclusionTypeEnum.PERMANENT
    ) {
      // Check if there's an active cooldown for this platform type
      const activeCooldown = await this.selfExclusionRepository.findOne({
        where: {
          userId,
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType,
          isActive: true,
        },
      });

      if (!activeCooldown) {
        // Check if there was a cooldown that ended in the last 24 hours
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const recentlyEndedCooldown = await this.selfExclusionRepository.findOne({
          where: {
            userId,
            type: SelfExclusionTypeEnum.COOLDOWN,
            platformType,
            isActive: false,
            endDate: MoreThan(twentyFourHoursAgo),
          },
          order: { endDate: 'DESC' },
        });

        if (!recentlyEndedCooldown) {
          throw new BadRequestException(
            'You must first take a 24-hour cooldown before setting up self-exclusion',
          );
        }
      }

      // For temporary and permanent exclusions, deactivate all existing exclusions of the same platform type
      if (existingExclusions.length > 0) {
        for (const exclusion of existingExclusions) {
          exclusion.isActive = false;
          await this.selfExclusionRepository.save(exclusion);
        }
      }
    }

    // Create new self-exclusion
    const selfExclusion = this.selfExclusionRepository.create({
      userId,
      type: createDto.type,
      platformType,
      period: createDto.period,
      limitAmount: createDto.limitAmount,
      startDate: new Date(),
      endDate: createDto.endDate,
      isActive: true,
    });

    const savedExclusion = await this.selfExclusionRepository.save(selfExclusion);

    // Send permanent exclusion notification email
    if (createDto.type === SelfExclusionTypeEnum.PERMANENT) {
      try {
        await this.mailgunService.sendTemplateEmail(
          userEmail,
          EmailTemplateEnum.SELF_EXCLUSION_PERMANENT,
          {
            platformType: platformType.toLowerCase(),
            supportEmail: 'support@zetik.com',
          },
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send permanent exclusion email to ${userEmail}`,
          emailError instanceof Error ? emailError.stack : emailError,
        );
      }
    }

    return {
      exclusion: this.mapToResponseDto(savedExclusion),
    };
  }

  async getUserSelfExclusions(userId: string): Promise<SelfExclusionResponseDto[]> {
    const exclusions = await this.selfExclusionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return exclusions.map((exclusion) => this.mapToResponseDto(exclusion));
  }

  async getActiveSelfExclusions(
    userId: string,
    platformType?: PlatformTypeEnum,
  ): Promise<SelfExclusionResponseDto[]> {
    const now = new Date();

    // Base conditions for all queries
    const baseConditions = { userId, isActive: true };

    // Platform type condition
    const platformCondition = platformType
      ? { platformType: In([platformType, PlatformTypeEnum.PLATFORM]) }
      : {};

    const exclusions = await this.selfExclusionRepository.find({
      where: [
        // Permanent exclusions that are active
        { ...baseConditions, ...platformCondition, type: SelfExclusionTypeEnum.PERMANENT },
        // Temporary exclusions that are active and not expired
        {
          ...baseConditions,
          ...platformCondition,
          type: SelfExclusionTypeEnum.TEMPORARY,
          endDate: MoreThan(now),
        },
        // Cooldown exclusions that are active and not expired (either endDate OR postCooldownWindowEnd)
        {
          ...baseConditions,
          ...platformCondition,
          type: SelfExclusionTypeEnum.COOLDOWN,
          endDate: MoreThan(now),
        },
        // Cooldown exclusions in post-cooldown window (endDate expired but postCooldownWindowEnd not expired)
        {
          ...baseConditions,
          ...platformCondition,
          type: SelfExclusionTypeEnum.COOLDOWN,
          postCooldownWindowEnd: MoreThan(now),
        },
        // Deposit limits that are active
        { ...baseConditions, ...platformCondition, type: SelfExclusionTypeEnum.DEPOSIT_LIMIT },
        // Loss limits that are active
        { ...baseConditions, ...platformCondition, type: SelfExclusionTypeEnum.LOSS_LIMIT },
      ],
    });

    return exclusions.map((exclusion) => this.mapToResponseDto(exclusion));
  }

  /**
   * Check if 24 hours have passed since the creation of a self-exclusion
   * @param exclusion Self-exclusion entity to check
   * @returns True if 24 hours have passed, false otherwise
   */
  has24HoursPassedSinceCreation(exclusion: SelfExclusionEntity): boolean {
    const now = new Date();
    const creationTime = exclusion.createdAt.getTime();
    const timeDifference = now.getTime() - creationTime;
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    return timeDifference >= twentyFourHoursInMs;
  }

  async cancelSelfExclusion(userId: string, exclusionId: string): Promise<void> {
    if (!isUUID(exclusionId)) {
      throw new BadRequestException('Invalid exclusion ID format');
    }

    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id: exclusionId, userId },
    });

    if (!exclusion) {
      throw new NotFoundException('Self-exclusion not found');
    }

    // Permanent and temporary exclusions cannot be canceled
    if (
      exclusion.type === SelfExclusionTypeEnum.PERMANENT ||
      exclusion.type === SelfExclusionTypeEnum.TEMPORARY
    ) {
      throw new ConflictException(
        `${exclusion.type.toLowerCase()} exclusions cannot be canceled before their end date`,
      );
    }

    // For cooldown, allow immediate cancellation (per spec)
    if (exclusion.type === SelfExclusionTypeEnum.COOLDOWN) {
      exclusion.isActive = false;
      await this.selfExclusionRepository.save(exclusion);
      return;
    }

    // For deposit, loss, and wager limits: start 24-hour removal countdown
    if (
      exclusion.type === SelfExclusionTypeEnum.DEPOSIT_LIMIT ||
      exclusion.type === SelfExclusionTypeEnum.LOSS_LIMIT ||
      exclusion.type === SelfExclusionTypeEnum.WAGER_LIMIT
    ) {
      // Set removal requested timestamp to start countdown
      exclusion.removalRequestedAt = new Date();
      // Keep limit active during countdown period
      exclusion.isActive = true;
      await this.selfExclusionRepository.save(exclusion);
      return;
    }

    // Fallback: immediate removal for any other types
    exclusion.isActive = false;
    await this.selfExclusionRepository.save(exclusion);
  }

  mapToResponseDto(entity: SelfExclusionEntity): SelfExclusionResponseDto {
    const now = new Date();

    const dto = new SelfExclusionResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.type = entity.type;
    dto.platformType = entity.platformType;
    dto.period = entity.period;
    dto.limitAmount = entity.limitAmount;
    dto.startDate = entity.startDate;
    dto.endDate = entity.endDate;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.removalRequestedAt = entity.removalRequestedAt;
    dto.postCooldownWindowEnd = entity.postCooldownWindowEnd;

    // Computed field: is the cooldown in the post-cooldown window?
    dto.isInPostCooldownWindow =
      entity.type === SelfExclusionTypeEnum.COOLDOWN &&
      entity.postCooldownWindowEnd !== null &&
      entity.postCooldownWindowEnd !== undefined &&
      entity.postCooldownWindowEnd > now;

    // Computed fields for removal countdown
    dto.isRemovalPending =
      entity.removalRequestedAt !== null && entity.removalRequestedAt !== undefined;
    dto.removalExpiresAt = entity.removalRequestedAt
      ? new Date(entity.removalRequestedAt.getTime() + 24 * 60 * 60 * 1000)
      : null;

    return dto;
  }

  /**
   * Check if a user has active temporary, permanent, or cooldown self-exclusion
   * This includes cooldowns in the post-cooldown window (24h after cooldown expires)
   */
  async hasActiveSelfExclusion(
    userId: string,
    platformType?: PlatformTypeEnum,
  ): Promise<{
    type: SelfExclusionTypeEnum;
    platformType: PlatformTypeEnum;
    endDate?: Date;
    remainingTime?: number; // in milliseconds
    isInPostCooldownWindow?: boolean;
  } | null> {
    const now = new Date();
    const whereCondition: Record<string, unknown> = { userId, isActive: true };

    // If platform type is provided, check for exclusions of that type or platform-wide exclusions
    if (platformType) {
      whereCondition.platformType = [platformType, PlatformTypeEnum.PLATFORM];
    }

    // Check for permanent exclusion first
    const permanentExclusion = await this.selfExclusionRepository.findOne({
      where: {
        ...whereCondition,
        type: SelfExclusionTypeEnum.PERMANENT,
      },
    });

    if (permanentExclusion) {
      return {
        type: SelfExclusionTypeEnum.PERMANENT,
        platformType: permanentExclusion.platformType,
      };
    }

    // Check for temporary exclusion
    const temporaryExclusion = await this.selfExclusionRepository.findOne({
      where: {
        ...whereCondition,
        type: SelfExclusionTypeEnum.TEMPORARY,
        endDate: MoreThan(now),
      },
    });

    if (temporaryExclusion && temporaryExclusion.endDate) {
      const remainingTime = temporaryExclusion.endDate.getTime() - now.getTime();
      return {
        type: SelfExclusionTypeEnum.TEMPORARY,
        platformType: temporaryExclusion.platformType,
        endDate: temporaryExclusion.endDate,
        remainingTime: remainingTime > 0 ? remainingTime : 0,
      };
    }

    // Check for active cooldown (endDate not yet expired)
    const cooldownExclusion = await this.selfExclusionRepository.findOne({
      where: {
        ...whereCondition,
        type: SelfExclusionTypeEnum.COOLDOWN,
        endDate: MoreThan(now),
      },
    });

    if (cooldownExclusion && cooldownExclusion.endDate) {
      const remainingTime = cooldownExclusion.endDate.getTime() - now.getTime();
      return {
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType: cooldownExclusion.platformType,
        endDate: cooldownExclusion.endDate,
        remainingTime: remainingTime > 0 ? remainingTime : 0,
        isInPostCooldownWindow: false,
      };
    }

    // Check for cooldown in post-cooldown window (endDate expired but postCooldownWindowEnd not expired)
    const postCooldownExclusion = await this.selfExclusionRepository.findOne({
      where: {
        ...whereCondition,
        type: SelfExclusionTypeEnum.COOLDOWN,
        postCooldownWindowEnd: MoreThan(now),
      },
    });

    if (postCooldownExclusion && postCooldownExclusion.postCooldownWindowEnd) {
      const remainingTime = postCooldownExclusion.postCooldownWindowEnd.getTime() - now.getTime();
      return {
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType: postCooldownExclusion.platformType,
        endDate: postCooldownExclusion.postCooldownWindowEnd,
        remainingTime: remainingTime > 0 ? remainingTime : 0,
        isInPostCooldownWindow: true,
      };
    }

    return null;
  }

  /**
   * Get gambling limits (deposit, loss, and wager limits) with remaining amounts
   */
  async getGamblingLimits(userId: string): Promise<GamblingLimitsResponseDto> {
    // Get active deposit limits
    const depositLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
        isActive: true,
      },
    });

    // Get active loss limits
    const lossLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.LOSS_LIMIT,
        isActive: true,
      },
    });

    // Get active wager limits
    const wagerLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.WAGER_LIMIT,
        isActive: true,
      },
    });

    // Calculate remaining amounts for deposit limits
    const processedDepositLimits = await Promise.all(
      depositLimits.map(async (limit) => {
        const { periodStartDate, periodEndDate } = this.calculatePeriodDates(limit.period!);
        const usedAmount = await this.calculateDepositAmount(
          userId,
          periodStartDate,
          periodEndDate,
          limit.platformType,
        );
        const remainingAmount = Math.max(0, Number(limit.limitAmount) - usedAmount);

        const dto = new GamblingLimitDto();
        dto.id = limit.id;
        dto.type = limit.type;
        dto.period = limit.period!;
        dto.limitAmount = Number(limit.limitAmount);
        dto.usedAmount = usedAmount;
        dto.remainingAmount = remainingAmount;
        dto.periodStartDate = periodStartDate;
        dto.periodEndDate = periodEndDate;
        return dto;
      }),
    );

    // Calculate remaining amounts for loss limits
    const processedLossLimits = await Promise.all(
      lossLimits.map(async (limit) => {
        const { periodStartDate, periodEndDate } = this.calculatePeriodDates(limit.period!);
        const usedAmount = await this.calculateLossAmount(
          userId,
          periodStartDate,
          periodEndDate,
          limit.platformType,
        );
        const remainingAmount = Math.max(0, Number(limit.limitAmount) - usedAmount);

        const dto = new GamblingLimitDto();
        dto.id = limit.id;
        dto.type = limit.type;
        dto.period = limit.period!;
        dto.limitAmount = Number(limit.limitAmount);
        dto.usedAmount = usedAmount;
        dto.remainingAmount = remainingAmount;
        dto.periodStartDate = periodStartDate;
        dto.periodEndDate = periodEndDate;
        return dto;
      }),
    );

    // Calculate remaining amounts for wager limits
    const processedWagerLimits = await Promise.all(
      wagerLimits.map(async (limit) => {
        const { periodStartDate, periodEndDate } = this.calculatePeriodDates(limit.period!);
        const usedAmount = await this.calculateWagerAmount(
          userId,
          periodStartDate,
          periodEndDate,
          limit.platformType,
        );
        const remainingAmount = Math.max(0, Number(limit.limitAmount) - usedAmount);

        const dto = new GamblingLimitDto();
        dto.id = limit.id;
        dto.type = limit.type;
        dto.period = limit.period!;
        dto.limitAmount = Number(limit.limitAmount);
        dto.usedAmount = usedAmount;
        dto.remainingAmount = remainingAmount;
        dto.periodStartDate = periodStartDate;
        dto.periodEndDate = periodEndDate;
        return dto;
      }),
    );

    return {
      depositLimits: processedDepositLimits,
      lossLimits: processedLossLimits,
      wagerLimits: processedWagerLimits,
    };
  }

  /**
   * Calculate the start and end dates for a given limit period
   */
  private calculatePeriodDates(period: LimitPeriodEnum): {
    periodStartDate: Date;
    periodEndDate: Date;
  } {
    const now = new Date();
    let periodStartDate: Date;
    let periodEndDate: Date;

    switch (period) {
      case LimitPeriodEnum.DAILY:
        // Start of the current day
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // End of the current day
        periodEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case LimitPeriodEnum.WEEKLY:
        {
          // Start of the current week (Sunday)
          const dayOfWeek = now.getDay();
          periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          // End of the current week (Saturday)
          periodEndDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + (6 - dayOfWeek),
            23,
            59,
            59,
            999,
          );
        }
        break;
      case LimitPeriodEnum.MONTHLY:
        // Start of the current month
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        // End of the current month
        periodEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case LimitPeriodEnum.HALF_YEAR:
        {
          // Start of the current half-year (Jan 1 or Jul 1)
          const halfYear = now.getMonth() < 6 ? 0 : 6;
          periodStartDate = new Date(now.getFullYear(), halfYear, 1);
          // End of the current half-year (Jun 30 or Dec 31)
          periodEndDate = new Date(now.getFullYear(), halfYear + 6, 0, 23, 59, 59, 999);
        }
        break;
      case LimitPeriodEnum.SESSION:
      default:
        // For session, use the current day as a fallback
        periodStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
    }

    return { periodStartDate, periodEndDate };
  }

  /**
   * Calculate the total deposit amount for a user within a given period
   */
  private async calculateDepositAmount(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Use the daily gambling stats service to get the total deposit amount
    // This uses the aggregated data from the daily_gambling_stats table
    // which is more efficient than querying the balance history directly
    return this.dailyGamblingStatsService.getTotalDepositAmount(
      userId,
      startDate,
      endDate,
      platformType,
    );
  }

  private async calculateLossAmount(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Use the daily gambling stats service to get the total loss amount
    // This uses the aggregated data from the daily_gambling_stats table
    // which is more efficient than querying the balance history directly
    return this.dailyGamblingStatsService.getTotalLossAmount(
      userId,
      startDate,
      endDate,
      platformType,
    );
  }

  /**
   * Calculate the total wager amount for a user within a given period
   */
  private async calculateWagerAmount(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Use the daily gambling stats service to get the total wager amount
    // This returns amount in cents, so we need to convert to dollars
    const wagerAmountCents = await this.dailyGamblingStatsService.getTotalWagersForPeriod(
      userId,
      startDate,
      endDate,
      platformType,
    );
    // Convert cents to dollars
    return wagerAmountCents / 100;
  }

  /**
   * Format remaining time in a human-readable format
   */
  formatRemainingTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;

    let result = '';

    if (days > 0) {
      result += `${days} day${days !== 1 ? 's' : ''}`;
    }

    if (remainingHours > 0) {
      result += result ? ', ' : '';
      result += `${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }

    if (remainingMinutes > 0) {
      result += result ? ', ' : '';
      result += `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }

    return result || 'less than a minute';
  }

  /**
   * Extend a cooldown to a temporary or permanent self-exclusion
   * Only allowed during the 24-hour post-cooldown window
   *
   * @param userId User ID
   * @param cooldownId ID of the cooldown to extend
   * @param durationDays Duration in days (1, 7, 30, 180) or null for permanent
   * @param platformType Platform type (SPORTS, CASINO, or PLATFORM)
   * @returns The newly created self-exclusion
   */
  async extendSelfExclusion(
    userId: string,
    cooldownId: string,
    durationDays: 1 | 7 | 30 | 180 | null,
    platformType: PlatformTypeEnum,
    userEmail: string,
  ): Promise<SelfExclusionEntity> {
    // Validate cooldown ID format
    if (!isUUID(cooldownId)) {
      throw new BadRequestException('Invalid cooldown ID format');
    }

    // Find the cooldown and verify it belongs to the user
    const cooldown = await this.selfExclusionRepository.findOne({
      where: { id: cooldownId, userId },
    });

    if (!cooldown) {
      throw new NotFoundException('Cooldown not found');
    }

    // Verify it's a cooldown type
    if (cooldown.type !== SelfExclusionTypeEnum.COOLDOWN) {
      throw new BadRequestException('Only cooldown exclusions can be extended');
    }

    // Verify it's in the post-cooldown window
    const now = new Date();

    if (!cooldown.postCooldownWindowEnd) {
      throw new BadRequestException(
        'This cooldown is not in the post-cooldown window. You can only extend a cooldown within 24 hours after it expires.',
      );
    }

    if (cooldown.postCooldownWindowEnd < now) {
      throw new BadRequestException(
        'The post-cooldown window has expired. You can no longer extend this cooldown.',
      );
    }

    // Verify platform type matches
    if (cooldown.platformType !== platformType) {
      throw new BadRequestException(
        `Platform type mismatch. This cooldown is for ${cooldown.platformType}, but you requested ${platformType}`,
      );
    }

    // Delete the cooldown record
    await this.selfExclusionRepository.remove(cooldown);

    // Calculate end date for temporary exclusion
    let endDate: Date | undefined;
    let exclusionType: SelfExclusionTypeEnum;

    if (durationDays === null) {
      // Permanent exclusion
      exclusionType = SelfExclusionTypeEnum.PERMANENT;
      endDate = undefined;
    } else {
      // Temporary exclusion
      exclusionType = SelfExclusionTypeEnum.TEMPORARY;
      endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);
    }

    // Create the new self-exclusion
    const newExclusion = this.selfExclusionRepository.create({
      userId,
      type: exclusionType,
      platformType,
      startDate: now,
      endDate,
      isActive: true,
    });

    const savedExclusion = await this.selfExclusionRepository.save(newExclusion);

    // Send confirmation email
    try {
      const durationText =
        durationDays === null
          ? 'permanent'
          : durationDays === 1
            ? '1 day'
            : durationDays === 7
              ? '1 week'
              : durationDays === 30
                ? '1 month'
                : '6 months';

      await this.mailgunService.sendTemplateEmail(
        userEmail,
        EmailTemplateEnum.SELF_EXCLUSION_EXTENDED,
        {
          duration: durationText,
          platformType: platformType.toLowerCase(),
          endDate: endDate?.toISOString() || 'N/A',
          exclusionType: exclusionType.toLowerCase(),
        },
      );
    } catch (emailError) {
      // Log email error but don't fail the operation
      this.logger.error(
        `Failed to send self-exclusion extension confirmation email to ${userEmail}`,
        emailError instanceof Error ? emailError.stack : emailError,
      );
    }

    this.logger.log(
      `User ${userId} extended cooldown ${cooldownId} to ${exclusionType} (${durationDays === null ? 'permanent' : `${durationDays} days`})`,
    );

    return savedExclusion;
  }

  /**
   * Automatically expire self-exclusions that have passed their end date.
   * This method is called by the BullMQ job processor every 5 minutes in production.
   *
   * NOTE: This method is intentionally kept public to allow direct calls in E2E tests
   * for faster synchronous testing. In production, it's invoked via BullMQ queue
   * which ensures cluster safety (only one worker processes the job).
   *
   * For COOLDOWN exclusions:
   * - When endDate expires: Sets postCooldownWindowEnd to now + 24h (user enters post-cooldown window)
   * - When postCooldownWindowEnd expires: Deletes the record (silent revert to normal)
   *
   * For TEMPORARY exclusions:
   * - When endDate expires: Sets isActive = false
   */
  async expireOutdatedSelfExclusions(): Promise<void> {
    try {
      const now = new Date();

      // 1. Find expired cooldowns that need to enter post-cooldown window
      const expiredCooldowns = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.COOLDOWN,
          isActive: true,
          endDate: LessThan(now),
          postCooldownWindowEnd: IsNull(),
        },
      });

      if (expiredCooldowns.length > 0) {
        this.logger.log(
          `Found ${expiredCooldowns.length} expired cooldown(s) entering post-cooldown window`,
        );

        for (const cooldown of expiredCooldowns) {
          // Set post-cooldown window to expire in 24 hours
          const windowEnd = new Date();
          windowEnd.setHours(windowEnd.getHours() + 24);

          cooldown.postCooldownWindowEnd = windowEnd;
          await this.selfExclusionRepository.save(cooldown);

          this.logger.log(
            `Cooldown ${cooldown.id} for user ${cooldown.userId} entered post-cooldown window until ${windowEnd.toISOString()}`,
          );
        }
      }

      // 2. Find cooldowns with expired post-cooldown windows (silent revert to normal)
      const expiredWindows = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.COOLDOWN,
          isActive: true,
          postCooldownWindowEnd: LessThan(now),
        },
      });

      if (expiredWindows.length > 0) {
        this.logger.log(
          `Found ${expiredWindows.length} post-cooldown window(s) expired - silently reverting to normal`,
        );

        for (const cooldown of expiredWindows) {
          await this.selfExclusionRepository.remove(cooldown);
          this.logger.log(
            `Deleted cooldown ${cooldown.id} for user ${cooldown.userId} - silent revert to normal`,
          );
        }
      }

      // 3. Find expired temporary exclusions and deactivate them
      const expiredTemporary = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.TEMPORARY,
          isActive: true,
          endDate: LessThan(now),
        },
      });

      if (expiredTemporary.length > 0) {
        this.logger.log(
          `Found ${expiredTemporary.length} expired temporary exclusion(s) to deactivate`,
        );

        for (const exclusion of expiredTemporary) {
          exclusion.isActive = false;
          await this.selfExclusionRepository.save(exclusion);
          this.logger.log(
            `Deactivated expired temporary self-exclusion for user ${exclusion.userId} (ID: ${exclusion.id})`,
          );
        }
      }

      // 4. Delete limits with expired removal countdown (24h passed since removal request)
      const limitsToRemove = await this.selfExclusionRepository.find({
        where: {
          type: In([
            SelfExclusionTypeEnum.DEPOSIT_LIMIT,
            SelfExclusionTypeEnum.LOSS_LIMIT,
            SelfExclusionTypeEnum.WAGER_LIMIT,
          ]),
          removalRequestedAt: Not(IsNull()),
        },
      });

      if (limitsToRemove.length > 0) {
        let removedCount = 0;

        for (const limit of limitsToRemove) {
          if (!limit.removalRequestedAt) continue;

          // Calculate when the 24-hour countdown expires
          const removalTime = new Date(limit.removalRequestedAt);
          removalTime.setHours(removalTime.getHours() + 24);

          // If 24 hours have passed, delete the limit
          if (removalTime <= now) {
            await this.selfExclusionRepository.remove(limit);
            removedCount++;
            this.logger.log(
              `Removed ${limit.type} limit ${limit.id} for user ${limit.userId} after 24h countdown`,
            );
          }
        }

        if (removedCount > 0) {
          this.logger.log(
            `Deleted ${removedCount} limit(s) with expired 24-hour removal countdown`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Error expiring outdated self-exclusions',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * TEST HELPER METHODS
   * Only for development/staging - allow testing without waiting 24 hours
   */

  /**
   * Expire a cooldown and start the post-cooldown window (for testing)
   * Sets endDate to 1 hour ago and postCooldownWindowEnd to 24 hours from now
   */
  async testExpireCooldown(exclusionId: string): Promise<SelfExclusionEntity> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id: exclusionId, type: SelfExclusionTypeEnum.COOLDOWN },
    });

    if (!exclusion) {
      throw new NotFoundException('Cooldown not found');
    }

    // Set endDate to 1 hour ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    exclusion.endDate = pastDate;

    // Set postCooldownWindowEnd to 24 hours from now
    const windowEnd = new Date();
    windowEnd.setHours(windowEnd.getHours() + 24);
    exclusion.postCooldownWindowEnd = windowEnd;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Expired cooldown ${exclusionId} and started post-cooldown window`);

    return exclusion;
  }

  /**
   * Expire the post-cooldown window (for testing)
   * Sets postCooldownWindowEnd to 1 hour ago to trigger silent revert on next cron
   */
  async testExpireWindow(exclusionId: string): Promise<void> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id: exclusionId },
    });

    if (!exclusion) {
      throw new NotFoundException('Exclusion not found');
    }

    // Set postCooldownWindowEnd to 1 hour ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    exclusion.postCooldownWindowEnd = pastDate;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Expired post-cooldown window for ${exclusionId}`);
  }

  /**
   * Expire the removal countdown (for testing)
   * Sets removalRequestedAt to 25 hours ago to trigger deletion on next cron
   */
  async testExpireRemoval(exclusionId: string): Promise<void> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id: exclusionId },
    });

    if (!exclusion) {
      throw new NotFoundException('Exclusion not found');
    }

    // Set removalRequestedAt to 25 hours ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 25);
    exclusion.removalRequestedAt = pastDate;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Set removal countdown to expired for ${exclusionId}`);
  }
}
