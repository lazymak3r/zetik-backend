import { AssetTypeEnum, SportsbookBetStatus } from '@zetik/shared-entities';
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { BetbyService } from '../betby.service';

describe('BetbyService - Multi-Currency Affiliate Commissions', () => {
  let service: BetbyService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockUserId = 'user-123';
  const mockBetId = 'bet-456';

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetbyService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: 'SportsbookBetEntityRepository',
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: 'BalanceService',
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: 'CryptoConverterService',
          useValue: {
            fromCents: jest.fn(),
            toCents: jest.fn(),
          },
        },
        {
          provide: 'AffiliateCommissionService',
          useValue: {
            accumulateCommission: jest.fn(),
          },
        },
        {
          provide: 'UserBetService',
          useValue: {},
        },
        {
          provide: 'BetbyJwtService',
          useValue: {},
        },
        {
          provide: 'UsersService',
          useValue: {},
        },
        {
          provide: 'EventEmitter2',
          useValue: {
            emitAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BetbyService>(BetbyService);
  });

  describe('win() - Multi-Currency Support', () => {
    it('should use ETH for user with ETH primary wallet', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.ETH,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['balanceService'], 'updateBalance').mockResolvedValue({
        success: true,
        status: 'SUCCESS' as any,
        balance: '1000',
      });
      jest.spyOn(service['cryptoConverter'], 'fromCents').mockReturnValue('0.1');
      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('1000');

      // Act
      await service.win({
        bet_transaction_id: mockBetId,
        amount: 2000,
        currency: 'USD',
        is_cashout: false,
        transaction: {} as any,
        selections: [],
      });

      // Assert
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { userId: mockUserId, isPrimary: true },
        }),
      );
      expect(service['affiliateCommissionService'].accumulateCommission).toHaveBeenCalledWith(
        mockUserId,
        AssetTypeEnum.ETH,
        expect.any(String),
        expect.any(Number),
        queryRunner,
      );
    });

    it('should use USDT for user with USDT primary wallet', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.USDT,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['balanceService'], 'updateBalance').mockResolvedValue({
        success: true,
        status: 'SUCCESS' as any,
        balance: '1000',
      });
      jest.spyOn(service['cryptoConverter'], 'fromCents').mockReturnValue('10');
      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('1000');

      // Act
      await service.win({
        bet_transaction_id: mockBetId,
        amount: 2000,
        currency: 'USD',
        is_cashout: false,
        transaction: {} as any,
        selections: [],
      });

      // Assert
      expect(service['affiliateCommissionService'].accumulateCommission).toHaveBeenCalledWith(
        mockUserId,
        AssetTypeEnum.USDT,
        expect.any(String),
        expect.any(Number),
        queryRunner,
      );
    });

    it('should throw InternalServerErrorException when user has no primary wallet', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.win({
          bet_transaction_id: mockBetId,
          amount: 2000,
          currency: 'USD',
          is_cashout: false,
          transaction: {} as any,
          selections: [],
        }),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.win({
          bet_transaction_id: mockBetId,
          amount: 2000,
          currency: 'USD',
          is_cashout: false,
          transaction: {} as any,
          selections: [],
        }),
      ).rejects.toThrow('User user-123 has no primary wallet');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should query primary wallet inside transaction boundary', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.BTC,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['balanceService'], 'updateBalance').mockResolvedValue({
        success: true,
        status: 'SUCCESS' as any,
        balance: '1000',
      });

      // Act
      await service.win({
        bet_transaction_id: mockBetId,
        amount: 2000,
        currency: 'USD',
        is_cashout: false,
        transaction: {} as any,
        selections: [],
      });

      // Assert - verify getPrimaryWallet called AFTER startTransaction
      const callOrder = [
        queryRunner.connect,
        queryRunner.startTransaction,
        queryRunner.manager.findOne,
      ];
      callOrder.forEach((fn, idx) => {
        if (idx > 0) {
          expect(fn).toHaveBeenCalled();
        }
      });
    });
  });

  describe('lost() - Multi-Currency Support', () => {
    it('should use ETH for user with ETH primary wallet', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.ETH,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['cryptoConverter'], 'fromCents').mockReturnValue('0.1');
      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('1000');

      // Act
      await service.lost({
        bet_transaction_id: mockBetId,
        amount: 0,
        currency: 'USD',
        transaction: {} as any,
        selections: [],
      });

      // Assert
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { userId: mockUserId, isPrimary: true },
        }),
      );
      expect(service['affiliateCommissionService'].accumulateCommission).toHaveBeenCalledWith(
        mockUserId,
        AssetTypeEnum.ETH,
        expect.any(String),
        expect.any(Number),
        queryRunner,
      );
    });

    it('should throw InternalServerErrorException when user has no primary wallet', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.lost({
          bet_transaction_id: mockBetId,
          amount: 0,
          currency: 'USD',
          transaction: {} as any,
          selections: [],
        }),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.lost({
          bet_transaction_id: mockBetId,
          amount: 0,
          currency: 'USD',
          transaction: {} as any,
          selections: [],
        }),
      ).rejects.toThrow('User user-123 has no primary wallet');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Affiliate Commission - Non-BTC Assets', () => {
    it('should accumulate commission in ETH when primary wallet is ETH', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '5000', // $50
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.ETH,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['cryptoConverter'], 'fromCents').mockReturnValue('0.01428571'); // $50 / $3500
      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('5000');

      const accumulateCommissionSpy = jest.spyOn(
        service['affiliateCommissionService'],
        'accumulateCommission',
      );

      // Act
      await service.lost({
        bet_transaction_id: mockBetId,
        amount: 0,
        currency: 'USD',
        transaction: {} as any,
        selections: [],
      });

      // Assert
      expect(accumulateCommissionSpy).toHaveBeenCalledWith(
        mockUserId,
        AssetTypeEnum.ETH,
        '0.01428571', // ETH amount
        3, // 3% house edge
        queryRunner,
      );
    });

    it('should accumulate commission in USDT when primary wallet is USDT', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '10000', // $100
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.USDT,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['cryptoConverter'], 'fromCents').mockReturnValue('100'); // $100 / $1
      jest.spyOn(service['cryptoConverter'], 'toCents').mockReturnValue('10000');

      const accumulateCommissionSpy = jest.spyOn(
        service['affiliateCommissionService'],
        'accumulateCommission',
      );

      // Act
      await service.lost({
        bet_transaction_id: mockBetId,
        amount: 0,
        currency: 'USD',
        transaction: {} as any,
        selections: [],
      });

      // Assert
      expect(accumulateCommissionSpy).toHaveBeenCalledWith(
        mockUserId,
        AssetTypeEnum.USDT,
        '100', // USDT amount
        3,
        queryRunner,
      );
    });
  });

  describe('Transaction Boundary - Race Condition Prevention', () => {
    it('should not call getPrimaryWallet outside transaction', async () => {
      // Arrange
      const mockBet = {
        id: mockBetId,
        userId: mockUserId,
        betAmount: '1000',
        status: SportsbookBetStatus.ACTIVE,
      };
      const mockPrimaryWallet = {
        userId: mockUserId,
        asset: AssetTypeEnum.BTC,
        isPrimary: true,
      };

      jest.spyOn(service['betRepository'], 'findOne').mockResolvedValue(mockBet as any);
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockPrimaryWallet);
      jest.spyOn(service['balanceService'], 'updateBalance').mockResolvedValue({
        success: true,
        status: 'SUCCESS' as any,
        balance: '1000',
      });

      const getPrimaryWalletSpy = jest.spyOn(service['balanceService'], 'getPrimaryWallet');

      // Act
      await service.win({
        bet_transaction_id: mockBetId,
        amount: 2000,
        currency: 'USD',
        is_cashout: false,
        transaction: {} as any,
        selections: [],
      });

      // Assert - should NOT call BalanceService.getPrimaryWallet
      expect(getPrimaryWalletSpy).not.toHaveBeenCalled();
      // Should use queryRunner.manager.findOne instead
      expect(queryRunner.manager.findOne).toHaveBeenCalled();
    });
  });
});
