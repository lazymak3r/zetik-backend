import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AdminRole,
  ModerationActionTypeEnum,
  UserEntity,
  UserModerationHistoryEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UserCacheService } from '../../common/services/user-cache.service';
import { MODERATION_LIMITS } from '../constants/moderation-limits.constants';

export interface IMuteInfo {
  mutedUntil: Date | null | undefined;
  muteReason: string | null | undefined;
}

@Injectable()
export class UserMuteService {
  private readonly logger = new Logger(UserMuteService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserModerationHistoryEntity)
    private readonly moderationHistoryRepository: Repository<UserModerationHistoryEntity>,
    private readonly userCacheService: UserCacheService,
  ) {}

  async muteUser(
    userId: string,
    durationMinutes: number,
    adminId: string | null,
    reason?: string,
    adminRole?: AdminRole | null,
  ): Promise<void> {
    if (adminRole && adminRole in MODERATION_LIMITS) {
      const maxDuration = MODERATION_LIMITS[adminRole].maxMuteDuration;
      if (durationMinutes > maxDuration) {
        throw new BadRequestException(
          `Maximum mute duration for ${adminRole} role is ${maxDuration} minutes (${Math.floor(maxDuration / 60)} hours)`,
        );
      }
    }

    const mutedUntil = new Date();
    mutedUntil.setMinutes(mutedUntil.getMinutes() + durationMinutes);

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    user.mutedUntil = mutedUntil;
    user.muteReason = reason;
    await this.usersRepository.save(user);

    if (adminId) {
      const historyRecord = this.moderationHistoryRepository.create({
        userId,
        adminId,
        actionType: ModerationActionTypeEnum.MUTE,
        reason,
        durationMinutes,
      });
      await this.moderationHistoryRepository.save(historyRecord);
    }

    await this.userCacheService.invalidateAllUserCaches(userId);

    this.logger.log(
      `User ${userId} muted until ${mutedUntil.toISOString()} by admin ${adminId || 'system'}`,
    );
  }

  async unmuteUser(userId: string, adminId?: string | null): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const now = new Date();
    user.mutedUntil = null as any;
    user.muteReason = null as any;
    await this.usersRepository.save(user);

    const activeMuteHistory = await this.moderationHistoryRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.actionType = :actionType', { actionType: ModerationActionTypeEnum.MUTE })
      .andWhere(
        `history."createdAt" + (history."durationMinutes" || ' minutes')::INTERVAL > :now`,
        { now },
      )
      .orderBy('history.createdAt', 'DESC')
      .getOne();

    if (activeMuteHistory) {
      const actualDurationMinutes = Math.floor(
        (now.getTime() - activeMuteHistory.createdAt.getTime()) / 60000,
      );
      activeMuteHistory.durationMinutes = actualDurationMinutes;
      await this.moderationHistoryRepository.save(activeMuteHistory);
      this.logger.log(
        `Updated mute history for user ${userId}: actual duration ${actualDurationMinutes} minutes`,
      );
    }

    await this.userCacheService.invalidateAllUserCaches(userId);

    this.logger.log(
      `User ${userId} unmuted${adminId ? ` by admin ${adminId}` : adminId !== undefined ? ' by admin (no userId)' : ''}`,
    );
  }

  async isUserMuted(userId: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'mutedUntil'],
    });

    if (!user || !user.mutedUntil) {
      return false;
    }

    const now = new Date();
    return user.mutedUntil > now;
  }

  async getMuteInfo(userId: string): Promise<IMuteInfo | null> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.mutedUntil) {
      return null;
    }

    const now = new Date();
    if (user.mutedUntil <= now) {
      user.mutedUntil = null as any;
      user.muteReason = null as any;
      await this.usersRepository.save(user);
      await this.userCacheService.invalidateAllUserCaches(userId);
      return null;
    }

    return {
      mutedUntil: user.mutedUntil,
      muteReason: user.muteReason,
    };
  }
}
