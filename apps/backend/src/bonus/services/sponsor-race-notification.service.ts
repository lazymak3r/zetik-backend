import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RaceEntity, UserEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { NotificationService } from '../../websocket/services/notification.service';

@Injectable()
export class SponsorRaceNotificationService {
  private readonly logger = new Logger(SponsorRaceNotificationService.name);
  private readonly BATCH_SIZE = 100;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  async notifyUsersAboutNewRace(race: RaceEntity): Promise<void> {
    try {
      if (!race.referralCode) {
        this.logger.debug('Race has no referral code, skipping notifications');
        return;
      }

      const totalUsers = await this.userRepo.count({
        where: { referralCode: race.referralCode },
      });

      if (totalUsers === 0) {
        this.logger.debug(
          `No users found with referral code ${race.referralCode} for race ${race.id}`,
        );
        return;
      }

      this.logger.log(
        `Starting notifications for ${totalUsers} users with referral code ${race.referralCode}`,
      );

      const prizePoolText = this.formatPrizePool(race.prizePool, race.fiat, race.asset);
      const startsAt = race.startsAt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });

      const endsAt = race.endsAt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });

      const notification = {
        type: 'sponsor_race_created',
        title: 'You are Invited to Join a Race!',
        message: `Join "${race.name}" and compete for ${prizePoolText}! Race runs from ${startsAt} to ${endsAt} (UTC). Start playing now!`,
        data: {
          raceId: race.id,
          raceName: race.name,
          slug: race.slug,
          prizePool: race.prizePool,
          asset: race.asset,
          fiat: race.fiat,
          startsAt: race.startsAt.toISOString(),
          endsAt: race.endsAt.toISOString(),
          referralCode: race.referralCode,
        },
      };

      let offset = 0;
      let notifiedCount = 0;

      while (offset < totalUsers) {
        const userIds = await this.userRepo
          .createQueryBuilder('user')
          .select('user.id')
          .where('user.referralCode = :referralCode', { referralCode: race.referralCode })
          .skip(offset)
          .take(this.BATCH_SIZE)
          .getRawMany();

        const userIdList = userIds.map((row) => row.user_id);

        try {
          // Save to database for notification history
          await this.notificationService.sendToUsersAndSave(userIdList, notification);
          notifiedCount += userIdList.length;

          // Send real-time WebSocket notifications (using vip_level_up type to preserve title/message)
          for (const userId of userIdList) {
            this.notificationService.sendToUser(userId, {
              type: 'vip_level_up',
              title: notification.title,
              message: notification.message,
              data: notification.data,
            });
          }

          this.logger.debug(
            `Batch ${Math.floor(offset / this.BATCH_SIZE) + 1}: Sent ${userIdList.length} notifications`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send batch ${Math.floor(offset / this.BATCH_SIZE) + 1}`,
            error instanceof Error ? error.stack : error,
          );
        }

        offset += this.BATCH_SIZE;
      }

      this.logger.log(
        `Completed sponsor race notifications: ${notifiedCount}/${totalUsers} users notified for race ${race.id} (${race.name})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send sponsor race notifications for race ${race.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private formatPrizePool(amount: number, fiat: string | null, asset: string | null): string {
    if (fiat) {
      return `${amount.toFixed(2)} ${fiat}`;
    }
    if (asset) {
      return `${amount} ${asset}`;
    }
    return String(amount);
  }
}
