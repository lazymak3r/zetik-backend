import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  AffiliateCommissionHistoryEntity,
  AffiliateCommissionOperationEnum,
  AffiliateWalletEntity,
  AssetTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource, QueryRunner } from 'typeorm';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';

export interface IUpdateAffiliateWalletDto {
  userId: string;
  asset: AssetTypeEnum;
  amount: BigNumber;
  operation: AffiliateCommissionOperationEnum;
  campaignId?: string;
  balanceOperationId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AffiliateWalletService {
  private readonly logger = new Logger(AffiliateWalletService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cryptoConverter: CryptoConverterService,
  ) {}

  async getOrCreateWallet(
    userId: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<AffiliateWalletEntity> {
    const shouldRelease = !queryRunner;
    queryRunner = queryRunner || this.dataSource.createQueryRunner();

    const repo = queryRunner.manager.getRepository(AffiliateWalletEntity);

    let wallet = await repo.findOne({ where: { userId, asset } });

    if (!wallet) {
      wallet = repo.create({
        userId,
        asset,
        totalEarned: '0',
        totalClaimed: '0',
        balance: '0',
      });
      await repo.save(wallet);
      this.logger.verbose('Affiliate wallet created', { userId, asset });
    }

    if (shouldRelease) {
      await queryRunner
        .release()
        .catch((e) => this.logger.error('Failed to release QueryRunner', { error: e }));
    }

    return wallet;
  }

  async updateBalance(
    dto: IUpdateAffiliateWalletDto,
    queryRunner?: QueryRunner,
  ): Promise<AffiliateWalletEntity> {
    const shouldRelease = !queryRunner;
    queryRunner = queryRunner || this.dataSource.createQueryRunner();

    try {
      if (shouldRelease) {
        await queryRunner.connect();
        await queryRunner.startTransaction();
      }

      // Only CLAIM operation is supported
      if (dto.operation !== AffiliateCommissionOperationEnum.CLAIM) {
        throw new InternalServerErrorException('Only CLAIM operation is supported.');
      }

      const repo = queryRunner.manager.getRepository(AffiliateWalletEntity);

      // Use pessimistic lock for CLAIM to prevent race conditions
      const wallet = await repo
        .createQueryBuilder('wallet')
        .where('wallet.userId = :userId AND wallet.asset = :asset', {
          userId: dto.userId,
          asset: dto.asset,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!wallet) {
        throw new BadRequestException('Affiliate wallet not found');
      }

      const previousBalance = new BigNumber(wallet.balance);
      const newBalance = previousBalance.minus(dto.amount);

      if (newBalance.isLessThan(0)) {
        throw new BadRequestException('Insufficient affiliate wallet balance');
      }

      wallet.totalClaimed = new BigNumber(wallet.totalClaimed).plus(dto.amount).toString();

      wallet.balance = newBalance.toString();

      await repo.save(wallet);

      const amountCents = this.cryptoConverter.toCents(dto.amount.toString(), dto.asset);

      // Create history record
      const history = new AffiliateCommissionHistoryEntity();
      history.userId = dto.userId;
      history.campaignId = dto.campaignId;
      history.asset = dto.asset;
      history.amount = dto.amount.toString();
      history.amountCents = amountCents;
      history.operation = dto.operation;
      history.balanceOperationId = dto.balanceOperationId;
      history.metadata = dto.metadata;

      await queryRunner.manager.save(history);

      if (shouldRelease) {
        await queryRunner.commitTransaction();
      }

      return wallet;
    } catch (error) {
      if (shouldRelease) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldRelease) {
        await queryRunner
          .release()
          .catch((e) => this.logger.error('Failed to release QueryRunner', { error: e }));
      }
    }
  }

  async getWalletsWithBalance(
    userId: string,
    queryRunner?: QueryRunner,
  ): Promise<AffiliateWalletEntity[]> {
    const shouldRelease = !queryRunner;
    queryRunner = queryRunner || this.dataSource.createQueryRunner();

    const repo = queryRunner.manager.getRepository(AffiliateWalletEntity);

    const wallets = await repo
      .createQueryBuilder('wallet')
      .where('wallet.userId = :userId', { userId })
      .andWhere('CAST(wallet.balance AS DECIMAL) > 0')
      .getMany();

    if (shouldRelease) {
      await queryRunner
        .release()
        .catch((e) => this.logger.error('Failed to release QueryRunner', { error: e }));
    }

    return wallets;
  }

  async getWallet(
    userId: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<AffiliateWalletEntity | null> {
    const shouldRelease = !queryRunner;
    queryRunner = queryRunner || this.dataSource.createQueryRunner();

    const repo = queryRunner.manager.getRepository(AffiliateWalletEntity);
    const wallet = await repo.findOne({ where: { userId, asset } });

    if (shouldRelease) {
      await queryRunner
        .release()
        .catch((e) => this.logger.error('Failed to release QueryRunner', { error: e }));
    }

    return wallet;
  }
}
