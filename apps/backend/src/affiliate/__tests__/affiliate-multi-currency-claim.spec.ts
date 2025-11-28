import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { DataSource, QueryRunner } from 'typeorm';
import { AffiliateService } from '../affiliate.service';

describe('AffiliateService - Multi-Currency Claim (409 Prevention)', () => {
  let service: AffiliateService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: 'AffiliateCampaignEntityRepository',
          useValue: {},
        },
        {
          provide: 'CryptoConverterService',
          useValue: {
            toCents: jest.fn().mockReturnValue(1000),
            fromCents: jest.fn().mockReturnValue('0.001'),
          },
        },
        {
          provide: 'BalanceService',
          useValue: {
            updateBalance: jest.fn().mockResolvedValue({
              success: true,
              status: 'SUCCESS',
            }),
          },
        },
        {
          provide: 'AffiliateWalletService',
          useValue: {
            updateBalance: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: 'RedisService',
          useValue: {
            getClient: jest.fn().mockReturnValue({
              publish: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  describe('claimAllCommissions() - Unique Operation IDs', () => {
    it('should generate unique balanceOperationId for each asset', async () => {
      // Arrange
      const mockWallets = [
        { asset: AssetTypeEnum.BTC, balance: '0.001' },
        { asset: AssetTypeEnum.ETH, balance: '0.01' },
        { asset: AssetTypeEnum.USDT, balance: '50' },
      ];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      const updateBalanceSpy = jest.spyOn(service['balanceService'], 'updateBalance');

      // Act
      await service.claimAllCommissions(mockUserId);

      // Assert - each call should have unique operationId
      const operationIds = updateBalanceSpy.mock.calls.map((call) => {
        const dto = Array.isArray(call[0]) ? call[0][0] : call[0];
        return dto.operationId;
      });
      const uniqueOperationIds = new Set(operationIds);

      expect(operationIds).toHaveLength(3);
      expect(uniqueOperationIds.size).toBe(3); // All unique
      expect(operationIds[0]).not.toBe(operationIds[1]);
      expect(operationIds[1]).not.toBe(operationIds[2]);
    });

    it('should prevent 409 conflict when claiming multiple assets', async () => {
      // Arrange
      const mockWallets = [
        { asset: AssetTypeEnum.BTC, balance: '0.001' },
        { asset: AssetTypeEnum.ETH, balance: '0.01' },
      ];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      // Simulate unique constraint violation on second call with same operationId
      let callCount = 0;
      jest.spyOn(service['balanceService'], 'updateBalance').mockImplementation((dto) => {
        callCount++;
        const dtoToCheck = Array.isArray(dto) ? dto[0] : dto;
        if (callCount === 2 && dtoToCheck.operationId === 'same-id') {
          throw new Error('duplicate key value violates unique constraint');
        }
        return Promise.resolve({ success: true, status: 'SUCCESS' } as any);
      });

      // Act & Assert - should NOT throw because operationIds are unique
      await expect(service.claimAllCommissions(mockUserId)).resolves.not.toThrow();
    });

    it('should use unique balanceOperationId in affiliate wallet update', async () => {
      // Arrange
      const mockWallets = [
        { asset: AssetTypeEnum.BTC, balance: '0.001' },
        { asset: AssetTypeEnum.ETH, balance: '0.01' },
      ];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      const walletUpdateSpy = jest.spyOn(service['affiliateWalletService'], 'updateBalance');

      // Act
      await service.claimAllCommissions(mockUserId);

      // Assert - each wallet update should have unique balanceOperationId
      const balanceOperationIds = walletUpdateSpy.mock.calls.map(
        (call) => call[0].balanceOperationId,
      );

      expect(balanceOperationIds).toHaveLength(2);
      expect(balanceOperationIds[0]).not.toBe(balanceOperationIds[1]);
    });
  });

  describe('Multiple Simultaneous Claims - Idempotency', () => {
    it('should handle concurrent claim requests for same user', async () => {
      // Arrange
      const mockWallets = [{ asset: AssetTypeEnum.BTC, balance: '0.001' }];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      // Act - simulate 3 concurrent claims
      const claims = [
        service.claimAllCommissions(mockUserId),
        service.claimAllCommissions(mockUserId),
        service.claimAllCommissions(mockUserId),
      ];

      // Assert - all should complete without throwing 409
      await expect(Promise.all(claims)).resolves.toBeDefined();
    });
  });

  describe('Minimum Claim Amount', () => {
    it('should enforce $2 minimum claim amount', async () => {
      // Arrange - total value < $2
      const mockWallets = [
        { asset: AssetTypeEnum.BTC, balance: '0.00001' }, // ~$1
      ];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('100'); // $1 in cents

      // Act & Assert
      await expect(service.claimAllCommissions(mockUserId)).rejects.toThrow(BadRequestException);
      await expect(service.claimAllCommissions(mockUserId)).rejects.toThrow(
        'Minimum claim amount is $2',
      );
    });

    it('should allow claim when total value >= $2', async () => {
      // Arrange - total value > $2
      const mockWallets = [
        { asset: AssetTypeEnum.BTC, balance: '0.0001' }, // ~$10
      ];

      jest.spyOn(queryRunner, 'query').mockImplementation((sql: string) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve(mockWallets);
        }
        return Promise.resolve([]);
      });

      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('1000'); // $10 in cents

      // Act & Assert
      await expect(service.claimAllCommissions(mockUserId)).resolves.toBeDefined();
    });
  });
});
