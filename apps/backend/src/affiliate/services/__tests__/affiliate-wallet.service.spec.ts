import { BadRequestException } from '@nestjs/common';
import { AffiliateCommissionOperationEnum, AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm';
import { CryptoConverterService } from '../../../balance/services/crypto-converter.service';
import { AffiliateWalletService } from '../affiliate-wallet.service';

describe('AffiliateWalletService', () => {
  let service: AffiliateWalletService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockCryptoConverter: jest.Mocked<CryptoConverterService>;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn(),
        save: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      getRepository: jest.fn(),
      query: jest.fn(),
    } as any;

    mockCryptoConverter = {
      toCents: jest.fn().mockReturnValue('1000.50'),
    } as any;

    service = new AffiliateWalletService(mockDataSource, mockCryptoConverter);
  });

  describe('updateBalance (CLAIM only)', () => {
    it('should throw BadRequestException when claiming more than available balance', async () => {
      const walletRepo = {
        findOne: jest
          .fn()
          .mockResolvedValue({ userId: 'user1', asset: AssetTypeEnum.BTC, balance: '0.0001' }),
        save: jest.fn((data) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest
            .fn()
            .mockResolvedValue({ userId: 'user1', asset: AssetTypeEnum.BTC, balance: '0.0001' }),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);

      await expect(
        service.updateBalance(
          {
            userId: 'user1',
            asset: AssetTypeEnum.BTC,
            amount: new BigNumber('0.001'),
            operation: AffiliateCommissionOperationEnum.CLAIM,
          },
          mockQueryRunner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update wallet balance on CLAIM', async () => {
      const mockWallet = {
        userId: 'user1',
        asset: AssetTypeEnum.BTC,
        balance: '0.001',
        totalEarned: '0.002',
        totalClaimed: '0',
      };

      const walletRepo = {
        findOne: jest.fn().mockResolvedValue(mockWallet),
        save: jest.fn((data) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockWallet),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);
      mockQueryRunner.manager.save = jest.fn((entity) => Promise.resolve(entity));

      await service.updateBalance(
        {
          userId: 'user1',
          asset: AssetTypeEnum.BTC,
          amount: new BigNumber('0.0005'),
          operation: AffiliateCommissionOperationEnum.CLAIM,
        },
        mockQueryRunner,
      );

      expect(walletRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          asset: AssetTypeEnum.BTC,
          balance: '0.0005',
          totalClaimed: '0.0005',
        }),
      );
    });

    it('should create commission history record for CLAIM', async () => {
      const mockWallet = {
        userId: 'user1',
        asset: AssetTypeEnum.BTC,
        balance: '0.001',
        totalEarned: '0.002',
        totalClaimed: '0',
      };

      const walletRepo = {
        findOne: jest.fn().mockResolvedValue(mockWallet),
        save: jest.fn((data) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockWallet),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);
      mockQueryRunner.manager.save = jest.fn((entity) => Promise.resolve(entity));

      await service.updateBalance(
        {
          userId: 'user1',
          asset: AssetTypeEnum.BTC,
          amount: new BigNumber('0.001'),
          operation: AffiliateCommissionOperationEnum.CLAIM,
          campaignId: 'campaign1',
          balanceOperationId: 'claim-op1',
          metadata: { test: 'data' },
        },
        mockQueryRunner,
      );

      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          campaignId: 'campaign1',
          asset: AssetTypeEnum.BTC,
          amount: '0.001',
          amountCents: '1000.50',
          operation: AffiliateCommissionOperationEnum.CLAIM,
          balanceOperationId: 'claim-op1',
          metadata: { test: 'data' },
        }),
      );
    });

    it('should throw error if wallet not found on CLAIM', async () => {
      const walletRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((data) => data),
        save: jest.fn((data) => Promise.resolve(data)),
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);

      await expect(
        service.updateBalance(
          {
            userId: 'user1',
            asset: AssetTypeEnum.BTC,
            amount: new BigNumber('0.001'),
            operation: AffiliateCommissionOperationEnum.CLAIM,
          },
          mockQueryRunner,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWalletsWithBalance', () => {
    it('should return only wallets with balance > 0', async () => {
      const walletRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([
            { userId: 'user1', asset: AssetTypeEnum.BTC, balance: '0.001' },
            { userId: 'user1', asset: AssetTypeEnum.LTC, balance: '0.5' },
          ]),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);

      const result = await service.getWalletsWithBalance('user1', mockQueryRunner);

      expect(result).toHaveLength(2);
      expect(result[0].asset).toBe(AssetTypeEnum.BTC);
    });

    it('should return empty array when no wallets with balance', async () => {
      const walletRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
      };

      mockQueryRunner.manager.getRepository = jest.fn(() => walletRepo);

      const result = await service.getWalletsWithBalance('user1', mockQueryRunner);

      expect(result).toHaveLength(0);
    });
  });
});
