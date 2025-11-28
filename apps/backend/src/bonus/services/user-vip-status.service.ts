import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BonusTransactionEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { In, Repository } from 'typeorm';
import { IIssueBonusCommand } from '../interfaces/issue-bonus-command.interface';

@Injectable()
export class UserVipStatusService {
  constructor(
    @InjectRepository(UserVipStatusEntity)
    private readonly userVipRepo: Repository<UserVipStatusEntity>,
    @InjectRepository(BonusTransactionEntity)
    private readonly transactionRepo: Repository<BonusTransactionEntity>,
  ) {}

  async getUserVipStatus(userId: string): Promise<UserVipStatusEntity | null> {
    return this.userVipRepo.findOne({ where: { userId } });
  }

  async upsertUserVipStatus(
    userId: string,
    data: Partial<UserVipStatusEntity>,
  ): Promise<UserVipStatusEntity> {
    const existing = await this.userVipRepo.findOne({ where: { userId } });
    // If this is a new entity, set the default VIP level to 0
    const defaultValues = existing ? {} : { currentVipLevel: 0, previousVipLevel: 0 };
    const entity = this.userVipRepo.create({ ...defaultValues, ...existing, ...data, userId });
    return this.userVipRepo.save(entity);
  }

  /**
   * Increment user's currentWager by the net wager amount
   */
  async incrementUserWager(
    userId: string,
    netWagerIncrement: string,
  ): Promise<UserVipStatusEntity> {
    const status = await this.upsertUserVipStatus(userId, {});
    const current = new BigNumber(status.currentWager);
    const increment = new BigNumber(netWagerIncrement);
    status.currentWager = current.plus(increment).toFixed(2);
    return this.userVipRepo.save(status);
  }

  async logBonusTransaction(command: IIssueBonusCommand): Promise<void> {
    const log = this.transactionRepo.create({
      id: command.operationId,
      userId: command.userId,
      bonusType: command.bonusType,
      amount: command.amount,
      description: command.description,
      relatedVipTierLevel: command.relatedVipTierLevel,
      metadata: command.metadata,
    });
    await this.transactionRepo.save(log);
  }

  /**
   * Get all users' VIP status records.
   */
  async findAllUserVipStatus(): Promise<UserVipStatusEntity[]> {
    return this.userVipRepo.find();
  }

  /**
   * Reset user's VIP status to initial state
   */
  async resetUserVipStatus(userId: string): Promise<void> {
    await this.userVipRepo.delete({ userId });
  }

  /**
   * Get VIP status information for multiple users
   * @param userIds Array of user IDs to fetch VIP status for
   * @returns Array of objects containing userId and vipLevel
   */
  async getUsersVipStatus(
    userIds: string[],
  ): Promise<Array<{ userId: string; vipLevel: number; vipLevelImage: string }>> {
    const statuses = await this.userVipRepo.find({
      relations: ['currentBonusVipTier'],
      where: { userId: In(userIds) },
    });

    return statuses.map((status) => ({
      userId: status.userId,
      vipLevel: status.currentVipLevel,
      vipLevelImage: status?.currentBonusVipTier?.imageUrl ?? '',
    }));
  }
}
