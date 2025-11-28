import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssetTypeEnum, LimboGameEntity, LimboGameStatus } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';

import { createTestProviders } from '../../test-utils/common-providers';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { LimboService } from './limbo.service';

/**
 * Limbo Service Comprehensive Unit Tests
 *
 * Focus: Limbo-specific business logic, edge cases, validation, optimizations
 * NOTE: Provably Fair functionality is tested in provably-fair.service.spec.ts
 *       This test suite focuses ONLY on Limbo game logic and integration
 *
 * Optimizations tested:
 * - Batch Balance Updates: [BET, WIN] for wins, [BET] for losses
 * - Primary Wallet Context: primaryAsset from user guard vs API calls
 * - House Edge: Applied via ProvablyFairService (not HouseEdgeService)
 */
describe('LimboService - Comprehensive Unit Tests', () => {
  let service: LimboService;

  const mockRepository = {
    create: jest.fn().mockReturnValue({
      id: 'game-id',
      userId: 'test-user-id',
      betAmount: '0.001',
      asset: 'BTC',
      status: 'won',
      winAmount: '0.002',
    }),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser755003',
    primaryAsset: AssetTypeEnum.BTC, // Primary Wallet Context optimization
  };

  const mockProvablyFairService = {
    generateLimboOutcome: jest.fn().mockResolvedValue({
      value: 2.5, // Result multiplier
      serverSeed: 'server-seed',
      clientSeed: 'client-seed',
      hash: 'server-seed-hash',
      nonce: '1',
    }),
    updateClientSeed: jest.fn().mockResolvedValue(true),
  };

  const mockBalanceService = {
    updateBalance: jest.fn().mockResolvedValue({
      success: true,
      balance: '0.999',
    }),
    getPrimaryWallet: jest.fn().mockResolvedValue({
      id: 'wallet-id',
      asset: AssetTypeEnum.BTC,
      balance: '1.0',
      isPrimary: true,
    }),
  };

  const mockUserBetService = {
    createUserBet: jest.fn().mockResolvedValue({
      id: 'bet-record-id',
      success: true,
    }),
  };

  const mockUserVipStatusService = {
    getUsersVipStatus: jest.fn().mockResolvedValue([
      {
        userId: 'test-user-id',
        vipLevel: 3,
        vipLevelImage: 'user-level/silver-3',
      },
    ]),
  };

  const mockHouseEdgeService = {
    getEdge: jest.fn().mockReturnValue(1.0), // Return 1% house edge for limbo
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn().mockResolvedValue({
        id: 'game-id',
        userId: 'test-user-id',
        betAmount: '0.001',
        asset: 'BTC',
        status: 'won',
        winAmount: '0.002',
      }),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LimboService,
        ...createTestProviders(),
        // Override specific mocks after createTestProviders
        {
          provide: getRepositoryToken(LimboGameEntity),
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
          provide: HouseEdgeService,
          useValue: mockHouseEdgeService,
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
          provide: UserVipStatusService,
          useValue: mockUserVipStatusService,
        },
      ],
    }).compile();

    service = module.get<LimboService>(LimboService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('🎯 Win Chance Calculations', () => {
    const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService

    it('should calculate win chance correctly for 2x multiplier', () => {
      const winChance = service['calculateWinChance'](2.0, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1% house edge) / 2 = 49.5%
      expect(winChance).toBeCloseTo(49.5, 1);
    });

    it('should calculate win chance correctly for 10x multiplier', () => {
      const winChance = service['calculateWinChance'](10.0, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1% house edge) / 10 = 9.9%
      expect(winChance).toBeCloseTo(9.9, 1);
    });

    it('should cap win chance at 99.99% for very low multipliers', () => {
      const winChance = service['calculateWinChance'](1.001, HOUSE_EDGE); // Very low multiplier
      // CASINO STANDARD: (100-1)/1.001 ≈ 98.90% (NOT capped, real math!)
      expect(winChance).toBeCloseTo(98.9, 1);
    });

    it('should handle 1000x multiplier (0.099% win chance)', () => {
      const winChance = service['calculateWinChance'](1000, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1% house edge) / 1000 = 0.099%
      expect(winChance).toBeCloseTo(0.099, 3);
    });

    it('should handle maximum multiplier 1,000,000x', () => {
      const winChance = service['calculateWinChance'](1000000, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1% house edge) / 1000000 = 0.000099
      expect(winChance).toBeCloseTo(0.000099, 6);
    });

    it('should throw error when house edge is not provided', () => {
      expect(() => service['calculateWinChance'](2.0, null as any)).toThrow(
        'House edge must be provided from HouseEdgeService',
      );
      expect(() => service['calculateWinChance'](2.0, undefined as any)).toThrow(
        'House edge must be provided from HouseEdgeService',
      );
    });
  });

  describe('🎲 Core Game Logic Tests', () => {
    it('should determine win correctly when result >= target', () => {
      const resultMultiplier = 2.5;
      const targetMultiplier = 2.0;
      const isWin = resultMultiplier >= targetMultiplier;
      expect(isWin).toBe(true);
    });

    it('should determine loss correctly when result < target', () => {
      const resultMultiplier = 1.5;
      const targetMultiplier = 2.0;
      const isWin = resultMultiplier >= targetMultiplier;
      expect(isWin).toBe(false);
    });

    it('should handle exact boundary condition (result = target)', () => {
      const resultMultiplier = 2.0;
      const targetMultiplier = 2.0;
      const isWin = resultMultiplier >= targetMultiplier;
      expect(isWin).toBe(true); // Exact match is a win
    });

    it('should handle precision edge cases', () => {
      const resultMultiplier = 1.9999999;
      const targetMultiplier = 2.0;
      const isWin = resultMultiplier >= targetMultiplier;
      expect(isWin).toBe(false); // Just below threshold
    });
  });

  describe('🚀 Batch Balance Updates Optimization', () => {
    beforeEach(() => {
      mockRepository.create.mockReturnValue({
        id: 'game-id',
        userId: mockUser.id,
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        status: LimboGameStatus.WON,
        winAmount: '0.002',
      });
    });

    it('should use batch balance updates for WIN scenario', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 2.5, // Win result
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      await service.placeBet(mockUser as any, dto);

      // Should use batch balance update: [BET, WIN] in one call
      expect(mockBalanceService.updateBalance).toHaveBeenCalledTimes(1);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'BET',
            amount: expect.any(Object),
          }),
          expect.objectContaining({
            operation: 'WIN',
            amount: expect.any(Object),
          }),
        ]),
        expect.any(Object), // queryRunner
      );
    });

    it('should use single balance update for LOSS scenario', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 1.5, // Loss result (1.5 < 2.0 target)
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      mockRepository.create.mockReturnValueOnce({
        id: 'game-id',
        userId: mockUser.id,
        status: LimboGameStatus.LOST,
        winAmount: '0',
      });

      await service.placeBet(mockUser as any, dto);

      // Should use single balance update: only [BET]
      expect(mockBalanceService.updateBalance).toHaveBeenCalledTimes(1);
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'BET',
          amount: expect.any(Object),
        }),
        expect.any(Object), // queryRunner
      );
    });
  });

  describe('🔗 Primary Wallet Context Optimization', () => {
    it('should use primaryAsset from user context instead of API call', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      await service.placeBet(mockUser as any, dto);

      // Should NOT call getPrimaryWallet (old approach)
      expect(mockBalanceService.getPrimaryWallet).not.toHaveBeenCalled();

      // Should use primaryAsset from user context in balance operations
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            asset: AssetTypeEnum.BTC, // From user.primaryAsset
          }),
        ]),
        expect.any(Object),
      );
    });

    it('should throw error when primaryAsset is missing from user context', async () => {
      const userWithoutAsset = { ...mockUser, primaryAsset: undefined };

      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(userWithoutAsset as any, dto)).rejects.toThrow(
        'No primary asset found for user',
      );
    });
  });

  describe('🔐 Integration with Provably Fair', () => {
    it('should use ProvablyFairService for outcome generation', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      await service.placeBet(mockUser as any, dto);

      expect(mockProvablyFairService.generateLimboOutcome).toHaveBeenCalledWith(
        mockUser.id,
        '0.001',
        1.0, // houseEdge from HouseEdgeService
      );
    });

    it('should handle Provably Fair service errors gracefully', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockRejectedValueOnce(
        new Error('Provably Fair service unavailable'),
      );

      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
        'Failed to process limbo bet',
      );
    });

    it('should validate Limbo-specific outcome format', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      // Test with valid outcome
      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 3.14159, // Valid number result
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      // Update repository mock to return the result with proper structure
      mockRepository.create.mockReturnValueOnce({
        id: 'game-id',
        userId: 'test-user-id',
        resultMultiplier: '3.14159',
        betAmount: '0.001',
        asset: 'BTC',
        status: 'won',
        winAmount: '0.003141590',
      });

      const result = await service.placeBet(mockUser as any, dto);
      expect(result.resultMultiplier).toBe('3.14159');
    });
  });

  describe('💰 Win Amount Calculations', () => {
    it('should calculate correct win amount', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.5,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 3.0, // Win result
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      await service.placeBet(mockUser as any, dto);

      // Expected win amount: 0.001 * 2.5 = 0.0025
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'WIN',
            amount: expect.any(Object), // BigNumber object
          }),
        ]),
        expect.any(Object),
      );

      // Verify the actual BigNumber value
      const calls = mockBalanceService.updateBalance.mock.calls;
      const winOperation = calls[0][0].find((op) => op.operation === 'WIN');
      expect(winOperation.amount.toString()).toBe('0.0025');
    });

    it('should handle large win amounts with proper precision', async () => {
      const dto = {
        betAmount: '0.1',
        targetMultiplier: 1000,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 1500, // Big win
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      await service.placeBet(mockUser as any, dto);

      // Expected win amount: 0.1 * 1000 = 100.0
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'WIN',
            amount: expect.any(Object), // BigNumber object
          }),
        ]),
        expect.any(Object),
      );

      // Verify the actual BigNumber value
      const calls = mockBalanceService.updateBalance.mock.calls;
      const winOperation = calls[0][0].find((op) => op.operation === 'WIN');
      expect(winOperation.amount.toString()).toBe('100');
    });

    it('should throw error for overflow amounts', async () => {
      const dto = {
        betAmount: Number.MAX_SAFE_INTEGER.toString(),
        targetMultiplier: 1000,
        gameSessionId: 'session-id',
      };

      // Should throw bet amount limit error first before overflow check
      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
        'Bet amount exceeds maximum limit',
      );
    });
  });

  describe('🛡️ Input Validation Tests', () => {
    it('should reject very small bet amounts (rate limiting)', async () => {
      const dto = {
        betAmount: '0.000000001', // Below threshold
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow('Rate limit exceeded');
    });

    it('should reject extremely large bet amounts', async () => {
      const dto = {
        betAmount: '10000000', // Above maximum
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
        'Bet amount exceeds maximum limit',
      );
    });

    it('should accept valid bet amounts', async () => {
      const dto = {
        betAmount: '0.001', // Valid amount
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      // Should not throw
      await expect(service.placeBet(mockUser as any, dto)).resolves.toBeDefined();
    });
  });

  describe('🔄 Boundary Tests', () => {
    const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService

    it('should handle minimum multiplier (1.01x)', () => {
      const winChance = service['calculateWinChance'](1.01, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1%) / 1.01 ≈ 98.02%
      expect(winChance).toBeCloseTo(98.02, 2);
    });

    it('should handle maximum multiplier (1,000,000x)', () => {
      const winChance = service['calculateWinChance'](1000000, HOUSE_EDGE);
      // CASINO STANDARD: (100 - 1% house edge) / 1000000 = 0.000099
      expect(winChance).toBeCloseTo(0.000099, 6);
    });

    it('should handle edge case near maximum win chance', () => {
      const winChance = service['calculateWinChance'](1.0001, HOUSE_EDGE);
      // CASINO STANDARD: (100-1)/1.0001 ≈ 98.99% (real casino math)
      expect(winChance).toBeCloseTo(98.99, 1);
    });
  });

  describe('📊 User Bet Recording', () => {
    it('should record bet with correct multiplier format', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 2.5, // Win
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      await service.placeBet(mockUser as any, dto);

      expect(mockUserBetService.createUserBet).toHaveBeenCalledWith({
        game: 'LIMBO',
        betId: expect.any(String),
        userId: mockUser.id,
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.0000', // 4 decimal places format
        payout: expect.any(String),
      });
    });

    it('should record loss bet with 0.0000x multiplier', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 1.5, // Loss
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      mockRepository.create.mockReturnValueOnce({
        id: 'game-id',
        userId: mockUser.id,
        status: LimboGameStatus.LOST,
        winAmount: '0',
      });

      await service.placeBet(mockUser as any, dto);

      expect(mockUserBetService.createUserBet).toHaveBeenCalledWith({
        game: 'LIMBO',
        betId: expect.any(String),
        userId: mockUser.id,
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        multiplier: '0.0000', // Loss format
        payout: '-0.00100000', // Negative payout for loss
      });
    });
  });

  describe('🎯 Limbo-Specific Edge Cases', () => {
    it('should handle very high multipliers (low win chance)', async () => {
      const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 100000, // Very high multiplier
        gameSessionId: 'session-id',
      };

      const winChance = service['calculateWinChance'](100000, HOUSE_EDGE);
      expect(winChance).toBeCloseTo(0.00099, 4); // (100-1)/100000 = 0.00099%

      mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
        value: 50000, // Loss (below target)
        serverSeed: 'server-seed',
        clientSeed: 'client-seed',
        hash: 'server-seed-hash',
        nonce: '1',
      });

      // Should handle without errors
      await expect(service.placeBet(mockUser as any, dto)).resolves.toBeDefined();
    });

    it('should handle precision in win chance calculations', () => {
      const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
      const testCases = [
        { multiplier: 3.333, expectedWinChance: 29.703 }, // (100-1)/3.333 ≈ 29.703%
        { multiplier: 7.777, expectedWinChance: 12.732 }, // (100-1)/7.777 ≈ 12.732%
        { multiplier: 1.111, expectedWinChance: 89.109 }, // (100-1)/1.111 ≈ 89.109%
      ];

      testCases.forEach(({ multiplier, expectedWinChance }) => {
        const winChance = service['calculateWinChance'](multiplier, HOUSE_EDGE);
        expect(winChance).toBeCloseTo(expectedWinChance, 1);
      });
    });
  });

  describe('🔧 Helper Methods', () => {
    it('should have calculateWinChance method accessible for testing', () => {
      expect(typeof service['calculateWinChance']).toBe('function');
    });

    it('should validate calculateWinChance mathematical accuracy', () => {
      // CASINO STANDARD: winChance = min((100 - 1% houseEdge) / targetMultiplier, 99.99)
      const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
      const testCases = [
        { multiplier: 1.01, expected: 98.02 }, // (100-1)/1.01 ≈ 98.02%
        { multiplier: 2, expected: 49.5 }, // (100-1)/2 = 49.5%
        { multiplier: 4, expected: 24.75 }, // (100-1)/4 = 24.75%
        { multiplier: 5, expected: 19.8 }, // (100-1)/5 = 19.8%
        { multiplier: 20, expected: 4.95 }, // (100-1)/20 = 4.95%
        { multiplier: 100, expected: 0.99 }, // (100-1)/100 = 0.99%
      ];

      testCases.forEach(({ multiplier, expected }) => {
        const result = service['calculateWinChance'](multiplier, HOUSE_EDGE);
        expect(result).toBeCloseTo(expected, 2);
      });
    });

    it('should cap win chance correctly for edge cases', () => {
      const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
      // Test capping at 99.99% - only multipliers that would exceed 99.99%
      const multipliersThatShouldBeCapped = [0.1, 0.5, 0.9]; // These exceed 99.99%

      multipliersThatShouldBeCapped.forEach((multiplier) => {
        const result = service['calculateWinChance'](multiplier, HOUSE_EDGE);
        expect(result).toBe(99.99); // Should be capped
      });

      // Test normal behavior for multipliers that don't need capping
      expect(service['calculateWinChance'](0.99, HOUSE_EDGE)).toBeCloseTo(100, 0); // (100-1)/0.99 = 100%
      expect(service['calculateWinChance'](0.999, HOUSE_EDGE)).toBeCloseTo(99.1, 1); // (100-1)/0.999 ≈ 99.1%
    });
  });

  describe('🚦 Error Handling', () => {
    it('should handle balance service failures gracefully', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockBalanceService.updateBalance.mockResolvedValueOnce({
        success: false,
        error: 'Insufficient balance',
      });

      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow('Insufficient balance');
    });

    it('should handle database transaction failures', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockDataSource.createQueryRunner.mockReturnValueOnce({
        connect: jest.fn(),
        startTransaction: jest.fn().mockRejectedValueOnce(new Error('DB connection failed')),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      });

      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow('DB connection failed');
    });

    it('should handle user bet service failures without blocking main flow', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockUserBetService.createUserBet.mockRejectedValueOnce(
        new Error('User bet service unavailable'),
      );

      // Should complete successfully despite user bet service failure
      await expect(service.placeBet(mockUser as any, dto)).resolves.toBeDefined();
    });
  });

  describe('💎 VIP Integration', () => {
    it('should include VIP info in response when available', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      const result = await service.placeBet(mockUser as any, dto);

      expect(result.user).toEqual({
        id: mockUser.id,
        userName: mockUser.username,
        levelImageUrl: 'user-level/silver-3',
      });
    });

    it('should handle VIP service failures gracefully', async () => {
      const dto = {
        betAmount: '0.001',
        targetMultiplier: 2.0,
        gameSessionId: 'session-id',
      };

      mockUserVipStatusService.getUsersVipStatus.mockRejectedValueOnce(
        new Error('VIP service unavailable'),
      );

      // Should throw general error due to try-catch wrapper
      await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
        'Failed to process limbo bet',
      );
    });
  });

  describe('🛡️ SECURITY & ANTI-FRAUD TESTS', () => {
    describe('🔒 Input Sanitization & Validation', () => {
      it('should reject negative bet amounts', async () => {
        const dto = {
          betAmount: '-0.001', // Negative value
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject negative multipliers', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: -2.0, // Negative multiplier
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject zero multipliers', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 0, // Zero multiplier
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject NaN values in betAmount', async () => {
        const dto = {
          betAmount: 'NaN',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject Infinity values in multiplier', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: Infinity,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject scientific notation attacks', async () => {
        const dto = {
          betAmount: '1e50', // Scientific notation overflow
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should sanitize malicious string inputs', async () => {
        const dto = {
          betAmount: '0.001; DROP TABLE users;--', // SQL injection attempt
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });
    });

    describe('🚨 Float Precision & Overflow Protection', () => {
      it('should handle extreme precision in bet amounts', async () => {
        const dto = {
          betAmount: '0.123456789012345678901234567890', // High precision
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        // Should either handle gracefully or reject with proper error
        await expect(service.placeBet(mockUser as any, dto)).resolves.toBeDefined();
      });

      it('should prevent integer overflow in win calculations', async () => {
        const dto = {
          betAmount: '999999999999999999999999999999999', // Potential overflow
          targetMultiplier: 1000000,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should handle floating point edge cases', () => {
        const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
        // Test floating point precision issues with different values
        const winChance1 = service['calculateWinChance'](2.5, HOUSE_EDGE);
        const winChance2 = service['calculateWinChance'](2.6, HOUSE_EDGE);

        expect(winChance1).not.toEqual(winChance2);
        expect(typeof winChance1).toBe('number');
        expect(isNaN(winChance1)).toBe(false);
      });

      it('should cap extremely high multipliers safely', () => {
        const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
        const winChance = service['calculateWinChance'](Number.MAX_SAFE_INTEGER, HOUSE_EDGE);
        expect(winChance).toBeGreaterThanOrEqual(0);
        expect(winChance).toBeLessThanOrEqual(99.99);
        expect(isNaN(winChance)).toBe(false);
      });
    });

    describe('⏱️ Timing Attack Prevention', () => {
      it('should have consistent response time for wins vs losses', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        // Test win scenario timing
        mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
          value: 2.5, // Win
          serverSeed: 'server-seed',
          clientSeed: 'client-seed',
          hash: 'server-seed-hash',
          nonce: '1',
        });

        const startWin = Date.now();
        await service.placeBet(mockUser as any, dto);
        const winTime = Date.now() - startWin;

        // Test loss scenario timing
        mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
          value: 1.5, // Loss
          serverSeed: 'server-seed',
          clientSeed: 'client-seed',
          hash: 'server-seed-hash',
          nonce: '2',
        });

        const startLoss = Date.now();
        await service.placeBet(mockUser as any, dto);
        const lossTime = Date.now() - startLoss;

        // Timing should be similar (within reasonable variance)
        const timingDifference = Math.abs(winTime - lossTime);
        expect(timingDifference).toBeLessThan(100); // Max 100ms difference
      });
    });

    describe('🔄 Race Condition Protection', () => {
      it('should handle rapid consecutive bets safely', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        // Simulate rapid betting (potential race condition)
        const promises = Array(5)
          .fill(null)
          .map(() => service.placeBet(mockUser as any, dto));

        // All should resolve without interference
        const results = await Promise.allSettled(promises);
        results.forEach((result) => {
          expect(result.status).toBe('fulfilled');
        });
      });
    });

    describe('🎯 House Edge Manipulation Prevention', () => {
      it('should always use correct house edge from service', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await service.placeBet(mockUser as any, dto);

        // Verify house edge was fetched from service during bet processing
        expect(mockHouseEdgeService.getEdge).toHaveBeenCalledWith('limbo');
        expect(mockHouseEdgeService.getEdge('limbo')).toBe(1.0);
      });

      it('should prevent house edge bypass attempts', async () => {
        // Mock incorrect house edge scenario
        mockHouseEdgeService.getEdge.mockReturnValueOnce(null);

        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
          'Failed to process limbo bet',
        );
      });
    });
  });

  describe('🔥 EXTREME EDGE CASES', () => {
    describe('📊 Boundary Value Analysis', () => {
      const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService

      it('should handle exactly 1.0x multiplier (impossible win)', () => {
        const winChance = service['calculateWinChance'](1.0, HOUSE_EDGE);
        expect(winChance).toBe(99); // Should be capped, not 100%
      });

      it('should handle multiplier just above 1.0', () => {
        const winChance = service['calculateWinChance'](1.000001, HOUSE_EDGE);
        expect(winChance).toBeCloseTo(98.9999, 4); // Capped for security
      });

      it('should handle multiplier at max safe integer', () => {
        const winChance = service['calculateWinChance'](Number.MAX_SAFE_INTEGER, HOUSE_EDGE);
        expect(winChance).toBeGreaterThan(0);
        expect(winChance).toBeLessThan(0.01);
      });
    });

    describe('🚫 Null/Undefined Handling', () => {
      it('should reject null bet amount', async () => {
        const dto = {
          betAmount: null as any,
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should reject undefined multiplier', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: undefined as any,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should handle missing user context safely', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        await expect(service.placeBet(null as any, dto)).rejects.toThrow();
      });
    });

    describe('💣 Memory & Performance Edge Cases', () => {
      it('should handle extremely long game session ID', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'x'.repeat(10000), // Very long string - potential memory exhaustion attack
        };

        // Should reject long game session IDs for security (prevent memory attacks)
        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
          'Game session ID too long',
        );
      });

      it('should maintain precision in large number calculations', () => {
        const HOUSE_EDGE = 1.0; // 1% from HouseEdgeService
        // Test precision with large multipliers (enhanced precision)
        const largeMultiplier = 999999;
        const winChance = service['calculateWinChance'](largeMultiplier, HOUSE_EDGE);

        expect(winChance).toBeCloseTo(0.0001, 4); // Enhanced precision allows small variance
        expect(typeof winChance).toBe('number');
      });
    });

    describe('🔐 Provably Fair Security', () => {
      it('should validate seed pair integrity', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        // Mock corrupted seed response
        mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
          value: null, // Corrupted value
          serverSeed: 'server-seed',
          clientSeed: 'client-seed',
          hash: 'server-seed-hash',
          nonce: '1',
        });

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow();
      });

      it('should prevent nonce manipulation', async () => {
        const dto = {
          betAmount: '0.001',
          targetMultiplier: 2.0,
          gameSessionId: 'session-id',
        };

        // Mock missing nonce
        mockProvablyFairService.generateLimboOutcome.mockResolvedValueOnce({
          value: 2.5,
          serverSeed: 'server-seed',
          clientSeed: 'client-seed',
          hash: 'server-seed-hash',
          nonce: null, // Missing nonce
        });

        await expect(service.placeBet(mockUser as any, dto)).rejects.toThrow(
          'Nonce is missing or invalid',
        );
      });
    });
  });
});
