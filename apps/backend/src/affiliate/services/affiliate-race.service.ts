import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  BalanceOperationEnum,
  RaceDurationEnum,
  RaceEntity,
  RaceStatusEnum,
  RaceTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BalanceService } from '../../balance/balance.service';
import { RaceLeaderboardDto } from '../../bonus/dto/race-leaderboard.dto';
import { IRaceDto } from '../../bonus/dto/race.dto';
import { RaceService } from '../../bonus/services/race.service';
import { SponsorRaceNotificationService } from '../../bonus/services/sponsor-race-notification.service';
import { UsersService } from '../../users/users.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { ICreateAffiliateRaceInput } from '../dto/create-affiliate-race.input';

@Injectable()
export class AffiliateRaceService {
  private readonly logger = new Logger(AffiliateRaceService.name);

  constructor(
    @InjectRepository(RaceEntity)
    private readonly raceRepo: Repository<RaceEntity>,
    private readonly balanceService: BalanceService,
    private readonly usersService: UsersService,
    private readonly raceService: RaceService,
    private readonly dataSource: DataSource,
    private readonly sponsorRaceNotificationService: SponsorRaceNotificationService,
    private readonly notificationService: NotificationService,
  ) {}

  async createAffiliateRace(userId: string, input: ICreateAffiliateRaceInput): Promise<IRaceDto> {
    // 1. Validate XOR: either asset or fiat
    if ((input.asset && input.fiat) || (!input.asset && !input.fiat)) {
      throw new BadRequestException('Must provide either asset or fiat, not both');
    }

    // 2. Validate user exists
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3. Validate referralCode ownership (case-insensitive lookup)
    const campaignRepo = this.raceRepo.manager.getRepository(AffiliateCampaignEntity);
    const campaign = await campaignRepo
      .createQueryBuilder('campaign')
      .where('LOWER(campaign.code) = LOWER(:code)', { code: input.referralCode })
      .select(['campaign.id', 'campaign.userId', 'campaign.code'])
      .getOne();

    if (!campaign) {
      throw new BadRequestException(
        `Referral code '${input.referralCode}' does not exist. Please create an affiliate campaign first.`,
      );
    }

    if (campaign.userId !== userId) {
      throw new ForbiddenException(
        `Referral code '${input.referralCode}' belongs to another user. You can only create races for your own campaigns.`,
      );
    }

    // 4. Check if user already has ACTIVE or PENDING race (with pessimistic lock to prevent race condition)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingRace = await queryRunner.manager
        .getRepository(RaceEntity)
        .createQueryBuilder('race')
        .where('race.sponsorId = :userId', { userId })
        .andWhere('race.status IN (:...statuses)', {
          statuses: [RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING],
        })
        .select(['race.id', 'race.name', 'race.status'])
        .setLock('pessimistic_write')
        .getOne();

      // Validate BEFORE committing - if race exists, rollback and throw error
      if (existingRace) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException(
          `Cannot create new race. You already have a ${existingRace.status} race: "${existingRace.name}". Please wait until it ends.`,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      // Rollback transaction on any error
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        // Transaction might be already committed/rolled back, ignore
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 5. Validate race duration BEFORE any financial operations
    // TEST: Use 10-min activation instead of next hour
    const startsAt = this.raceService.getNext10MinStart();
    const endsAt = new Date(
      startsAt.getTime() + this.raceService.getDurationInMs(input.raceDuration),
    );

    if (endsAt <= startsAt) {
      throw new BadRequestException('Invalid race duration: endsAt must be after startsAt');
    }

    // 6. Calculate prize pool
    const prizePool = input.prizes.reduce((sum, prize) => sum + prize, 0);

    // 7. Deduct balance (BalanceService throws InsufficientBalanceError if not enough funds)
    // NOTE: Always send positive amounts to updateBalance/updateFiatBalance
    // BalanceService determines if amount should be deducted or added based on operation type:
    // - RACE_CREATION operation automatically negates the amount (deduction)
    // - updateFiatBalance needs positive amount; BalanceService will negate based on operation
    // If balance is insufficient, BalanceService throws an error and race creation fails
    if (input.asset) {
      const result = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.RACE_CREATION,
        operationId: uuidv4(),
        userId,
        amount: new BigNumber(prizePool),
        asset: input.asset,
        description: `Affiliate race creation - ${input.raceDuration}`,
        metadata: { referralCode: input.referralCode },
      });

      if (!result.success) {
        const error = result.error || result.status;
        throw new BadRequestException(`Balance operation failed: ${error}`);
      }
    } else if (input.fiat) {
      // Use BigNumber for cents conversion to avoid integer overflow
      // Send positive amount - updateFiatBalance will handle deduction based on operation type
      const prizePoolCents = new BigNumber(prizePool).times(100).integerValue().toString();
      const result = await this.balanceService.updateFiatBalance({
        operation: BalanceOperationEnum.RACE_CREATION,
        operationId: uuidv4(),
        userId,
        amount: prizePoolCents,
        currency: input.fiat as any,
        description: `Affiliate race creation - ${input.raceDuration}`,
        metadata: { referralCode: input.referralCode },
      });

      if (!result.success) {
        const error = result.error || result.status;
        throw new BadRequestException(`Fiat balance operation failed: ${error}`);
      }
    }

    // 8. Generate race name and slug
    const durationLabel = this.getDurationLabel(input.raceDuration);
    const name = `${user.username}'s ${durationLabel} Race`;
    const slug = await this.raceService.generateUniqueSlug(name);

    // 9. Create race (times already validated above)
    const race = await this.raceRepo.save({
      slug,
      name,
      startsAt,
      endsAt,
      status: RaceStatusEnum.PENDING,
      raceType: RaceTypeEnum.SPONSORED,
      prizePool,
      prizes: input.prizes,
      asset: input.asset ?? null,
      fiat: input.fiat ?? null,
      referralCode: input.referralCode,
      sponsorId: userId,
    });

    this.logger.log(`Affiliate race created: ${race.id} by user ${userId}`);

    void this.sponsorRaceNotificationService.notifyUsersAboutNewRace(race);

    const prizePoolText = race.fiat
      ? `${race.prizePool.toFixed(2)} ${race.fiat}`
      : `${race.prizePool} ${race.asset}`;

    // Save to database for notification history
    void this.notificationService.sendToUserAndSave(userId, {
      type: 'race_created_success',
      title: 'Race Created Successfully!',
      message: `Success! Your race has been created for ${prizePoolText}.`,
      data: {
        raceId: race.id,
        raceName: race.name,
        slug: race.slug,
        prizePool: race.prizePool,
        asset: race.asset,
        fiat: race.fiat,
        startsAt: race.startsAt.toISOString(),
        endsAt: race.endsAt.toISOString(),
      },
    });

    // Send real-time WebSocket notification (using vip_level_up type to preserve title/message)
    this.notificationService.sendToUser(userId, {
      type: 'vip_level_up',
      title: 'Race Created Successfully!',
      message: `Success! Your race has been created for ${prizePoolText}.`,
      data: {
        raceId: race.id,
        raceName: race.name,
        slug: race.slug,
        prizePool: race.prizePool,
        asset: race.asset,
        fiat: race.fiat,
        startsAt: race.startsAt.toISOString(),
        endsAt: race.endsAt.toISOString(),
      },
    });

    return {
      id: race.id,
      slug: race.slug,
      name: race.name,
      status: race.status,
      prizePool: race.prizePool,
      prizes: race.prizes,
      asset: race.asset,
      fiat: race.fiat,
      startsAt: race.startsAt.toISOString(),
      endsAt: race.endsAt.toISOString(),
      sponsorId: race.sponsorId,
      referralCode: race.referralCode,
    };
  }

  async getUserAffiliateRaces(userId: string): Promise<{ races: RaceLeaderboardDto[] }> {
    const races: RaceLeaderboardDto[] = [];

    // 1. Get current PENDING or ACTIVE race (max 1)
    const currentRace = await this.raceRepo.findOne({
      where: [
        { sponsorId: userId, status: RaceStatusEnum.PENDING },
        { sponsorId: userId, status: RaceStatusEnum.ACTIVE },
      ],
      order: { createdAt: 'DESC' },
    });

    if (currentRace) {
      const leaderboard = await this.raceService.getRaceLeaderboard(currentRace.id, 20);
      races.push(leaderboard);
    }

    // 2. Get last ENDED race (Previous Race)
    const previousRace = await this.raceRepo.findOne({
      where: { sponsorId: userId, status: RaceStatusEnum.ENDED },
      order: { endsAt: 'DESC' },
    });

    if (previousRace) {
      const leaderboard = await this.raceService.getRaceLeaderboard(previousRace.id, 20);
      races.push(leaderboard);
    }

    return {
      races,
    };
  }

  async getAffiliateRaceLeaderboard(userId: string, raceId: string): Promise<RaceLeaderboardDto> {
    // Fetch race to check authorization
    const race = await this.raceRepo.findOne({ where: { id: raceId } });

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    // Check if user is authorized to view this race
    // Only race sponsor can view affiliate race leaderboard
    if (race.sponsorId && race.sponsorId !== userId) {
      throw new ForbiddenException('You are not authorized to view this race');
    }

    // Delegate to RaceService for leaderboard retrieval
    return this.raceService.getRaceLeaderboard(raceId, 20);
  }

  private getDurationLabel(duration: RaceDurationEnum): string {
    const labels: Record<RaceDurationEnum, string> = {
      [RaceDurationEnum.ONE_DAY]: '1-Day',
      [RaceDurationEnum.THREE_DAYS]: '3-Day',
      [RaceDurationEnum.SEVEN_DAYS]: 'Weekly',
      [RaceDurationEnum.FOURTEEN_DAYS]: '2-Week',
      [RaceDurationEnum.ONE_MONTH]: 'Monthly',
    };
    return labels[duration];
  }
}
