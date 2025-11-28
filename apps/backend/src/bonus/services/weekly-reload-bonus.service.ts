import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { Repository } from 'typeorm';

import { BalanceService } from '../../balance/balance.service';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { WeeklyReloadBonusDto } from '../dto/weekly-reload-bonus.dto';

@Injectable()
export class WeeklyReloadBonusService {
  private readonly logger = new Logger(WeeklyReloadBonusService.name);

  constructor(
    @InjectRepository(BonusTransactionEntity)
    private readonly bonusRepo: Repository<BonusTransactionEntity>,
    private readonly balanceService: BalanceService,
    private readonly cryptoConverter: CryptoConverterService,
  ) {}

  /**
   * Get weekly reload bonuses for user (only currently active ones)
   */
  async getWeeklyReloadBonuses(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<WeeklyReloadBonusDto[]> {
    const now = new Date();

    const bonuses = await this.bonusRepo
      .createQueryBuilder('bonus')
      .where('bonus.userId = :userId', { userId })
      .andWhere('bonus.bonusType = :bonusType', { bonusType: BonusTypeEnum.WEEKLY_RELOAD })
      .andWhere('bonus.status = :status', { status: BonusTransactionStatusEnum.PENDING })
      .andWhere('bonus.activateAt <= :now', { now })
      .andWhere('bonus.expiredAt > :now', { now })
      .orderBy('bonus.activateAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return bonuses.map((bonus) => ({
      id: bonus.id,
      amount: (parseFloat(bonus.amount) / 100).toFixed(2), // Convert cents to dollars
      status: bonus.status,
      description: bonus.description || `Weekly reload bonus ${bonus.id}`,
      activateAt: bonus.activateAt,
      expiredAt: bonus.expiredAt,
      claimedAt: bonus.claimedAt,
      metadata: bonus.metadata,
    }));
  }

  /**
   * Count weekly reload bonuses for user (only currently active ones)
   */
  async countWeeklyReloadBonuses(userId: string): Promise<number> {
    const now = new Date();

    return this.bonusRepo
      .createQueryBuilder('bonus')
      .where('bonus.userId = :userId', { userId })
      .andWhere('bonus.bonusType = :bonusType', { bonusType: BonusTypeEnum.WEEKLY_RELOAD })
      .andWhere('bonus.status = :status', { status: BonusTransactionStatusEnum.PENDING })
      .andWhere('bonus.activateAt <= :now', { now })
      .andWhere('bonus.expiredAt > :now', { now })
      .getCount();
  }

  /**
   * Claim weekly reload bonus with time validation
   */
  async claimWeeklyReloadBonus(userId: string, bonusId: string): Promise<BonusTransactionEntity> {
    const bonus = await this.bonusRepo.findOne({
      where: { id: bonusId, userId, bonusType: BonusTypeEnum.WEEKLY_RELOAD },
    });

    if (!bonus) {
      throw new NotFoundException('Weekly reload bonus not found');
    }

    if (bonus.status !== BonusTransactionStatusEnum.PENDING) {
      throw new BadRequestException('Weekly reload bonus already claimed');
    }

    const now = new Date();

    // Check if bonus is not yet active
    if (bonus.activateAt && now < bonus.activateAt) {
      throw new BadRequestException(
        `Weekly reload bonus cannot be claimed yet. Available from ${bonus.activateAt.toISOString()}`,
      );
    }

    // Check if bonus has expired
    if (bonus.expiredAt && now > bonus.expiredAt) {
      throw new BadRequestException(
        `Weekly reload bonus has expired. Was available until ${bonus.expiredAt.toISOString()}`,
      );
    }

    // Determine asset for crediting: prefer saved asset from metadata if present
    let asset: AssetTypeEnum | undefined = bonus.metadata?.asset as AssetTypeEnum | undefined;
    if (!asset) {
      const primaryWallet = await this.balanceService.getPrimaryWallet(userId);
      asset = primaryWallet ? primaryWallet.asset : AssetTypeEnum.BTC; // fallback to BTC
    }

    // Convert bonus amount from cents to crypto asset
    const amountAsset = this.cryptoConverter.fromCents(bonus.amount, asset);

    try {
      // Credit user's balance
      const result = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.BONUS,
        operationId: bonus.id,
        userId,
        amount: new BigNumber(amountAsset),
        asset,
        description: `Weekly reload bonus claim (${(parseFloat(bonus.amount) / 100).toFixed(2)} USD)`,
        metadata: {
          ...(bonus.metadata || {}),
          reason: BonusTypeEnum.WEEKLY_RELOAD,
          claimedAt: now.toISOString(),
        },
      });

      if (!result.success) {
        this.logger.error(
          `Balance update failed for weekly reload bonus claim ${bonus.id}: ${result.error}`,
        );
        throw new BadRequestException(`Failed to credit balance: ${result.error}`);
      }

      // Mark bonus as claimed
      bonus.status = BonusTransactionStatusEnum.CLAIMED;
      bonus.claimedAt = now;
      bonus.updatedBy = userId;

      const savedBonus = await this.bonusRepo.save(bonus);

      this.logger.log(`Weekly reload bonus claimed successfully`, {
        userId,
        bonusId: bonus.id,
        amount: bonus.amount,
        asset,
        assetAmount: amountAsset,
      });

      return savedBonus;
    } catch (error: any) {
      this.logger.error(
        `Failed to claim weekly reload bonus ${bonusId} for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
