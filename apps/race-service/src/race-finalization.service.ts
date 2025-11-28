import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  calculateNextMonthDates,
  calculateNextWeekDates,
  RaceEntity,
  RaceParticipantEntity,
  RaceStatusEnum,
  RaceTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RaceWagerTrackerService } from '../../backend/src/bonus/services/race-wager-tracker.service';
import { RedisService } from '../../backend/src/common/services/redis.service';
import { CurrencyConverterService } from './services/currency-converter.service';
import { RaceBalanceService } from './services/race-balance.service';

/**
 * Race Finalization Service - Simplified Architecture
 *
 * SEPARATION OF CONCERNS:
 *
 * 1. STATUS TRANSITIONS (different for each race type):
 *    - SPONSORED races: Hourly check if endsAt < now → FINALIZING
 *    - WEEKLY/MONTHLY: Via creation cron (Transaction 1) → FINALIZING
 *
 * 2. PRIZE DISTRIBUTION (universal, same for all):
 *    - Take race in FINALIZING status
 *    - Distribute all prizes (with currency conversion if needed)
 *    - Mark as ENDED
 *
 * This prevents code duplication and makes finalization logic reusable.
 */
@Injectable()
export class RaceFinalizationService {
  private readonly logger = new Logger(RaceFinalizationService.name);
  private readonly RACE_LOCK_KEY_PREFIX = 'race-lock:';

  constructor(
    @InjectRepository(RaceEntity)
    private readonly raceRepo: Repository<RaceEntity>,
    private readonly redisService: RedisService,
    private readonly raceBalanceService: RaceBalanceService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly dataSource: DataSource,
    private readonly raceWagerTrackerService: RaceWagerTrackerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * UNIVERSAL FINALIZATION: Distributes prizes for ANY race in FINALIZING status
   * This method is called AFTER race has been transitioned to FINALIZING by specific logic
   */
  private async distributeRacePrizes(race: RaceEntity): Promise<void> {
    // Idempotency check: if already ENDED, skip
    if (race.status === RaceStatusEnum.ENDED) {
      return;
    }

    await this.raceWagerTrackerService.flushSingleRaceToDatabase(race.id);

    const prizeEvents: any[] = [];

    // Distribute prizes in atomic transaction (including status update to ENDED)
    // Returns true if status was successfully updated to ENDED
    const statusUpdated = await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const raceRepo = manager.getRepository(RaceEntity);
      const participantRepo = manager.getRepository(RaceParticipantEntity);

      // Double-check race is still in FINALIZING (idempotency)
      const currentRace = await raceRepo
        .createQueryBuilder('race')
        .where('race.id = :id', { id: race.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!currentRace || currentRace.status !== RaceStatusEnum.FINALIZING) {
        return false;
      }

      // Get leaderboard
      const leaderboard = await participantRepo.find({
        where: { raceId: race.id },
        order: { totalWageredCents: 'DESC' },
        take: currentRace.prizes.length,
      });

      // Distribute prizes
      for (let i = 0; i < leaderboard.length; i++) {
        const participant = leaderboard[i];
        const place = i + 1;
        const originalReward = new BigNumber(currentRace.prizes[i]);
        let balanceReward = originalReward;

        if (originalReward.isZero() || originalReward.isNaN()) {
          continue;
        }

        const assetToUse = currentRace.asset || AssetTypeEnum.BTC;

        // For fiat races, convert to BTC for user balance
        if (!currentRace.asset && currentRace.fiat) {
          try {
            balanceReward = await this.currencyConverterService.convertFiatToCrypto(
              originalReward,
              currentRace.fiat as CurrencyEnum,
              AssetTypeEnum.BTC,
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to convert fiat prize for user ${participant.userId} in race ${race.id}: ${errorMsg}. Skipping award.`,
              error,
            );
            // Skip this participant - race remains in FINALIZING for manual recovery
            continue;
          }
        }

        // Update user balance with converted amount
        const operationId = uuidv4();
        const balanceUpdateResult = await this.raceBalanceService.updateBalance({
          operation: BalanceOperationEnum.BONUS,
          operationId,
          userId: participant.userId,
          amount: balanceReward,
          asset: assetToUse,
          description: `Race reward - ${currentRace.name} - Place ${place}`,
          metadata: { raceId: race.id, place },
        });

        // Record placement with original prize (not converted)
        await participantRepo.update(
          { raceId: race.id, userId: participant.userId },
          { place, reward: originalReward.toNumber() },
        );

        this.logger.log(
          `Awarded prize to user ${participant.userId}: ${balanceReward} ${assetToUse} (place ${place})`,
        );

        // Store prize event for later emission (after status update)
        prizeEvents.push({
          userId: participant.userId,
          raceName: currentRace.name,
          place,
          prize: currentRace.fiat ? currentRace.prizes[i] : parseFloat(balanceReward.toString()),
          asset: currentRace.asset,
          fiat: currentRace.fiat,
          // Add balance info for notification
          operationId,
          newBalance: balanceUpdateResult.balance,
        });
      }

      // Mark as ENDED after all prizes distributed (atomic with payouts)
      await raceRepo.update({ id: race.id }, { status: RaceStatusEnum.ENDED });

      return true;
    });

    // Only after successful transaction with status update: emit events for notifications
    if (statusUpdated) {
      for (const prizeEvent of prizeEvents) {
        // Publish to Redis pub/sub for backend service notification handler
        // Backend's RacePrizeNotificationService listens to this and sends balance_update notifications to frontend
        await this.redisService
          .getClient()
          .publish('race:prize:awarded', JSON.stringify(prizeEvent));
      }
    }
  }

  /**
   * SPONSORED RACES: Finalization every 10 minutes (for testing)
   * Status transition: ACTIVE → FINALIZING (if endsAt < now)
   * Then calls universal distribution
   */
  @Cron('0 */10 * * * *') // Every 10 minutes for testing
  async finalizeEndedRaces(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}finalize-ended`;
    const lockTTL = 300;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is finalizing ended races');
      return;
    }

    try {
      const now = new Date();

      // Find all ACTIVE races where endsAt < now (use raw SQL for reliable date comparison)
      const query = `
        SELECT * FROM bonus.races
        WHERE status = $1 AND "raceType" != $2 AND "endsAt" <= $3::timestamp
        LIMIT 100
      `;
      const endedRaces = await this.dataSource.query(query, [
        RaceStatusEnum.ACTIVE,
        RaceTypeEnum.WEEKLY,
        now.toISOString(),
      ]);

      // Also exclude MONTHLY from this cron (handled separately)
      const sponsoredRaces = endedRaces.filter((r: any) => r.raceType !== RaceTypeEnum.MONTHLY);

      if (sponsoredRaces.length === 0) {
        return;
      }

      this.logger.log(`Found ${sponsoredRaces.length} sponsored races to finalize`);

      for (const raceData of sponsoredRaces) {
        try {
          // Step 1: ACTIVE → FINALIZING (atomic transaction)
          await this.dataSource.transaction(async (manager) => {
            const raceRepo = manager.getRepository(RaceEntity);
            const race = await raceRepo.findOne({ where: { id: raceData.id } });

            if (!race || race.status !== RaceStatusEnum.ACTIVE) {
              this.logger.warn(`Race ${raceData.id} already finalized, skipping`);
              return;
            }

            await raceRepo.update({ id: raceData.id }, { status: RaceStatusEnum.FINALIZING });
            this.logger.log(`Race ${raceData.id} marked as FINALIZING`);
          });

          // Step 2: Distribute prizes (universal method)
          const race = await this.raceRepo.findOne({ where: { id: raceData.id } });
          if (race) {
            await this.distributeRacePrizes(race);
          }
        } catch (error) {
          this.logger.error(`Error finalizing race ${raceData.id}:`, error);
          // Race remains in FINALIZING - manual intervention possible
        }
      }
    } catch (error) {
      this.logger.error('Error in finalizeEndedRaces:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * WEEKLY RACES: Creation + status transition
   * Transaction 1: ACTIVE weekly → FINALIZING, create new ACTIVE
   * Transaction 2: Distribute prizes for FINALIZING
   * TEST: Changed to every 10 minutes for testing
   */
  @Cron('0 */10 * * * *')
  async createWeeklyRace(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}create-weekly`;
    const lockTTL = 60;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is creating weekly race');
      return;
    }

    try {
      this.logger.log('Creating weekly race...');

      let finalizingWeeklyRace: RaceEntity | undefined;

      // TRANSACTION 1: Mark old as FINALIZING + create new ACTIVE
      await this.dataSource.transaction(async (manager) => {
        const raceRepo = manager.getRepository(RaceEntity);

        // Find old ACTIVE weekly race
        const oldRace = await raceRepo.findOne({
          where: {
            raceType: RaceTypeEnum.WEEKLY,
            status: RaceStatusEnum.ACTIVE,
          },
        });

        if (oldRace) {
          const now = new Date();
          if (oldRace.endsAt > now) {
            this.logger.debug(
              `Weekly race ${oldRace.id} is still active (ends at ${oldRace.endsAt.toISOString()}), skipping creation`,
            );
            return;
          }
          await raceRepo.update({ id: oldRace.id }, { status: RaceStatusEnum.FINALIZING });
          finalizingWeeklyRace = oldRace;
          this.logger.log(`Old weekly race marked FINALIZING: ${oldRace.id}`);
        }

        // Safety check: no ACTIVE weekly should exist now
        const activeCount = await raceRepo.countBy({
          raceType: RaceTypeEnum.WEEKLY,
          status: RaceStatusEnum.ACTIVE,
        });

        if (activeCount > 0) {
          this.logger.error('Multiple ACTIVE weekly races detected, aborting creation');
          return;
        }

        // Create new ACTIVE race
        const prizes = await this.dataSource.query(
          'SELECT * FROM bonus.weekly_race_prizes ORDER BY place ASC',
        );

        if (prizes.length === 0) {
          this.logger.error('No weekly race prizes configured');
          return;
        }

        const prizePool = prizes.reduce((sum: number, p: any) => sum + Number(p.amountUsd), 0);
        const { startsAt, endsAt } = calculateNextWeekDates();

        const name = 'Weekly Race';
        const slug = await this.generateUniqueSlug(name);

        const newRace = await raceRepo.save({
          slug,
          name,
          startsAt,
          endsAt,
          status: RaceStatusEnum.ACTIVE,
          raceType: RaceTypeEnum.WEEKLY,
          prizePool,
          prizes: prizes.map((p: any) => Number(p.amountUsd)),
          asset: null,
          fiat: 'USD',
          referralCode: null,
          sponsorId: null,
        });

        this.logger.log(`New weekly race created: ${newRace.id}`);

        this.eventEmitter.emit('race:created', {
          raceId: newRace.id,
          raceName: newRace.name,
          startsAt: newRace.startsAt,
          endsAt: newRace.endsAt,
        });
      });

      // TRANSACTION 2: Distribute prizes if old race existed
      if (finalizingWeeklyRace) {
        try {
          this.logger.log(`Distributing prizes for weekly race: ${finalizingWeeklyRace.id}`);
          await this.distributeRacePrizes(finalizingWeeklyRace);
        } catch (error) {
          this.logger.error(
            `Failed to distribute weekly race prizes (${finalizingWeeklyRace.id}):`,
            error,
          );
          // Race remains FINALIZING for manual recovery
        }
      }
    } catch (error) {
      this.logger.error('Error in createWeeklyRace:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * MONTHLY RACES: Creation + status transition
   * Transaction 1: ACTIVE monthly → FINALIZING, create new ACTIVE
   * Transaction 2: Distribute prizes for FINALIZING
   * TEST: Changed to every 10 minutes for testing
   */
  @Cron('0 */10 * * * *')
  async createMonthlyRace(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}create-monthly`;
    const lockTTL = 60;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is creating monthly race');
      return;
    }

    try {
      this.logger.log('Creating monthly race...');

      let finalizingMonthlyRace: RaceEntity | undefined;

      // TRANSACTION 1: Mark old as FINALIZING + create new ACTIVE
      await this.dataSource.transaction(async (manager) => {
        const raceRepo = manager.getRepository(RaceEntity);

        // Find old ACTIVE monthly race
        const oldRace = await raceRepo.findOne({
          where: {
            raceType: RaceTypeEnum.MONTHLY,
            status: RaceStatusEnum.ACTIVE,
          },
        });

        if (oldRace) {
          const now = new Date();
          if (oldRace.endsAt > now) {
            this.logger.debug(
              `Monthly race ${oldRace.id} is still active (ends at ${oldRace.endsAt.toISOString()}), skipping creation`,
            );
            return;
          }
          await raceRepo.update({ id: oldRace.id }, { status: RaceStatusEnum.FINALIZING });
          finalizingMonthlyRace = oldRace;
          this.logger.log(`Old monthly race marked FINALIZING: ${oldRace.id}`);
        }

        // Safety check: no ACTIVE monthly should exist now
        const activeCount = await raceRepo.countBy({
          raceType: RaceTypeEnum.MONTHLY,
          status: RaceStatusEnum.ACTIVE,
        });

        if (activeCount > 0) {
          this.logger.error('Multiple ACTIVE monthly races detected, aborting creation');
          return;
        }

        // Create new ACTIVE race
        const prizes = await this.dataSource.query(
          'SELECT * FROM bonus.monthly_race_prizes ORDER BY place ASC',
        );

        if (prizes.length === 0) {
          this.logger.error('No monthly race prizes configured');
          return;
        }

        const prizePool = prizes.reduce((sum: number, p: any) => sum + Number(p.amountUsd), 0);
        const { startsAt, endsAt } = calculateNextMonthDates();

        const name = 'Monthly Race';
        const slug = await this.generateUniqueSlug(name);

        const newRace = await raceRepo.save({
          slug,
          name,
          startsAt,
          endsAt,
          status: RaceStatusEnum.ACTIVE,
          raceType: RaceTypeEnum.MONTHLY,
          prizePool,
          prizes: prizes.map((p: any) => Number(p.amountUsd)),
          asset: null,
          fiat: 'USD',
          referralCode: null,
          sponsorId: null,
        });

        this.logger.log(`New monthly race created: ${newRace.id}`);

        this.eventEmitter.emit('race:created', {
          raceId: newRace.id,
          raceName: newRace.name,
          startsAt: newRace.startsAt,
          endsAt: newRace.endsAt,
        });
      });

      // TRANSACTION 2: Distribute prizes if old race existed
      if (finalizingMonthlyRace) {
        try {
          this.logger.log(`Distributing prizes for monthly race: ${finalizingMonthlyRace.id}`);
          await this.distributeRacePrizes(finalizingMonthlyRace);
        } catch (error) {
          this.logger.error(
            `Failed to distribute monthly race prizes (${finalizingMonthlyRace.id}):`,
            error,
          );
          // Race remains FINALIZING for manual recovery
        }
      }
    } catch (error) {
      this.logger.error('Error in createMonthlyRace:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * Helper: Generate unique race slug
   */
  private async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = baseName.toLowerCase().replace(/\s+/g, '-');
    let slug = baseSlug;
    let counter = 1;

    while (
      await this.raceRepo.findOne({
        where: { slug },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Process Finalizing Races - Runs every 5 minutes
   * Distributes prizes for any races stuck in FINALIZING status
   * This handles recovery from crashes during finalization
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processFinalizingRaces(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}process-finalizing`;
    const lockTTL = 240;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is processing finalizing races');
      return;
    }

    try {
      const finalizingRaces = await this.raceRepo.find({
        where: { status: RaceStatusEnum.FINALIZING },
        take: 50,
      });

      if (finalizingRaces.length === 0) {
        return;
      }

      this.logger.log(`Found ${finalizingRaces.length} races in FINALIZING status`);

      for (const race of finalizingRaces) {
        try {
          this.logger.log(`Processing finalizing race: ${race.id}`);
          await this.distributeRacePrizes(race);
        } catch (error) {
          this.logger.error(`Error processing finalizing race ${race.id}:`, error);
          // Race remains FINALIZING for retry
        }
      }
    } catch (error) {
      this.logger.error('Error in processFinalizingRaces:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * Activate Pending Races - Runs every 10 minutes (for testing)
   * Transitions PENDING → ACTIVE if startsAt <= now
   */
  @Cron('0 */10 * * * *') // Every 10 minutes for testing
  async activatePendingRaces(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}activate-pending`;
    const lockTTL = 120;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      this.logger.debug('Another instance is activating pending races');
      return;
    }

    try {
      const now = new Date();
      const query = `
        SELECT * FROM bonus.races
        WHERE status = $1 AND "startsAt" <= $2::timestamp
        LIMIT 100
      `;
      const pendingRaces = await this.dataSource.query(query, [
        RaceStatusEnum.PENDING,
        now.toISOString(),
      ]);

      if (pendingRaces.length === 0) {
        return;
      }

      this.logger.log(`Activating ${pendingRaces.length} pending races`);

      await this.raceRepo.update(
        {
          status: RaceStatusEnum.PENDING,
        },
        { status: RaceStatusEnum.ACTIVE },
      );
    } catch (error) {
      this.logger.error('Error activating pending races:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }

  /**
   * Flush Leaderboards - Runs every 5 minutes
   * Backs up Redis leaderboards to PostgreSQL
   */
  @Cron('*/5 * * * *')
  async flushLeaderboardsToDatabase(): Promise<void> {
    const lockKey = `${this.RACE_LOCK_KEY_PREFIX}flush-leaderboards`;
    const lockTTL = 120;
    const lockValue = `${process.pid}-${Date.now()}`;

    const locked = await this.redisService.setNX(lockKey, lockValue, lockTTL);
    if (!locked) {
      return;
    }

    try {
      // Get all active races
      const activeRaces = await this.raceRepo.find({
        where: { status: RaceStatusEnum.ACTIVE },
        select: ['id'],
      });

      for (const race of activeRaces) {
        try {
          await this.raceWagerTrackerService.flushSingleRaceToDatabase(race.id);
        } catch (error) {
          this.logger.error(`Error flushing race ${race.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error flushing leaderboards:', error);
    } finally {
      const currentLock = await this.redisService.get(lockKey);
      if (currentLock === lockValue) {
        await this.redisService.delete(lockKey);
      }
    }
  }
}
