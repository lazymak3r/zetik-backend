import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AssetTypeEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { RedisService } from '../../common/services/redis.service';
import { NotificationService } from '../../websocket/services/notification.service';

export interface IRacePrizeAwardedEvent {
  userId: string;
  raceName: string;
  place: number;
  prize: number;
  asset: AssetTypeEnum | null;
  fiat: string | null;
  operationId: string;
  newBalance: string;
}

@Injectable()
export class RacePrizeNotificationService implements OnModuleInit {
  private readonly logger = new Logger(RacePrizeNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const subscriber = this.redisService.getClient().duplicate();

      await subscriber.subscribe('race:prize:awarded');

      subscriber.on('message', (channel: string, message: string) => {
        if (channel === 'race:prize:awarded') {
          try {
            const event = JSON.parse(message) as IRacePrizeAwardedEvent;
            void this.handleRacePrizeAwarded(event);
          } catch (error) {
            this.logger.error('Failed to parse/handle race prize event:', error);
          }
        }
      });

      subscriber.on('error', (error) => {
        this.logger.error('Redis subscriber error:', error);
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to Redis pub/sub:', error);
    }
  }

  async handleRacePrizeAwarded(event: IRacePrizeAwardedEvent): Promise<void> {
    const lockKey = `race-prize-notification:${event.userId}:${event.raceName}:${event.place}`;
    const lockTTL = 30000;

    try {
      await this.distributedLockService.withLock(
        lockKey,
        lockTTL,
        async () => {
          const placeText = this.getPlaceText(event.place);

          // Format amount: fiat or crypto
          let amountText: string;
          if (event.fiat) {
            // Fiat race: show fiat amount with currency symbol and number formatting
            const formattedAmount = this.formatCurrency(event.prize);
            amountText = `$${formattedAmount}`;
          } else {
            // Crypto race: format crypto amount
            amountText = `${event.prize} ${event.asset}`;
          }

          try {
            await this.notificationService.sendToUserAndSave(event.userId, {
              type: 'balance_update',
              title: 'Race Prize Won!',
              message: `You won ${amountText} for finishing ${placeText} in ${event.raceName}`,
              data: {
                operation: BalanceOperationEnum.BONUS,
                asset: event.asset || AssetTypeEnum.BTC,
                amount: event.prize.toString(),
                newBalance: event.newBalance,
                operationId: event.operationId,
                shouldSync: true,
              },
            });
          } catch (error) {
            this.logger.error(`Failed to send race prize notification`, {
              userId: event.userId,
              raceName: event.raceName,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        {
          // For race prize notifications we want "at most once" behavior across
          // multiple backend instances, so do not retry if the lock is already held.
          retryCount: 0,
          retryDelay: 0,
          retryJitter: 0,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        return;
      }
      this.logger.error(
        `Failed to send race prize notification to user ${event.userId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private getPlaceText(place: number): string {
    const lastDigit = place % 10;
    const lastTwoDigits = place % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${place}th`;
    }

    switch (lastDigit) {
      case 1:
        return `${place}st`;
      case 2:
        return `${place}nd`;
      case 3:
        return `${place}rd`;
      default:
        return `${place}th`;
    }
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
}
