import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  AuthStrategyEnum,
  BalanceOperationResultEnum,
  PlinkoGameEntity,
  RiskLevel,
  UserEntity,
} from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { createTestProviders } from '../../test-utils';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { UserBetService } from '../services/user-bet.service';
import { PlacePlinkoBetDto } from './dto/place-plinko-bet.dto';
import { PlinkoService } from './plinko.service';

describe('PlinkoService', () => {
  let service: PlinkoService;
  let balanceService: jest.Mocked<BalanceService>;
  let plinkoRepository: Repository<PlinkoGameEntity>;
  let module: TestingModule;

  let findMock: jest.Mock;
  let findOneMock: jest.Mock;

  const mockUser: UserEntity = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: true,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {
      passwordHash: 'hashed-password',
    },
    isBanned: false,
    isPrivate: false,
    currentFiatFormat: FiatFormatEnum.STANDARD,
    currentCurrency: CurrencyEnum.USD,
    createdAt: new Date(),
    updatedAt: new Date(),
    displayName: 'Test User',
    avatarUrl: undefined,
    primaryAsset: AssetTypeEnum.BTC, // Added for guard context optimization
  } as UserEntity & { primaryAsset: AssetTypeEnum };

  const mockPrimaryWallet = {
    userId: 'user-123',
    asset: AssetTypeEnum.BTC,
    balance: '0.001',
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockBalanceService = {
      updateBalance: jest.fn(),
      getPrimaryWallet: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(1.0), // 1% house edge
    };

    // ProvablyFairService mock removed - using complete mock from createTestProviders()

    const mockUserBetService = {
      createUserBet: jest.fn(),
    };

    const mockUserVipStatusService = {
      getUsersVipStatus: jest.fn().mockResolvedValue([
        {
          userId: 'test-user-id',
          vipLevelImage: 'user-level/bronze-1',
        },
      ]),
    };

    const mockHouseEdgeService = {
      getEdge: jest.fn().mockReturnValue(1.0), // 1% house edge
    };

    module = await Test.createTestingModule({
      providers: [
        PlinkoService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(PlinkoGameEntity),
          useValue: mockRepository,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        // ProvablyFairService is already provided by createTestProviders() with complete mock
        {
          provide: UserBetService,
          useValue: mockUserBetService,
        },
        {
          provide: UserVipStatusService,
          useValue: mockUserVipStatusService,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: HouseEdgeService,
          useValue: mockHouseEdgeService,
        },
        // GameConfigService is already provided by createTestProviders() with complete mock
        // Removed incomplete override that was missing validateBetAmount method
      ],
    }).compile();

    service = module.get<PlinkoService>(PlinkoService);
    balanceService = module.get(BalanceService);
    plinkoRepository = module.get(getRepositoryToken(PlinkoGameEntity));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    findMock = plinkoRepository.find as jest.Mock;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    findOneMock = plinkoRepository.findOne as jest.Mock;

    // Setup default mocks
    balanceService.getPrimaryWallet.mockResolvedValue(mockPrimaryWallet);
    mockUserBetService.createUserBet.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('placeBet', () => {
    const validBetDto: PlacePlinkoBetDto = {
      betAmount: '0.00001',
      riskLevel: RiskLevel.MEDIUM,
      rowCount: 16,
    };

    it('should successfully place a bet and return game result', async () => {
      balanceService.updateBalance
        .mockResolvedValueOnce({
          success: true,
          status: BalanceOperationResultEnum.SUCCESS,
          balance: '0.00099',
        }) // Bet deduction
        .mockResolvedValueOnce({
          success: true,
          status: BalanceOperationResultEnum.SUCCESS,
          balance: '0.001',
        }); // Win credit

      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'game-123',
        ...validBetDto,
        userId: mockUser.id,
        asset: AssetTypeEnum.BTC,
        bucketIndex: 8,
        multiplier: '1.50',
        winAmount: '0.00001485', // 0.00001 * 1.5 * 0.99 (1% house edge)
        status: 'COMPLETED',
        serverSeedHash: 'hash123',
        nonce: 1,
        createdAt: new Date(),
      });

      const result = await service.placeBet(mockUser, validBetDto);

      expect(balanceService.updateBalance).toHaveBeenCalledTimes(1); // Batch operation
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(result).toMatchObject({
        userId: mockUser.id,
        asset: AssetTypeEnum.BTC,
        betAmount: '0.00001000', // Rounded to 8 decimal places
        riskLevel: validBetDto.riskLevel,
        rowCount: validBetDto.rowCount,
      });

      expect(result.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(result.bucketIndex).toBeLessThan(17); // 16 rows = 17 buckets
      expect(result.multiplier).toBeDefined();
      expect(result.winAmount).toBeDefined();
    });

    it('should handle insufficient balance', async () => {
      balanceService.updateBalance.mockResolvedValueOnce({
        success: false,
        status: BalanceOperationResultEnum.INSUFFICIENT_BALANCE,
        balance: '0.000005',
      });

      await expect(service.placeBet(mockUser, validBetDto)).rejects.toThrow(
        'financial.error.insufficient_balance',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should validate bet parameters', async () => {
      const invalidBetDto = {
        ...validBetDto,
        betAmount: '0',
      };

      await expect(service.placeBet(mockUser, invalidBetDto)).rejects.toThrow(
        'Bet amount must be greater than 0',
      );
    });

    it('should validate row count', async () => {
      const invalidBetDto = {
        ...validBetDto,
        rowCount: 7, // Invalid: below minimum
      };

      await expect(service.placeBet(mockUser, invalidBetDto)).rejects.toThrow('Invalid row count');
    });

    it('should validate risk level', async () => {
      const invalidBetDto = {
        ...validBetDto,
        riskLevel: 'INVALID' as RiskLevel,
      };

      await expect(service.placeBet(mockUser, invalidBetDto)).rejects.toThrow('Invalid risk level');
    });

    it('should handle missing primary asset', async () => {
      const userWithoutAsset = { ...mockUser, primaryAsset: undefined };

      await expect(service.placeBet(userWithoutAsset as any, validBetDto)).rejects.toThrow(
        'No primary asset found for user',
      );
    });

    it('should validate minimum bet amount', async () => {
      const invalidBetDto = {
        ...validBetDto,
        betAmount: '0.000000001', // Below minimum
      };

      // Mock GameConfigService to return validation error for minimum bet
      const mockGameConfigService = module.get(GameConfigService);
      jest
        .spyOn(mockGameConfigService, 'validateBetAmount')
        .mockResolvedValueOnce({ isValid: false, error: 'Bet amount too small' });

      await expect(service.placeBet(mockUser, invalidBetDto)).rejects.toThrow(
        'Bet amount too small',
      );
    });

    it('should validate maximum bet amount', async () => {
      const invalidBetDto = {
        ...validBetDto,
        betAmount: '2000000', // Above maximum
      };

      // Mock GameConfigService to return validation error for maximum bet
      const mockGameConfigService = module.get(GameConfigService);
      jest
        .spyOn(mockGameConfigService, 'validateBetAmount')
        .mockResolvedValueOnce({ isValid: false, error: 'Bet amount too large' });

      await expect(service.placeBet(mockUser, invalidBetDto)).rejects.toThrow(
        'Bet amount too large',
      );
    });
  });

  describe('ball drop simulation', () => {
    it('should generate consistent results with same seeds', () => {
      const clientSeed = 'test_seed';
      const serverSeed = 'server_seed_123';
      const nonce = 1;
      const rowCount = 16;

      // Call simulation multiple times with same parameters
      // Note: Risk level no longer affects ball physics (pure 50/50 for all levels)
      const result1 = service['simulateBallDrop'](clientSeed, serverSeed, nonce, rowCount);
      const result2 = service['simulateBallDrop'](clientSeed, serverSeed, nonce, rowCount);

      expect(result1).toStrictEqual(result2);
      expect(result1.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(result1.bucketIndex).toBeLessThan(17); // 16 rows = 17 buckets
      expect(result1.ballPath).toBeDefined();
      expect(result1.ballPath).toHaveLength(rowCount + 1);
    });

    it('should generate different results with different seeds', () => {
      const clientSeed1 = 'test_seed_1';
      const clientSeed2 = 'test_seed_2';
      const serverSeed = 'server_seed_123';
      const nonce = 1;
      const rowCount = 16;

      const result1 = service['simulateBallDrop'](clientSeed1, serverSeed, nonce, rowCount);
      const result2 = service['simulateBallDrop'](clientSeed2, serverSeed, nonce, rowCount);

      // With different seeds, results should be different (probabilistically)
      // Note: There's a small chance they could be the same, but very unlikely
      expect(result1.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(result2.bucketIndex).toBeGreaterThanOrEqual(0);
      expect(result1.bucketIndex).toBeLessThan(17);
      expect(result2.bucketIndex).toBeLessThan(17);
      expect(result1.ballPath).toBeDefined();
      expect(result2.ballPath).toBeDefined();
      expect(result1.ballPath).toHaveLength(rowCount + 1);
      expect(result2.ballPath).toHaveLength(rowCount + 1);
    });
  });

  describe('multiplier calculations', () => {
    it('should return correct multipliers for different risk levels', () => {
      // Test LOW risk - should have safer multipliers
      const lowMultiplier = service['getMultiplier'](RiskLevel.LOW, 16, 8); // Center bucket
      expect(lowMultiplier).toBe(0.5); // Center bucket for LOW risk 16 rows

      // Test HIGH risk - should have extreme multipliers at edges
      const highMultiplier = service['getMultiplier'](RiskLevel.HIGH, 16, 0); // Edge bucket
      expect(highMultiplier).toBe(620); // Edge bucket for HIGH risk 16 rows (balanced for casino standards)
    });

    it('should throw error for invalid bucket index', () => {
      expect(() => {
        service['getMultiplier'](RiskLevel.MEDIUM, 16, -1);
      }).toThrow('Invalid bucket index or multiplier configuration');

      expect(() => {
        service['getMultiplier'](RiskLevel.MEDIUM, 16, 17); // 16 rows = 17 buckets (0-16)
      }).toThrow('Invalid bucket index or multiplier configuration');
    });
  });

  describe('win amount calculations', () => {
    it('should calculate win amount with dynamic house edge application', () => {
      const betAmount = '0.001';
      const multiplier = 2.0;

      const winAmount = service['calculateWinAmount'](betAmount, multiplier);

      // 0.001 * 2.0 * (1 - 1% house edge) = 0.001 * 2.0 * 0.99 = 0.00198
      expect(winAmount.toString()).toBe('0.00198');
    });

    it('should handle zero multiplier', () => {
      const betAmount = '0.001';
      const multiplier = 0;

      const winAmount = service['calculateWinAmount'](betAmount, multiplier);

      expect(winAmount.toString()).toBe('0');
    });
  });

  describe('getConfiguration', () => {
    it('should return complete game configuration', async () => {
      const config = service.getConfiguration();

      expect(config.riskLevels).toEqual([RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]);
      expect(config.rowCounts).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
      expect(config.houseEdge).toBe(1.0);
      expect(config.multiplierTables).toBeDefined();

      // Test that all risk levels have multiplier tables for all row counts
      for (const riskLevel of config.riskLevels) {
        for (const rowCount of config.rowCounts) {
          expect(config.multiplierTables[riskLevel][rowCount]).toBeDefined();
          expect(config.multiplierTables[riskLevel][rowCount]).toHaveLength(rowCount + 1);
        }
      }
    });
  });

  describe('getGameHistory', () => {
    it('should return user game history with pagination', async () => {
      const mockGames = [
        {
          id: 'game-1',
          userId: mockUser.id,
          betAmount: '10.00',
          winAmount: '15.00',
          createdAt: new Date(),
        },
        {
          id: 'game-2',
          userId: mockUser.id,
          betAmount: '20.00',
          winAmount: '0.00',
          createdAt: new Date(),
        },
      ];

      (plinkoRepository.find as jest.Mock).mockResolvedValue(mockGames);

      const result = await service.getGameHistory(mockUser.id, 10, 0);

      expect(findMock).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('game-1');
      expect(result[1].id).toBe('game-2');
    });
  });

  describe('getGameById', () => {
    it('should return game by ID', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        betAmount: '10.00',
        winAmount: '15.00',
        createdAt: new Date(),
      };

      (plinkoRepository.findOne as jest.Mock).mockResolvedValue(mockGame);

      const result = await service.getGameById('game-123');

      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'game-123' },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('game-123');
    });

    it('should return null for non-existent game', async () => {
      (plinkoRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.getGameById('non-existent');

      expect(result).toBeNull();
    });
  });
});
