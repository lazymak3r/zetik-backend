import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceWalletEntity,
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Repository } from 'typeorm';

import { BalanceService } from '../../../balance/balance.service';
import { CryptoConverterService } from '../../../balance/services/crypto-converter.service';
import { createTestProviders } from '../../../test-utils';
import { BonusTransactionService } from '../bonus-transaction.service';

describe('BonusTransactionService - Currency Selection Logic', () => {
  let service: BonusTransactionService;
  let mockTxRepo: jest.Mocked<Repository<BonusTransactionEntity>>;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockCryptoConverter: jest.Mocked<CryptoConverterService>;

  const userId = 'test-user-id';
  const bonusId = 'test-bonus-id';

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockBalance = {
      getPrimaryWallet: jest.fn(),
      updateBalance: jest.fn(),
    };

    const mockConverter = {
      fromCents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonusTransactionService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(BonusTransactionEntity),
          useValue: mockRepository,
        },
        {
          provide: BalanceService,
          useValue: mockBalance,
        },
        {
          provide: CryptoConverterService,
          useValue: mockConverter,
        },
      ],
    }).compile();

    service = module.get<BonusTransactionService>(BonusTransactionService);
    mockTxRepo = module.get(getRepositoryToken(BonusTransactionEntity));
    mockBalanceService = module.get(BalanceService);
    mockCryptoConverter = module.get(CryptoConverterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('claim method - currency selection', () => {
    const createMockBonus = (bonusType: BonusTypeEnum): BonusTransactionEntity => ({
      id: bonusId,
      userId,
      amount: '10000', // $100 in cents
      bonusType,
      status: BonusTransactionStatusEnum.PENDING,
      description: `Test ${bonusType} bonus`,
      createdAt: new Date(),
      updatedAt: new Date(),
      claimedAt: undefined,
      updatedBy: undefined,
      metadata: {},
    });

    const createMockPrimaryWallet = (asset: AssetTypeEnum): BalanceWalletEntity => ({
      userId,
      asset,
      balance: '1.0',
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should use BTC for WEEKLY_RACE_PRIZE regardless of primary wallet', async () => {
      // Arrange
      const weeklyRaceBonus = createMockBonus(BonusTypeEnum.WEEKLY_RACE_PRIZE);
      const primaryWallet = createMockPrimaryWallet(AssetTypeEnum.ETH); // Primary is ETH

      mockTxRepo.findOne.mockResolvedValue(weeklyRaceBonus);
      mockBalanceService.getPrimaryWallet.mockResolvedValue(primaryWallet);
      mockCryptoConverter.fromCents.mockReturnValue('0.00015'); // Mock BTC amount
      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '1.0',
        status: 'SUCCESS' as any,
      });
      mockTxRepo.save.mockResolvedValue({
        ...weeklyRaceBonus,
        status: BonusTransactionStatusEnum.CLAIMED,
      });

      // Act
      await service.claim(userId, bonusId);

      // Assert
      expect(mockCryptoConverter.fromCents).toHaveBeenCalledWith('10000', AssetTypeEnum.BTC);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith({
        operation: BalanceOperationEnum.BONUS,
        operationId: bonusId,
        userId,
        amount: new BigNumber('0.00015'),
        asset: AssetTypeEnum.BTC, // Should be BTC, not ETH
        description: expect.stringContaining('Claim bonus'),
      });
    });

    it('should use primary wallet asset for non-race bonuses - LEVEL_UP', async () => {
      // Arrange
      const levelUpBonus = createMockBonus(BonusTypeEnum.LEVEL_UP);
      const primaryWallet = createMockPrimaryWallet(AssetTypeEnum.USDT); // Primary is USDT

      mockTxRepo.findOne.mockResolvedValue(levelUpBonus);
      mockBalanceService.getPrimaryWallet.mockResolvedValue(primaryWallet);
      mockCryptoConverter.fromCents.mockReturnValue('100.0'); // Mock USDT amount
      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '1000.0',
        status: 'SUCCESS' as any,
      });
      mockTxRepo.save.mockResolvedValue({
        ...levelUpBonus,
        status: BonusTransactionStatusEnum.CLAIMED,
      });

      // Act
      await service.claim(userId, bonusId);

      // Assert
      expect(mockCryptoConverter.fromCents).toHaveBeenCalledWith('10000', AssetTypeEnum.USDT);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith({
        operation: BalanceOperationEnum.BONUS,
        operationId: bonusId,
        userId,
        amount: new BigNumber('100.0'),
        asset: AssetTypeEnum.USDT, // Should use primary wallet asset
        description: expect.stringContaining('Claim bonus'),
      });
    });

    it('should use primary wallet asset for non-race bonuses - RAKEBACK', async () => {
      // Arrange
      const rakebackBonus = createMockBonus(BonusTypeEnum.RAKEBACK);
      const primaryWallet = createMockPrimaryWallet(AssetTypeEnum.ETH); // Primary is ETH

      mockTxRepo.findOne.mockResolvedValue(rakebackBonus);
      mockBalanceService.getPrimaryWallet.mockResolvedValue(primaryWallet);
      mockCryptoConverter.fromCents.mockReturnValue('0.05'); // Mock ETH amount
      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '5.05',
        status: 'SUCCESS' as any,
      });
      mockTxRepo.save.mockResolvedValue({
        ...rakebackBonus,
        status: BonusTransactionStatusEnum.CLAIMED,
      });

      // Act
      await service.claim(userId, bonusId);

      // Assert
      expect(mockCryptoConverter.fromCents).toHaveBeenCalledWith('10000', AssetTypeEnum.ETH);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith({
        operation: BalanceOperationEnum.BONUS,
        operationId: bonusId,
        userId,
        amount: new BigNumber('0.05'),
        asset: AssetTypeEnum.ETH,
        description: expect.stringContaining('Claim bonus'),
      });
    });

    it('should fallback to BTC when user has no primary wallet', async () => {
      // Arrange
      const dailyBonus = createMockBonus(BonusTypeEnum.RAKEBACK);

      mockTxRepo.findOne.mockResolvedValue(dailyBonus);
      mockBalanceService.getPrimaryWallet.mockResolvedValue(null); // No primary wallet
      mockCryptoConverter.fromCents.mockReturnValue('0.00015'); // Mock BTC amount
      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '0.00015',
        status: 'SUCCESS' as any,
      });
      mockTxRepo.save.mockResolvedValue({
        ...dailyBonus,
        status: BonusTransactionStatusEnum.CLAIMED,
      });

      // Act
      await service.claim(userId, bonusId);

      // Assert
      expect(mockCryptoConverter.fromCents).toHaveBeenCalledWith('10000', AssetTypeEnum.BTC);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith({
        operation: BalanceOperationEnum.BONUS,
        operationId: bonusId,
        userId,
        amount: new BigNumber('0.00015'),
        asset: AssetTypeEnum.BTC, // Should fallback to BTC
        description: expect.stringContaining('Claim bonus'),
      });
    });

    it('should test all bonus types use primary wallet except WEEKLY_RACE_PRIZE', async () => {
      const primaryWallet = createMockPrimaryWallet(AssetTypeEnum.USDC);

      mockBalanceService.getPrimaryWallet.mockResolvedValue(primaryWallet);
      mockCryptoConverter.fromCents.mockReturnValue('100.0');
      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '1100.0',
        status: 'SUCCESS' as any,
      });

      const bonusTypes = [
        BonusTypeEnum.LEVEL_UP,
        BonusTypeEnum.RAKEBACK,
        BonusTypeEnum.WEEKLY_AWARD,
        BonusTypeEnum.WEEKLY_AWARD,
        BonusTypeEnum.MONTHLY_AWARD,
      ];

      for (const bonusType of bonusTypes) {
        jest.clearAllMocks();

        const bonus = createMockBonus(bonusType);
        mockTxRepo.findOne.mockResolvedValue(bonus);
        mockTxRepo.save.mockResolvedValue({ ...bonus, status: BonusTransactionStatusEnum.CLAIMED });

        await service.claim(userId, bonusId);

        expect(mockCryptoConverter.fromCents).toHaveBeenCalledWith('10000', AssetTypeEnum.USDC);
        expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
          expect.objectContaining({
            asset: AssetTypeEnum.USDC, // Should use primary wallet asset
          }),
        );
      }
    });

    it('should throw NotFoundException when bonus not found', async () => {
      mockTxRepo.findOne.mockResolvedValue(null);

      await expect(service.claim(userId, bonusId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when bonus already claimed', async () => {
      const claimedBonus = createMockBonus(BonusTypeEnum.LEVEL_UP);
      claimedBonus.status = BonusTransactionStatusEnum.CLAIMED;

      mockTxRepo.findOne.mockResolvedValue(claimedBonus);

      await expect(service.claim(userId, bonusId)).rejects.toThrow(BadRequestException);
    });

    it('should handle balance update failure gracefully', async () => {
      // Arrange
      const bonus = createMockBonus(BonusTypeEnum.LEVEL_UP);
      const primaryWallet = createMockPrimaryWallet(AssetTypeEnum.BTC);

      mockTxRepo.findOne.mockResolvedValue(bonus);
      mockBalanceService.getPrimaryWallet.mockResolvedValue(primaryWallet);
      mockCryptoConverter.fromCents.mockReturnValue('0.001');
      mockBalanceService.updateBalance.mockResolvedValue({
        success: false,
        balance: '0',
        status: 'FAILED' as any,
        error: 'Insufficient funds',
      });
      mockTxRepo.save.mockResolvedValue({ ...bonus, status: BonusTransactionStatusEnum.CLAIMED });

      // Act & Assert - should not throw, just log error
      const result = await service.claim(userId, bonusId);
      expect(result.status).toBe(BonusTransactionStatusEnum.CLAIMED);
    });
  });
});
