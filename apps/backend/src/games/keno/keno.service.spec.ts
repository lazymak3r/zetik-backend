import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AuthStrategyEnum,
  GameTypeEnum,
  KenoGameEntity,
  KenoRiskLevel,
  UserEntity,
} from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';

import { createTestProviders } from '../../test-utils/common-providers';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { KenoService } from './keno.service';

describe('KenoService', () => {
  let service: KenoService;
  let kenoGameRepository: Repository<KenoGameEntity>;

  const mockUser: Partial<UserEntity> = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: true,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: { passwordHash: 'hash' },
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBalanceService = {
    updateBalance: jest.fn(),
    updateFiatBalance: jest.fn(),
    getPrimaryWallet: jest.fn().mockResolvedValue({
      id: 'wallet-id',
      asset: 'BTC',
      balance: '1.0',
    }),
  };

  const mockProvablyFairService = {
    generateGameOutcome: jest.fn(),
    calculateOutcome: jest.fn(),
    getBetSeedInfo: jest.fn(),
  };

  const mockUserBetService = {
    createUserBet: jest.fn(),
    getUserBets: jest.fn(),
  };

  const mockUserVipStatusService = {
    getUsersVipStatus: jest.fn().mockResolvedValue([
      {
        userId: 'test-user-id',
        vipLevelImage: 'user-level/bronze-1',
      },
    ]),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KenoService,
        ...createTestProviders(),
        // Override specific mocks after createTestProviders
        {
          provide: getRepositoryToken(KenoGameEntity),
          useClass: Repository,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: ProvablyFairService,
          useValue: mockProvablyFairService,
        },
        {
          provide: UserBetService,
          useValue: mockUserBetService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: UserVipStatusService,
          useValue: mockUserVipStatusService,
        },
      ],
    }).compile();

    service = module.get<KenoService>(KenoService);
    kenoGameRepository = module.get<Repository<KenoGameEntity>>(getRepositoryToken(KenoGameEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('placeBet', () => {
    it('should place a keno bet successfully', async () => {
      const dto = {
        betAmount: '0.001',
        selectedNumbers: [1, 5, 10, 15, 20],
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      // Mock provably fair service
      mockProvablyFairService.generateGameOutcome.mockResolvedValue({
        value: 0.5, // Normalized value for KENO
        hash: 'server-seed-hash',
        nonce: '1',
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
      });

      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '0.999',
      });

      // Mock user bet service
      mockUserBetService.createUserBet.mockResolvedValue({
        id: 'bet-id',
      });

      // Mock number generation to return specific drawn numbers that match our expectations
      jest
        .spyOn(service as any, 'generateDrawnNumbers')
        .mockReturnValue([1, 5, 10, 12, 18, 22, 25, 28, 31, 34]);

      jest.spyOn(kenoGameRepository, 'create').mockReturnValue({
        id: 'game-id',
        userId: mockUser.id,
        gameSessionId: 'session-id',
        betAmount: '0.001',
        asset: 'BTC',
        riskLevel: KenoRiskLevel.CLASSIC,
        selectedNumbers: dto.selectedNumbers,
        drawnNumbers: [1, 5, 10, 12, 18, 22, 25, 28, 31, 34], // Matches [1, 5, 10] from selected [1, 5, 10, 15, 20] - 10 numbers from 1-40
        matches: 3,
        winAmount: '0.0038',
        payoutMultiplier: '4.1',
        serverSeed: 'server-seed',
        serverSeedHash: 'server-seed-hash',
        clientSeed: 'client-seed',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as KenoGameEntity);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const queryRunner = mockDataSource.createQueryRunner();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      queryRunner.manager.save.mockResolvedValue({
        id: 'game-id',
        userId: 'test-user-id',
        gameSessionId: 'session-id',
        betAmount: '0.001',
        asset: 'BTC',
        riskLevel: KenoRiskLevel.CLASSIC,
        selectedNumbers: [1, 5, 10, 15, 20],
        drawnNumbers: [1, 5, 10, 12, 18, 22, 25, 28, 31, 34],
        matches: 3,
        winAmount: '0.0038',
        payoutMultiplier: '4.1',
        status: 'completed',
        serverSeed: 'server-seed',
        serverSeedHash: 'server-seed-hash',
        clientSeed: 'client-seed',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.placeBet(mockUser as UserEntity, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('game-id');
      expect(mockProvablyFairService.generateGameOutcome).toHaveBeenCalledWith(
        mockUser.id,
        GameTypeEnum.KENO,
        '0.001',
      );
      expect(mockUserBetService.createUserBet).toHaveBeenCalledWith({
        game: GameTypeEnum.KENO,
        betId: 'game-id',
        userId: mockUser.id,
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '4.1',
        payout: '0.0041',
      });
      expect(mockBalanceService.getPrimaryWallet).toHaveBeenCalledWith(mockUser.id);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledTimes(1); // Batch update: [BET, WIN]
    });

    it('should handle winning bet correctly', async () => {
      const dto = {
        betAmount: '0.001',
        selectedNumbers: [1, 5, 10],
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      // Mock provably fair service
      mockProvablyFairService.generateGameOutcome.mockResolvedValue({
        value: 0.3, // Normalized value for KENO
        hash: 'server-seed-hash',
        nonce: '1',
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
      });

      mockBalanceService.updateBalance.mockResolvedValue({
        success: true,
        balance: '0.999',
      });

      mockUserBetService.createUserBet.mockResolvedValue({
        id: 'bet-id',
      });

      jest.spyOn(kenoGameRepository, 'create').mockReturnValue({
        id: 'game-id',
        userId: mockUser.id,
        gameSessionId: 'session-id',
        betAmount: '0.001',
        asset: 'BTC',
        riskLevel: KenoRiskLevel.CLASSIC,
        selectedNumbers: dto.selectedNumbers,
        drawnNumbers: [
          1, 5, 10, 51, 52, 53, 54, 55, 56, 57, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
        ], // 3 matches
        matches: 3,
        winAmount: '0.003', // Win amount: 3.0 * 0.001
        payoutMultiplier: '4.1',
        serverSeed: 'server-seed',
        serverSeedHash: 'server-seed-hash',
        clientSeed: 'client-seed',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as KenoGameEntity);

      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.save.mockResolvedValue({
        id: 'game-id',
      });

      const result = await service.placeBet(mockUser as UserEntity, dto);

      expect(result).toBeDefined();
      expect(mockBalanceService.getPrimaryWallet).toHaveBeenCalledWith(mockUser.id);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledTimes(1); // Batch update: [BET, WIN]
    });

    it('should place bet with different risk levels', async () => {
      const riskLevels = [
        KenoRiskLevel.CLASSIC,
        KenoRiskLevel.LOW,
        KenoRiskLevel.MEDIUM,
        KenoRiskLevel.HIGH,
      ];

      for (const riskLevel of riskLevels) {
        const dto = {
          betAmount: '0.001',
          selectedNumbers: [1, 5, 10],
          riskLevel,
          gameSessionId: 'session-id',
        };

        mockBalanceService.getPrimaryWallet.mockResolvedValue({
          asset: 'BTC',
          balance: '1.0',
        });

        mockProvablyFairService.generateGameOutcome.mockResolvedValue({
          value: 0.5,
          hash: 'server-seed-hash',
          nonce: '1',
          serverSeed: 'server-seed',
          clientSeed: 'client-seed',
        });

        mockBalanceService.updateBalance.mockResolvedValue({
          success: true,
          balance: '0.999',
        });

        mockUserBetService.createUserBet.mockResolvedValue({
          id: 'bet-id',
        });

        jest.spyOn(kenoGameRepository, 'create').mockReturnValue({
          id: `game-id-${riskLevel}`,
          userId: mockUser.id,
          gameSessionId: 'session-id',
          betAmount: '0.001',
          asset: 'BTC',
          riskLevel,
          selectedNumbers: dto.selectedNumbers,
          drawnNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
          matches: 1,
          winAmount: '0',
          payoutMultiplier: '0',
          serverSeed: 'server-seed',
          serverSeedHash: 'server-seed-hash',
          clientSeed: 'client-seed',
          nonce: '1',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as KenoGameEntity);

        const queryRunner = mockDataSource.createQueryRunner();
        queryRunner.manager.save.mockResolvedValue({
          id: `game-id-${riskLevel}`,
          riskLevel,
          userId: 'test-user-id',
          gameSessionId: 'session-id',
          betAmount: '0.001',
          asset: 'BTC',
          selectedNumbers: dto.selectedNumbers,
          drawnNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
          matches: 1,
          winAmount: '0',
          payoutMultiplier: '0',
          status: 'completed',
          serverSeed: 'server-seed',
          serverSeedHash: 'server-seed-hash',
          clientSeed: 'client-seed',
          nonce: '1',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await service.placeBet(mockUser as UserEntity, dto);

        expect(result).toBeDefined();
        expect(result.riskLevel).toBe(riskLevel);
        expect(result.id).toBe(`game-id-${riskLevel}`);

        jest.clearAllMocks();
      }
    });

    it('should throw error for duplicate numbers', async () => {
      const dto = {
        betAmount: '100.00',
        selectedNumbers: [1, 5, 5, 15, 20], // Duplicate 5
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as UserEntity, dto)).rejects.toThrow(
        new BadRequestException('Duplicate numbers are not allowed'),
      );
    });

    it('should throw error for numbers out of range', async () => {
      const dto = {
        betAmount: '100.00',
        selectedNumbers: [1, 5, 10, 15, 81], // 81 is out of range
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as UserEntity, dto)).rejects.toThrow(
        new BadRequestException('Selected numbers must be integers between 1 and 40'),
      );
    });

    it('should throw error for too many numbers', async () => {
      const dto = {
        betAmount: '100.00',
        selectedNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // 11 numbers (max 10)
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as UserEntity, dto)).rejects.toThrow(
        new BadRequestException('Maximum 10 numbers can be selected'),
      );
    });

    it('should throw error for no numbers selected', async () => {
      const dto = {
        betAmount: '100.00',
        selectedNumbers: [], // No numbers
        riskLevel: KenoRiskLevel.CLASSIC,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as UserEntity, dto)).rejects.toThrow(
        new BadRequestException('At least one number must be selected'),
      );
    });
  });

  describe('getConfiguration', () => {
    it('should return keno configuration', async () => {
      const config = service.getConfig();

      expect(config).toBeDefined();
      expect(config.riskLevels).toEqual(Object.values(KenoRiskLevel));
      expect(config.multiplierTables).toBeDefined();
      expect(config.multiplierTables[KenoRiskLevel.CLASSIC]).toBeDefined();
      expect(config.multiplierTables[KenoRiskLevel.LOW]).toBeDefined();
      expect(config.multiplierTables[KenoRiskLevel.MEDIUM]).toBeDefined();
      expect(config.multiplierTables[KenoRiskLevel.HIGH]).toBeDefined();
    });
  });

  describe('calculateMatches', () => {
    it('should calculate matches correctly', () => {
      const selectedNumbers = [1, 5, 10, 15, 20];
      const drawnNumbers = [
        1, 2, 5, 8, 10, 12, 15, 18, 20, 25, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
      ];

      const matches = service['calculateMatches'](selectedNumbers, drawnNumbers);

      expect(matches).toBe(5); // All 5 numbers match
    });

    it('should handle no matches', () => {
      const selectedNumbers = [1, 5, 10];
      const drawnNumbers = [
        2, 6, 11, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76, 32, 37, 42, 47, 52, 57, 62,
      ];

      const matches = service['calculateMatches'](selectedNumbers, drawnNumbers);

      expect(matches).toBe(0); // No matches
    });

    it('should handle partial matches', () => {
      const selectedNumbers = [1, 5, 10, 15, 20];
      const drawnNumbers = [
        1, 2, 5, 8, 11, 12, 16, 18, 21, 25, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
      ];

      const matches = service['calculateMatches'](selectedNumbers, drawnNumbers);

      expect(matches).toBe(2); // Only 1 and 5 match
    });
  });

  describe('getPayoutMultiplier', () => {
    it('should return correct multiplier for classic risk', () => {
      const multiplier = service['getPayoutMultiplier'](KenoRiskLevel.CLASSIC, 5, 3);

      // Fixed multiplier from table: CLASSIC, 5 selected, 3 matches = 4.1
      expect(multiplier).toBe(4.1); // From CLASSIC table for 5 selected, 3 matches
    });

    it('should return 0 for invalid parameters', () => {
      const multiplier = service['getPayoutMultiplier'](KenoRiskLevel.CLASSIC, 5, 6); // More matches than selected

      expect(multiplier).toBe(0);
    });

    it('should return 0 for out of range matches', () => {
      const multiplier = service['getPayoutMultiplier'](KenoRiskLevel.CLASSIC, 5, 10); // Matches > selected

      expect(multiplier).toBe(0);
    });

    it('should return fixed multiplier without dynamic adjustment', () => {
      const multiplier = service['getPayoutMultiplier'](KenoRiskLevel.CLASSIC, 5, 3);

      // Fixed multiplier from table (no dynamic adjustment)
      expect(multiplier).toBe(4.1);
    });
  });
});
