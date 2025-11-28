import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BonusTypeEnum, BonusVipTierEntity } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { randomUUID } from 'crypto';
import { UsersService } from '../../users/users.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { IntercomService } from '../services/intercom.service';

import { IBetConfirmedEventPayload } from '../interfaces/ibet-confirmed-event-payload.interface';
import { IBetRefundedEventPayload } from '../interfaces/ibet-refunded-event-payload.interface';
import { BonusTransactionService } from './bonus-transaction.service';
import { UserVipStatusService } from './user-vip-status.service';
import { VipTierService } from './vip-tier.service';

@Injectable()
export class BetConfirmedHandlerService implements OnModuleInit {
  private readonly logger = new Logger(BetConfirmedHandlerService.name);

  // Add private maps
  private majorRankMap: Map<number, string> = new Map();
  private firstLevelMap: Map<string, number> = new Map();

  constructor(
    private readonly bonusTransactionService: BonusTransactionService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly vipTierService: VipTierService,
    private notificationService: NotificationService,
    private readonly intercomService: IntercomService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    const allTiers = await this.vipTierService.findAllTiers();
    allTiers.sort((a, b) => a.level - b.level);

    let currentMajor = '';
    let currentFirstLevel = -1;

    for (const tier of allTiers) {
      const majorMatch = tier.name.match(/^([A-Za-z]+)(?:\s+[IVXLCDM]+)?$/);
      if (!majorMatch?.[1]) {
        throw new Error(`Invalid tier name format for level ${tier.level}: ${tier.name}`);
      }
      const major = majorMatch[1];

      if (major !== currentMajor) {
        currentMajor = major;
        currentFirstLevel = tier.level;
        this.firstLevelMap.set(major, currentFirstLevel);
      }

      this.majorRankMap.set(tier.level, major);
    }

    // Validation
    if (allTiers.length === 0) {
      throw new Error('No VIP tiers found in database');
    }
    for (let i = 1; i <= allTiers[allTiers.length - 1].level; i++) {
      if (!this.majorRankMap.has(i)) {
        throw new Error(`Missing VIP tier for level ${i}`);
      }
    }
  }

  @OnEvent('bet.confirmed')
  async handleBetConfirmed(payload: IBetConfirmedEventPayload): Promise<void> {
    const { userId, betAmountCents } = payload;

    try {
      // Process only bet amount - refunds are handled by separate bet.refunded event
      const betAmountBN = new BigNumber(betAmountCents || '0');

      // Get current status and increment wager
      const status = await this.userVipStatusService.incrementUserWager(
        userId,
        betAmountBN.toFixed(2),
      );

      // Level-up logic - check all tiers user can achieve
      const allTiers = await this.vipTierService.findAllTiers();
      const currentWagerBN = new BigNumber(status.currentWager);

      // Find the highest tier user can achieve
      let newLevel = status.currentVipLevel;
      const tiersToAward: BonusVipTierEntity[] = [];

      for (const tier of allTiers) {
        // Both currentWager and wagerRequirement are now in cents
        const wagerRequirementCents = new BigNumber(tier.wagerRequirement);

        if (tier.level > status.currentVipLevel && currentWagerBN.gte(wagerRequirementCents)) {
          newLevel = tier.level;
          // Only award bonus if tier has bonus and user hasn't received it yet
          if (tier.levelUpBonusAmount && tier.level > status.previousVipLevel) {
            tiersToAward.push(tier);
          }
        }
      }

      const newTier = tiersToAward[tiersToAward.length - 1];

      // Determine previous and next tier wager requirements for progress calculation
      let previousTierWagerRequirementStr =
        allTiers.find((t) => t.level === newLevel)?.wagerRequirement ?? '0';
      let nextTierWagerRequirementStr =
        allTiers.find((t) => t.level === newLevel + 1)?.wagerRequirement ?? '0';

      // If user has just leveled up, show 100% progress for the reached tier
      if (newLevel > status.currentVipLevel) {
        previousTierWagerRequirementStr =
          allTiers.find((t) => t.level === newLevel - 1)?.wagerRequirement ?? '0';
        nextTierWagerRequirementStr =
          allTiers.find((t) => t.level === newLevel)?.wagerRequirement ?? '0';
      }

      const previousTierWagerRequirement = new BigNumber(previousTierWagerRequirementStr);
      const nextTierWagerRequirement = new BigNumber(nextTierWagerRequirementStr);

      // Calculate progress percentage correctly: (current - prev) / (next - prev) * 100
      const progressNumerator = currentWagerBN.minus(previousTierWagerRequirement);
      const progressDenominator = nextTierWagerRequirement.minus(previousTierWagerRequirement);

      let progressPercents = '0.00';
      if (progressDenominator.isGreaterThan(0)) {
        // Clamp between 0 and 100
        const raw = progressNumerator.dividedBy(progressDenominator).multipliedBy(100);
        const clamped = BigNumber.maximum(0, BigNumber.minimum(100, raw));
        progressPercents = clamped.toFixed(2);
      }

      // Update level if changed
      if (newLevel > status.currentVipLevel) {
        this.logger.log(`User ${userId} leveling up from ${status.currentVipLevel} to ${newLevel}`);

        // Award all level-up bonuses
        for (const tier of tiersToAward) {
          const bonusOperationId = randomUUID();
          // VIP tier stores amounts in cents, keep as string to preserve precision
          const amountCents = tier.levelUpBonusAmount!;
          const prevTierLevel = tier.level - 1;
          const prevTier = allTiers.find((t) => t.level === prevTierLevel);
          const fromName = prevTier?.name || this.getMajorRank(status.currentVipLevel);
          const toName = tier.name;

          await this.userVipStatusService.logBonusTransaction({
            operationId: bonusOperationId,
            userId,
            amount: amountCents, // Keep as string in cents (e.g., "2500.00")
            bonusType: BonusTypeEnum.LEVEL_UP,
            description: `[LEVEL_UP] ${fromName} -> ${toName}`,
            relatedVipTierLevel: tier.level,
            metadata: {
              reason: BonusTypeEnum.LEVEL_UP,
              from: fromName,
              to: toName,
            },
          });
        }

        // Rank-up bonus between major ranks
        const prevMajor = this.getMajorRank(status.currentVipLevel);
        const newMajor = this.getMajorRank(newLevel);
        if (prevMajor !== newMajor) {
          // TypeORM-based duplicate check - prevent multiple rank-up bonuses for same major rank
          const hasExistingRankUpBonus = await this.bonusTransactionService.hasExistingRankUpBonus(
            userId,
            newMajor,
          );

          if (!hasExistingRankUpBonus) {
            const targetFirstLevel = this.getFirstLevelOfMajor(newMajor);
            const rankTier = allTiers.find((t) => t.level === targetFirstLevel);
            if (rankTier?.rankUpBonusAmount) {
              const fromMajor = prevMajor;
              const toMajor = newMajor;

              this.logger.log(
                `Creating RANK_UP bonus for user ${userId}: ${fromMajor} -> ${toMajor} ($${(parseFloat(rankTier.rankUpBonusAmount) / 100).toFixed(2)})`,
                { userId, fromMajor, toMajor, amount: rankTier.rankUpBonusAmount },
              );

              await this.userVipStatusService.logBonusTransaction({
                operationId: randomUUID(),
                userId,
                amount: rankTier.rankUpBonusAmount,
                bonusType: BonusTypeEnum.RANK_UP,
                description: `[RANK_UP] ${fromMajor} -> ${toMajor}`,
                relatedVipTierLevel: rankTier.level,
                metadata: {
                  reason: BonusTypeEnum.RANK_UP,
                  from: fromMajor,
                  to: toMajor,
                },
              });
            }

            // Send personalized Intercom message based on rank level
            this.sendRankUpIntercomMessage(userId, newMajor, targetFirstLevel).catch((err) =>
              this.logger.error('Failed to send Intercom rank-up message', err),
            );
          } else {
            this.logger.warn(
              `Prevented duplicate RANK_UP bonus for user ${userId}: major rank ${newMajor} already awarded`,
              { userId, majorRank: newMajor, prevLevel: status.currentVipLevel, newLevel },
            );
          }
        }

        // Update user's VIP status
        await this.userVipStatusService.upsertUserVipStatus(userId, {
          currentVipLevel: newLevel,
          previousVipLevel: status.currentVipLevel,
        });

        // Fire-and-forget notification
        void this.notificationService.sendToUserAndSave(userId, {
          type: 'vip_level_up',
          title: 'VIP Level Up!',
          message: `You have reached VIP level ${newLevel}!`,
          data: {
            vipLevel: newTier?.level,
            vipLevelName: newTier?.name,
            vipLevelImage: newTier?.imageUrl ?? '',
            currentWager: newTier?.wagerRequirement,
            progressPercents,
          },
        });
      } else {
        // todo: send once in a while instead of every time
        this.notificationService.sendToUser(userId, {
          type: 'vip_level_progress',
          title: 'VIP Level Progress',
          message: `You have reached ${progressPercents}% of next VIP level!`,
          data: {
            currentWager: status.currentWager,
            nextTierWagerRequirement: nextTierWagerRequirement.toString(),
            previousTierWagerRequirement: previousTierWagerRequirement.toString(),
            vipLevel: newTier?.level,
            vipLevelImage: newTier?.imageUrl ?? '',
            progressPercents,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to handle bet confirmed for user ${userId}:`, error);
    }
  }

  // Update methods to use maps
  private getMajorRank(level: number): string {
    const major = this.majorRankMap.get(level);
    if (!major) {
      throw new Error(`No major rank found for level ${level}`);
    }
    return major;
  }

  private getFirstLevelOfMajor(major: string): number {
    const firstLevel = this.firstLevelMap.get(major);
    if (firstLevel === undefined) {
      throw new Error(`No first level found for major rank ${major}`);
    }
    return firstLevel;
  }

  private async sendRankUpIntercomMessage(
    userId: string,
    rankName: string,
    firstLevelOfRank: number,
  ): Promise<void> {
    try {
      // Get user details for personalized message
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const userName = user.displayName || user.username || 'Player';

      // Determine message based on rank level
      // Platinum and above (levels 13+) get VIP host message
      // Below Platinum (levels 1-12) get currency preference message
      let messageBody: string;

      if (firstLevelOfRank >= 13) {
        // Platinum and above - VIP host message
        messageBody = `Hey ${userName}! 😉

Congrats on hitting ${rankName} VIP! 🎉
You've unlocked your personal VIP host – one of our best, ready with a juicy bonus 💸.

Drop us your Telegram username, and your VIP host will reach out to you directly. 😎`;
      } else {
        // Below Platinum - currency preference message
        messageBody = `Hey ${userName}! 🎉

Congrats on hitting ${rankName} VIP! 🏆
Your grind deserves a reward – we've lined up some exclusive perks just for you.
Let's kick it off with a bonus in your preferred currency 💰
Which currency would you like it in? 😎`;
      }

      await this.intercomService.sendMessageToUser(userId, messageBody, userName, user.email);
      this.logger.log(`Sent rank-up message to ${userName} (${userId}) for ${rankName} rank`);
    } catch (error) {
      this.logger.error(`Failed to send personalized Intercom message to user ${userId}:`, error);
      // Fallback to generic message if user lookup fails
      const fallbackMessage = `Congrats on your new rank ${rankName}!`;
      await this.intercomService.sendMessageToUser(userId, fallbackMessage);
    }
  }

  /**
   * Handle bet.refunded event - only decrements wager, no level-up checks
   * Used for bet cancellations and refunds
   */
  @OnEvent('bet.refunded')
  async handleBetRefunded(payload: IBetRefundedEventPayload): Promise<void> {
    const { userId, refundAmountCents } = payload;

    try {
      // Simply decrement wager - no level up checks or bonus awards
      if (!refundAmountCents || refundAmountCents === '0') {
        return;
      }

      const wagerDecrement = new BigNumber(refundAmountCents).toFixed(2);
      await this.userVipStatusService.incrementUserWager(userId, `-${wagerDecrement}`);

      this.logger.debug(`Refunded wager for user ${userId}: -${wagerDecrement} cents`, {
        userId,
        refundAmountCents,
      });
    } catch (error) {
      this.logger.error(`Failed to process bet refund for user ${userId}:`, error);
      // Don't throw - refund failure shouldn't block balance update
    }
  }
}
