import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MonthlyRacePrizeEntity,
  RaceDurationEnum,
  RaceEntity,
  RaceParticipantEntity,
  RaceStatusEnum,
  RaceTypeEnum,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';
import { DataSource, In, Repository } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';
import { IRaceHistoryResponseDto } from '../dto/race-history.dto';
import { IRaceLeaderboardDto } from '../dto/race-leaderboard.dto';
import { IRaceDto, IRaceListDto } from '../dto/race.dto';
import { IUserRaceStatsDto } from '../dto/user-race-stats.dto';

/**
 * RaceService - API endpoints and queries for race system
 *
 * CLUSTERED BACKEND ARCHITECTURE:
 * This service runs in the CLUSTERED main backend.
 * It ONLY handles API endpoints and user queries.
 *
 * RESPONSIBILITIES:
 * 1. API endpoints for race queries (leaderboard, stats, list)
 * 2. User race participation management
 * 3. Real-time race data queries (Redis + DB fallback)
 * 4. Weekly race initialization on startup (ensureWeeklyRaceExists)
 *
 * WHAT THIS SERVICE DOES NOT DO:
 * - Cron jobs (handled by race-service RaceFinalizationService)
 * - Wager distribution (handled by race-service RaceWagerDistributionService)
 * - Periodic database flushes (handled by race-service)
 */
@Injectable()
export class RaceService implements OnModuleInit {
  private readonly logger = new Logger(RaceService.name);

  // Redis key constants - centralized for consistency
  private readonly RACE_WAGERS_KEY_PREFIX = 'race:wagers:';
  private readonly USER_RACES_KEY_PREFIX = 'user:races:';
  private readonly RACE_LOCK_KEY_PREFIX = 'race-lock:';

  constructor(
    @InjectRepository(RaceEntity)
    private readonly raceRepo: Repository<RaceEntity>,
    @InjectRepository(RaceParticipantEntity)
    private readonly raceParticipantRepo: Repository<RaceParticipantEntity>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureWeeklyRaceExists();
      await this.ensureMonthlyRaceExists();
    } catch (error) {
      this.logger.error('Failed to ensure races exist on startup:', error);
    }
  }

  async ensureWeeklyRaceExists(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}ensure-weekly-race`;
    const lockTTL = 30;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is ensuring weekly race');
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const activeWeeklyRace = await manager.findOne(RaceEntity, {
          where: {
            raceType: RaceTypeEnum.WEEKLY,
            status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
          },
        });

        if (activeWeeklyRace) {
          // Check if race has expired (missed cron execution)
          const now = new Date();
          if (activeWeeklyRace.endsAt <= now) {
            this.logger.warn(
              `Found expired weekly race ${activeWeeklyRace.id}, marking as FINALIZING`,
            );
            await manager.update(
              RaceEntity,
              { id: activeWeeklyRace.id },
              { status: RaceStatusEnum.FINALIZING },
            );
            // Don't return - continue to create new race
          } else {
            this.logger.log(`Active/Pending weekly race already exists: ${activeWeeklyRace.id}`);
            return;
          }
        }

        this.logger.warn('No active weekly race found, creating one...');

        const now = new Date();
        const minutes = now.getMinutes();
        const floorInterval = Math.floor(minutes / 10) * 10;
        const testStartsAt = new Date(now);
        testStartsAt.setMinutes(floorInterval, 0, 0);
        const testEndsAt = new Date(testStartsAt.getTime() + 30 * 60 * 1000);

        const prizes = await manager.find(WeeklyRacePrizeEntity, {
          order: { place: 'ASC' },
        });

        const prizeAmounts = prizes.map((p) => parseFloat(p.amountUsd));
        const prizePool = prizeAmounts.reduce((sum, amount) => sum + amount, 0);

        const name = 'Weekly Race';
        const slug = await this.generateUniqueSlug(name);

        const race = manager.create(RaceEntity, {
          slug,
          name,
          startsAt: testStartsAt,
          endsAt: testEndsAt,
          status: RaceStatusEnum.ACTIVE,
          raceType: RaceTypeEnum.WEEKLY,
          prizePool,
          prizes: prizeAmounts,
          asset: null,
          fiat: 'USD',
          referralCode: null,
          sponsorId: null,
        });

        await manager.save(race);

        this.logger.log(
          `Weekly race created on startup: ${race.id} (${testStartsAt.toISOString()} - ${testEndsAt.toISOString()})`,
        );
      });
    } catch (error) {
      this.logger.error('Error ensuring weekly race exists:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  async ensureMonthlyRaceExists(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}ensure-monthly-race`;
    const lockTTL = 30;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is ensuring monthly race');
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const activeMonthlyRace = await manager.findOne(RaceEntity, {
          where: {
            raceType: RaceTypeEnum.MONTHLY,
            status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
          },
        });

        if (activeMonthlyRace) {
          // Check if race has expired (missed cron execution)
          const now = new Date();
          if (activeMonthlyRace.endsAt <= now) {
            this.logger.warn(
              `Found expired monthly race ${activeMonthlyRace.id}, marking as FINALIZING`,
            );
            await manager.update(
              RaceEntity,
              { id: activeMonthlyRace.id },
              { status: RaceStatusEnum.FINALIZING },
            );
            // Don't return - continue to create new race
          } else {
            this.logger.log(`Active/Pending monthly race already exists: ${activeMonthlyRace.id}`);
            return;
          }
        }

        this.logger.warn('No active monthly race found, creating one...');

        const now = new Date();
        const minutes = now.getMinutes();
        const floorInterval = Math.floor(minutes / 10) * 10;
        const testStartsAt = new Date(now);
        testStartsAt.setMinutes(floorInterval, 0, 0);
        const testEndsAt = new Date(testStartsAt.getTime() + 50 * 60 * 1000);

        const prizes = await manager.find(MonthlyRacePrizeEntity, {
          order: { place: 'ASC' },
        });

        const prizeAmounts = prizes.map((p) => parseFloat(p.amountUsd));
        const prizePool = prizeAmounts.reduce((sum, amount) => sum + amount, 0);

        const name = 'Monthly Race';
        const slug = await this.generateUniqueSlug(name);

        const race = manager.create(RaceEntity, {
          slug,
          name,
          startsAt: testStartsAt,
          endsAt: testEndsAt,
          status: RaceStatusEnum.ACTIVE,
          raceType: RaceTypeEnum.MONTHLY,
          prizePool,
          prizes: prizeAmounts,
          asset: null,
          fiat: 'USD',
          referralCode: null,
          sponsorId: null,
        });

        await manager.save(race);

        this.logger.log(
          `Monthly race created on startup: ${race.id} (${testStartsAt.toISOString()} - ${testEndsAt.toISOString()})`,
        );
      });
    } catch (error) {
      this.logger.error('Error ensuring monthly race exists:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * List available races for participants (simplified)
   * Returns: weekly race + monthly race + user's sponsored/affiliate races (if has referral code)
   * Order: WEEKLY → MONTHLY → SPONSORED
   */
  async listAvailableRaces(userReferralCode?: string): Promise<IRaceListDto> {
    const whereConditions: any[] = [
      {
        raceType: RaceTypeEnum.WEEKLY,
        status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
      },
      {
        raceType: RaceTypeEnum.MONTHLY,
        status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
      },
    ];

    const races = await this.raceRepo.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });

    if (userReferralCode) {
      const lastSponsoredRace = await this.raceRepo.findOne({
        where: {
          raceType: RaceTypeEnum.SPONSORED,
          referralCode: userReferralCode,
        },
        order: { createdAt: 'DESC' },
      });

      if (lastSponsoredRace) {
        const isPendingOrActive =
          lastSponsoredRace.status === RaceStatusEnum.PENDING ||
          lastSponsoredRace.status === RaceStatusEnum.ACTIVE;

        if (isPendingOrActive) {
          races.push(lastSponsoredRace);
        } else {
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

          if (lastSponsoredRace.endsAt >= threeDaysAgo) {
            races.push(lastSponsoredRace);
          }
        }
      }
    }

    const raceTypeOrder = {
      [RaceTypeEnum.WEEKLY]: 1,
      [RaceTypeEnum.MONTHLY]: 2,
      [RaceTypeEnum.SPONSORED]: 3,
    };

    races.sort((a, b) => {
      const orderA = raceTypeOrder[a.raceType] ?? 4;
      const orderB = raceTypeOrder[b.raceType] ?? 4;
      return orderA - orderB;
    });

    return {
      races: races.map((r) => this.toRaceDto(r)),
    };
  }

  /**
   * Get race leaderboard with full race details (reads from Redis for real-time data)
   * Falls back to DB if Redis data is not available
   */
  async getRaceLeaderboard(raceId: string, limit = 100): Promise<IRaceLeaderboardDto> {
    const race = await this.raceRepo.findOne({ where: { id: raceId } });
    if (!race) {
      throw new NotFoundException('Race not found');
    }

    // Try to get leaderboard from Redis first (real-time data)
    const client = this.redisService.getClient();
    const redisKey = `${this.RACE_WAGERS_KEY_PREFIX}${raceId}`;

    // Get top N participants from Redis sorted set (highest scores first)
    const redisLeaderboard = await client.zrevrange(redisKey, 0, limit - 1, 'WITHSCORES');

    let leaderboard: any[] = [];

    if (redisLeaderboard && redisLeaderboard.length > 0) {
      // Redis data available - use it for real-time leaderboard
      const userIds: string[] = [];
      const wagers: Record<string, number> = {};

      for (let i = 0; i < redisLeaderboard.length; i += 2) {
        const userId = redisLeaderboard[i];
        const wageredCents = parseInt(redisLeaderboard[i + 1], 10);
        userIds.push(userId);
        wagers[userId] = wageredCents;
      }

      // Fetch only necessary user fields (id, username, isPrivate) for performance
      const { UserEntity } = await import('@zetik/shared-entities');
      const users = await this.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .where('user.id IN (:...userIds)', { userIds })
        .select(['user.id', 'user.username', 'user.isPrivate'])
        .getMany();

      const userMap = new Map(users.map((u) => [u.id, u]));

      leaderboard = userIds.map((userId, index) => {
        const place = index + 1;
        const prize = place <= race.prizes.length ? race.prizes[place - 1] : 0;
        const user = userMap.get(userId);

        // Hide user info if private
        const userInfo = user?.isPrivate
          ? null
          : {
              id: userId,
              userName: user?.username || 'Anonymous',
              levelImageUrl: '',
            };

        return {
          place,
          user: userInfo,
          wagered: (BigInt(wagers[userId]) / 100n).toString(),
          totalWageredCents: wagers[userId],
          prize,
        };
      });
    } else {
      // Fallback to DB if Redis data is not available
      const participants = await this.raceParticipantRepo
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.user', 'user')
        .where('rp.raceId = :raceId', { raceId })
        .orderBy('rp.totalWageredCents', 'DESC')
        .limit(limit)
        .getMany();

      leaderboard = participants.map((p, index) => {
        const place = index + 1;
        const prize = place <= race.prizes.length ? race.prizes[place - 1] : 0;
        const wagerCents = BigInt(p.totalWageredCents);

        // Hide user info if private
        const userInfo = p.user?.isPrivate
          ? null
          : {
              id: p.user.id,
              userName: p.user.username || 'Anonymous',
              levelImageUrl: '',
            };

        return {
          place,
          user: userInfo,
          wagered: (wagerCents / 100n).toString(),
          // Keep as string if exceeds safe integer range
          totalWageredCents:
            wagerCents > BigInt(Number.MAX_SAFE_INTEGER)
              ? wagerCents.toString()
              : Number(wagerCents),
          prize,
        };
      });
    }

    // Fill remaining leaderboard spots with placeholders up to prizes.length
    if (leaderboard.length < race.prizes.length) {
      for (let i = leaderboard.length; i < race.prizes.length; i++) {
        leaderboard.push({
          place: i + 1,
          user: null,
          wagered: '0',
          totalWageredCents: 0,
          prize: race.prizes[i],
        });
      }
    }

    // Get total participants count
    const participantsCount = await this.raceParticipantRepo.count({
      where: { raceId: race.id },
    });

    return {
      id: race.id,
      slug: race.slug,
      name: race.name,
      status: race.status,
      startsAt: race.startsAt.toISOString(),
      endTime: race.endsAt.toISOString(),
      prizePool: race.prizePool,
      winnersCount: race.prizes.length,
      asset: race.asset,
      fiat: race.fiat,
      sponsorId: race.sponsorId,
      referralCode: race.referralCode,
      participantsCount,
      leaderboard,
    };
  }

  /**
   * Get race leaderboard by referralCode
   */
  async getRaceLeaderboardByReferralCode(
    referralCode: string,
    limit = 100,
  ): Promise<IRaceLeaderboardDto> {
    const race = await this.raceRepo.findOne({
      where: {
        referralCode,
        status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
      },
    });

    if (!race) {
      throw new NotFoundException(`Active race not found with referral code: ${referralCode}`);
    }

    return this.getRaceLeaderboard(race.id, limit);
  }

  /**
   * Get user's race statistics (reads from Redis for real-time data)
   * Falls back to DB if Redis data is not available
   */
  async getUserRaceStats(raceId: string, userId: string): Promise<IUserRaceStatsDto | null> {
    const race = await this.raceRepo.findOne({ where: { id: raceId } });
    if (!race) {
      throw new NotFoundException('Race not found');
    }

    const client = this.redisService.getClient();
    const redisKey = `${this.RACE_WAGERS_KEY_PREFIX}${raceId}`;

    // Try to get user's score from Redis sorted set
    const userScore = await client.zscore(redisKey, userId);

    if (userScore !== null) {
      // Redis data available - calculate place from Redis using ZREVRANK for deterministic placement
      const wageredCents = parseInt(userScore, 10);

      // Use ZREVRANK to get consistent rank even with tied scores
      const rank = await client.zrevrank(redisKey, userId);
      const userPlace = rank !== null ? rank + 1 : null;

      if (userPlace === null) {
        return null;
      }

      const prize = userPlace <= race.prizes.length ? race.prizes[userPlace - 1] : null;

      return {
        place: userPlace,
        wagered: (BigInt(wageredCents) / 100n).toString(),
        prize,
        asset: race.asset,
        fiat: race.fiat,
      };
    }

    // Fallback to DB if Redis data is not available
    const participant = await this.raceParticipantRepo.findOne({
      where: { raceId, userId },
    });

    if (!participant) {
      return null;
    }

    const place = await this.raceParticipantRepo
      .createQueryBuilder('rp')
      .where('rp.raceId = :raceId', { raceId })
      .andWhere('rp.totalWageredCents > :wagered', {
        wagered: participant.totalWageredCents,
      })
      .getCount();

    const userPlace = place + 1;
    const prize = userPlace <= race.prizes.length ? race.prizes[userPlace - 1] : null;

    return {
      place: userPlace,
      wagered: (BigInt(participant.totalWageredCents) / 100n).toString(),
      prize,
      asset: race.asset,
      fiat: race.fiat,
    };
  }

  async getUserRaceHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<IRaceHistoryResponseDto> {
    const { UserEntity } = await import('@zetik/shared-entities');
    const user = await this.dataSource.getRepository(UserEntity).findOne({ where: { id: userId } });

    if (!user || user.hideRaceStatistics) {
      return { history: [], total: 0, page, limit };
    }

    const skip = (page - 1) * limit;

    const [participants, total] = await this.raceParticipantRepo
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.race', 'race')
      .where('participant.userId = :userId', { userId })
      .andWhere('race.status IN (:...statuses)', {
        statuses: [RaceStatusEnum.ENDED, RaceStatusEnum.FINALIZING],
      })
      .orderBy('race.endsAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const history = participants.map((participant) => ({
      raceId: participant.race.id,
      raceName: participant.race.name,
      raceType: participant.race.raceType,
      status: participant.race.status,
      place: participant.place ?? 99,
      wagered: (BigInt(participant.totalWageredCents) / 100n).toString(),
      prize: participant.reward || 0,
      asset: participant.race.asset,
      fiat: participant.race.fiat,
      endedAt: participant.race.endsAt.toISOString(),
    }));

    return { history, total, page, limit };
  }

  async addUserToActiveRaces(userId: string, referralCode?: string): Promise<void> {
    const weeklyRace = await this.raceRepo.findOne({
      where: {
        raceType: RaceTypeEnum.WEEKLY,
        status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
      },
    });

    if (weeklyRace) {
      await this.raceParticipantRepo.upsert(
        {
          raceId: weeklyRace.id,
          userId: userId,
          totalWageredCents: '0',
          place: null,
          reward: null,
        },
        ['raceId', 'userId'],
      );

      await this.redisService.sAdd(`${this.USER_RACES_KEY_PREFIX}${userId}`, weeklyRace.id);
      this.logger.log(`Added user ${userId} to weekly race ${weeklyRace.id}`);
    }

    if (referralCode) {
      // P1 #11: Add pagination limit to prevent loading too many races
      const affiliateRaces = await this.raceRepo.find({
        where: {
          status: In([RaceStatusEnum.ACTIVE, RaceStatusEnum.PENDING]),
          referralCode: referralCode,
        },
        take: 100, // Reasonable limit for affiliate races per referral code
      });

      // Warn if limit was reached (possible data truncation)
      if (affiliateRaces.length === 100) {
        this.logger.warn(
          `Referral code ${referralCode} has reached the 100 active races limit. User may not be added to all races.`,
        );
      }

      // Batch database upserts to avoid N+1 query
      if (affiliateRaces.length > 0) {
        const participants = affiliateRaces.map((race) => ({
          raceId: race.id,
          userId: userId,
          totalWageredCents: '0',
          place: null,
          reward: null,
        }));

        await this.raceParticipantRepo.upsert(participants, ['raceId', 'userId']);

        // Batch Redis operations using pipeline
        const pipeline = this.redisService.getClient().pipeline();
        for (const race of affiliateRaces) {
          pipeline.sadd(`${this.USER_RACES_KEY_PREFIX}${userId}`, race.id);
        }
        await pipeline.exec();

        await this.redisService.setWithExpiry(`user:refcode:${userId}`, referralCode, 3600);
        this.logger.log(`Added user ${userId} to ${affiliateRaces.length} affiliate races`);
      }
    }
  }

  getDurationInMs(duration: RaceDurationEnum): number {
    // TEST DURATIONS - Shorten for testing
    const durations: Record<RaceDurationEnum, number> = {
      [RaceDurationEnum.ONE_DAY]: 10 * 60 * 1000, // 10 min
      [RaceDurationEnum.THREE_DAYS]: 20 * 60 * 1000, // 20 min
      [RaceDurationEnum.SEVEN_DAYS]: 30 * 60 * 1000, // 30 min
      [RaceDurationEnum.FOURTEEN_DAYS]: 40 * 60 * 1000, // 40 min
      [RaceDurationEnum.ONE_MONTH]: 50 * 60 * 1000, // 50 min
    };
    return durations[duration];
  }

  getNextHourStart(): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  // TEST: For quick race activation (10 min interval instead of 1 hour)
  getNext10MinStart(): Date {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextInterval = Math.ceil((minutes + 1) / 10) * 10;
    const next = new Date(now);

    if (nextInterval >= 60) {
      // Move to next hour
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else {
      next.setMinutes(nextInterval, 0, 0);
    }

    return next;
  }

  async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;
    const maxAttempts = 1000;

    while (await this.raceRepo.findOne({ where: { slug } })) {
      if (counter > maxAttempts) {
        throw new BadRequestException('Unable to generate unique race slug after maximum attempts');
      }
      slug = `${baseSlug}_${counter}`;
      counter++;
    }

    return slug;
  }

  private toRaceDto(race: RaceEntity): IRaceDto {
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
}
