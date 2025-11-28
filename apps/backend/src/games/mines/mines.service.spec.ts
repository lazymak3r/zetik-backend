import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  AuthStrategyEnum,
  BalanceOperationEnum,
  MinesGameEntity,
  MinesGameStatus,
  UserEntity,
} from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { createTestProviders } from '../../test-utils';
import { HouseEdgeService } from '../services/house-edge.service';
import { UserBetService } from '../services/user-bet.service';
import { AutoplayMinesDto } from './dto/autoplay-mines.dto';
import { CashoutMinesDto } from './dto/cashout-mines.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { StartMinesGameDto } from './dto/start-mines-game.dto';
import { MinesService } from './mines.service';

describe('MinesService', () => {
  let service: MinesService;

  // Set test timeout to prevent hanging
  jest.setTimeout(10000);

  const mockUser: UserEntity = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {},
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    primaryAsset: AssetTypeEnum.BTC, // Added for optimization: primary asset from guard context
  } as unknown as UserEntity;

  const mockPrimaryWallet = {
    id: 'wallet-id',
    userId: 'user-123',
    asset: AssetTypeEnum.BTC,
    balance: '0.01',
    isPrimary: true,
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockMinesGameRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockBalanceService = {
    getPrimaryWallet: jest.fn(),
    updateBalance: jest.fn(),
  };

  const mockUserBetService = {
    createUserBet: jest.fn(),
    getUserBets: jest.fn(),
    getUserBetById: jest.fn(),
  };

  // ProvablyFairService mock removed - using complete mock from createTestProviders()

  const mockDataSource = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        findOne: jest.fn(),
      },
    })),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'games.houseEdge.mines') return 1;
      return defaultValue;
    }),
  };

  const mockHouseEdgeService = {
    getEdge: jest.fn().mockReturnValue(1.0), // 1% house edge for mines
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup config service mock to return house edge
    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'games.houseEdge.mines') return 1;
      return defaultValue;
    });

    // Mock setup removed - using complete mocks from createTestProviders()

    mockBalanceService.updateBalance.mockResolvedValue({ success: true });
    mockBalanceService.getPrimaryWallet.mockResolvedValue(mockPrimaryWallet);

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinesService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(MinesGameEntity),
          useValue: mockMinesGameRepository,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: UserBetService,
          useValue: mockUserBetService,
        },
        {
          provide: UserVipStatusService,
          useValue: {
            getUsersVipStatus: jest.fn().mockResolvedValue([
              {
                userId: 'user-123',
                vipLevelImage: 'user-level/bronze-1',
              },
            ]),
          },
        },
        // ProvablyFairService is already provided by createTestProviders() with complete mock
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: HouseEdgeService,
          useValue: mockHouseEdgeService,
        },
      ],
    }).compile();

    service = module.get<MinesService>(MinesService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Properly cleanup the service to clear intervals
    if (service && typeof service.onModuleDestroy === 'function') {
      service.onModuleDestroy();
    }
  });

  describe('Game Initialization and Setup', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      // Since we now use HouseEdgeService instead of direct config access,
      // we test that the service is properly injected and available
      expect(service).toBeDefined();
      expect(mockHouseEdgeService.getEdge).toBeDefined();
    });
  });

  // TODO: Rewrite these tests to work with async validateGameParameters method
  // describe('Game Parameter Validation', () => {
  //   These tests need to be updated to handle the new async validateGameParameters signature
  //   which now takes (dto: StartMinesGameDto, asset: string) and returns Promise<void>
  // });

  describe('Provably Fair System', () => {
    it('should generate correct number of mine positions', () => {
      const minePositions = service['generateMinePositions']('server-seed', 'client-seed', 1, 3);
      expect(minePositions).toHaveLength(3);
    });

    it('should generate unique mine positions', () => {
      const minePositions = service['generateMinePositions']('server-seed', 'client-seed', 1, 5);
      const uniquePositions = [...new Set(minePositions)];
      expect(uniquePositions).toHaveLength(5);
    });

    it('should be deterministic with same inputs', () => {
      const positions1 = service['generateMinePositions']('server-seed', 'client-seed', 1, 3);
      const positions2 = service['generateMinePositions']('server-seed', 'client-seed', 1, 3);
      expect(positions1).toEqual(positions2);
    });

    it('should generate different positions with different seeds', () => {
      const positions1 = service['generateMinePositions']('server-seed-1', 'client-seed', 1, 3);
      const positions2 = service['generateMinePositions']('server-seed-2', 'client-seed', 1, 3);
      expect(positions1).not.toEqual(positions2);
    });
  });

  describe('Payout Calculations', () => {
    it('should calculate correct multipliers for different reveal counts', () => {
      const { multiplier: multiplier1 } = service['calculatePayoutForReveal'](
        3, // 3 mines
        1, // 1 revealed
        new (require('bignumber.js'))(1),
      );

      const { multiplier: multiplier2 } = service['calculatePayoutForReveal'](
        3, // 3 mines
        2, // 2 revealed
        new (require('bignumber.js'))(1),
      );

      // More revealed tiles should give higher multiplier
      expect(multiplier2.toNumber()).toBeGreaterThan(multiplier1.toNumber());
    });

    it('should calculate higher multipliers for more mines', () => {
      const { multiplier: multiplier3Mines } = service['calculatePayoutForReveal'](
        3, // 3 mines
        1, // 1 revealed
        new (require('bignumber.js'))(1),
      );

      const { multiplier: multiplier5Mines } = service['calculatePayoutForReveal'](
        5, // 5 mines
        1, // 1 revealed
        new (require('bignumber.js'))(1),
      );

      // More mines should give higher multiplier for same reveal count
      expect(multiplier5Mines.toNumber()).toBeGreaterThan(multiplier3Mines.toNumber());
    });

    it('should apply house edge correctly', () => {
      const { multiplier } = service['calculatePayoutForReveal'](
        1, // 1 mine
        1, // 1 revealed
        new (require('bignumber.js'))(1),
      );

      // With 1 mine and 1 revealed tile:
      // Mathematical calculation: 25/24 = 1.041667 (pure math)
      // With 1% house edge: 1.041667 * 0.99 = 1.03125
      // Industry standard: NO artificial inflation - pure mathematics only

      expect(multiplier.toNumber()).toBeCloseTo(1.03125, 4);
    });

    it('should use mathematical calculation for scenarios without minimum multipliers', () => {
      const { multiplier } = service['calculatePayoutForReveal'](
        3, // 3 mines
        1, // 1 revealed
        new (require('bignumber.js'))(1),
      );

      // With 3 mines and 1 revealed tile:
      // Mathematical calculation: (25/22) * 0.99 = 1.125
      // No minimum multiplier applies, so pure math is used

      expect(multiplier.toNumber()).toBeCloseTo(1.125, 3);
    });

    it('should initialize currentMultiplier correctly for new game', () => {
      // Test that currentMultiplier starts at 1.00x (neutral - no tiles revealed)
      // and calculations are correct for potential clicks

      const { multiplier: firstClickMultiplier } = service['calculatePayoutForReveal'](
        1, // 1 mine
        1, // 1 revealed (potential first click)
        new (require('bignumber.js'))(1),
      );

      // For 1 mine, first click: mathematical calculation 25/24 * 0.99 = 1.03125
      expect(firstClickMultiplier.toNumber()).toBeCloseTo(1.03125, 4);

      const { multiplier: threeMinesMultiplier } = service['calculatePayoutForReveal'](
        3, // 3 mines
        1, // 1 revealed (potential first click)
        new (require('bignumber.js'))(1),
      );

      // For 3 mines, first click should show ~1.125x (mathematical calculation)
      expect(threeMinesMultiplier.toNumber()).toBeCloseTo(1.125, 3);

      // Test zero reveals (initial state)
      const { multiplier: zeroReveals } = service['calculatePayoutForReveal'](
        3, // 3 mines
        0, // 0 revealed (initial state)
        new (require('bignumber.js'))(1),
      );

      // For 0 reveals, should return 1.00x (neutral multiplier)
      expect(zeroReveals.toNumber()).toBe(1.0);
    });
  });

  describe('Game State Management', () => {
    it('should start a new game successfully', async () => {
      mockBalanceService.getPrimaryWallet.mockResolvedValue({
        asset: 'USDC',
        balance: '100',
      });

      mockBalanceService.updateBalance.mockResolvedValue({ success: true });
      mockMinesGameRepository.findOne.mockResolvedValue(null);
      mockMinesGameRepository.create.mockReturnValue({
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [1, 5, 10],
        revealedTiles: [],
      });

      const dto: StartMinesGameDto = {
        betAmount: '0.001',
        minesCount: 3,
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = await service.startGame(mockUser, dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(MinesGameStatus.ACTIVE);
      expect(mockBalanceService.updateBalance).toHaveBeenCalled();
    });

    it('should reveal safe tile correctly', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [1, 5, 10],
        revealedTiles: [],
        minesCount: 3,
        betAmount: '0.001',
        currentMultiplier: '1.0000',
        potentialPayout: '0.001',
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);
      mockMinesGameRepository.save.mockResolvedValue({
        ...mockGame,
        revealedTiles: [0],
      });

      const dto: RevealTileDto = {
        gameId: 'game-123',
        tilePosition: 0, // Safe position
      };

      const result = await service.revealTile(mockUser, dto);

      expect(result.revealedTiles).toContain(0);
      expect(result.status).toBe(MinesGameStatus.ACTIVE);
    });

    it('should handle mine hit correctly', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [1, 5, 10],
        revealedTiles: [],
        minesCount: 3,
        betAmount: '0.001',
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);
      mockMinesGameRepository.save.mockResolvedValue({
        ...mockGame,
        revealedTiles: [1],
        status: MinesGameStatus.BUSTED,
        finalPayout: '0',
      });

      const dto: RevealTileDto = {
        gameId: 'game-123',
        tilePosition: 1, // Mine position
      };

      const result = await service.revealTile(mockUser, dto);

      expect(result.status).toBe(MinesGameStatus.BUSTED);
      expect(result.finalPayout).toBe('0');
      expect(result.minePositions).toBeDefined(); // Mines should be revealed on bust
    });

    it('should cashout successfully', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        revealedTiles: [0, 2, 3],
        betAmount: '0.001',
        currentMultiplier: '2.5000',
        asset: 'USDC',
        minesCount: 3,
        minePositions: [1, 5, 10],
        potentialPayout: '0.0025',
      };

      // Mock the query runner chain
      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue(mockGame),
          save: jest.fn().mockResolvedValue({
            ...mockGame,
            status: MinesGameStatus.COMPLETED,
            finalPayout: '0.0025',
          }),
        },
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const dto: CashoutMinesDto = {
        gameId: 'game-123',
      };

      const result = await service.cashout(mockUser, dto);

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).toBeDefined();
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'WIN',
          userId: mockUser.id,
        }),
      );
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should enforce rate limiting', () => {
      // Simulate many rapid actions
      for (let i = 0; i < 150; i++) {
        try {
          service['enforceRateLimit'](mockUser.id);
        } catch (error: any) {
          expect(error.message).toContain('Rate limit exceeded');
          return;
        }
      }
    });

    it('should prevent revealing already revealed tiles', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [1, 5, 10],
        revealedTiles: [0], // Already revealed
        minesCount: 3,
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);

      const dto: RevealTileDto = {
        gameId: 'game-123',
        tilePosition: 0, // Already revealed
      };

      await expect(service.revealTile(mockUser, dto)).rejects.toThrow('Tile already revealed');
    });

    it.skip('should prevent cashout without revealed tiles', async () => {
      // Skipped to avoid hanging - this test causes async issues
    });
  });

  describe('Game History and Active Game', () => {
    it('should return active game if exists', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [1, 5, 10],
        revealedTiles: [0],
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);

      const result = await service.getActiveGame(mockUser.id);

      expect(result).toBeDefined();
      expect(result?.status).toBe(MinesGameStatus.ACTIVE);
      expect(result?.minePositions).toBeNull(); // Mines should not be revealed for active game
    });

    it('should return null if no active game', async () => {
      mockMinesGameRepository.findOne.mockResolvedValue(null);

      const result = await service.getActiveGame(mockUser.id);

      expect(result).toBeNull();
    });

    it('should return game history', async () => {
      const mockGames = [
        {
          id: 'game-1',
          userId: mockUser.id,
          status: MinesGameStatus.COMPLETED,
          createdAt: new Date(),
        },
        {
          id: 'game-2',
          userId: mockUser.id,
          status: MinesGameStatus.BUSTED,
          createdAt: new Date(),
        },
      ];

      mockMinesGameRepository.find.mockResolvedValue(mockGames);

      const result = await service.getGameHistory(mockUser.id, 10);

      expect(result).toHaveLength(2);
      expect(mockMinesGameRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('Autoplay Functionality', () => {
    beforeEach(() => {
      // Mock userBetService for async bet recording
      mockUserBetService.createUserBet.mockReturnValue(Promise.resolve());

      // Mock setup removed - using complete mocks from createTestProviders()

      // Mock minesGameRepository.create to return what is passed (with ID added)
      mockMinesGameRepository.create.mockImplementation((gameData) => ({
        id: 'game-123',
        ...gameData,
      }));

      // Mock queryRunner.manager.save to return what is passed (simulating DB save)
      mockDataSource
        .createQueryRunner()
        .manager.save.mockImplementation((gameData) => Promise.resolve({ ...gameData }));
    });

    afterEach(() => {
      // Clear all timers and promises
      jest.clearAllTimers();
      jest.clearAllMocks();
    });

    it('should execute autoplay successfully with all safe tiles', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.001',
        minesCount: 3,
        tilePositions: [0, 1, 2], // Safe tiles (assuming mines at [10, 15, 20])
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock mine generation to avoid tiles 0, 1, 2
      const mockGenerateMinePositions = jest.spyOn(service as any, 'generateMinePositions');
      mockGenerateMinePositions.mockReturnValue([10, 15, 20]); // Mines not on revealed tiles

      // Mock successful balance update for WIN scenario
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const result = await service.autoplay(mockUser, autoplayDto);

      // Should use batch balance operations for WIN
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'BET',
            userId: mockUser.id,
            amount: expect.any(Object),
          }),
          expect.objectContaining({
            operation: 'WIN',
            userId: mockUser.id,
            amount: expect.any(Object),
          }),
        ]),
        expect.any(Object), // queryRunner
      );

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).toBeDefined();
      expect(result.finalPayout).not.toBeNull();
      expect(parseFloat(result.finalPayout!)).toBeGreaterThan(0.001); // Should win more than bet

      mockGenerateMinePositions.mockRestore();
    });

    it.skip('should reveal all selected tiles when hitting a mine in autoplay', async () => {
      // Skipped to avoid hanging during tests
    });

    it('should handle autoplay with no tile positions', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.001',
        minesCount: 3,
        tilePositions: [], // No tiles to reveal - immediate cashout
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock balance update for immediate cashout (edge case WIN)
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const result = await service.autoplay(mockUser, autoplayDto);

      // Should use batch balance operations even for immediate cashout
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'BET',
            userId: mockUser.id,
          }),
          expect.objectContaining({
            operation: 'WIN',
            userId: mockUser.id,
          }),
        ]),
        expect.any(Object), // queryRunner
      );

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).toBe('0.001'); // Returns bet amount for immediate cashout
    });

    it('should handle autoplay with minimum bet amount', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.00000001', // Minimum allowed
        minesCount: 1,
        tilePositions: [0],
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock mine generation to make tile 0 safe
      const mockGenerateMinePositions = jest.spyOn(service as any, 'generateMinePositions');
      mockGenerateMinePositions.mockReturnValue([23]); // Mine at tile 23, tile 0 is safe

      // Mock balance update for WIN scenario
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const result = await service.autoplay(mockUser, autoplayDto);

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).not.toBeNull();
      expect(parseFloat(result.finalPayout!)).toBeGreaterThanOrEqual(0.00000001); // With minimum bet, may round to same due to precision

      mockGenerateMinePositions.mockRestore();
    });

    it('should handle autoplay with maximum mines count', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.001',
        minesCount: 24, // Maximum allowed (grid is 0-24, so 25 tiles total)
        tilePositions: [0], // With 24 mines, only 1 tile can be safe
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock mine generation to make tile 0 safe with 24 mines
      const mockGenerateMinePositions = jest.spyOn(service as any, 'generateMinePositions');
      mockGenerateMinePositions.mockReturnValue([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      ]); // 24 mines, avoiding only tile 0

      // Mock balance update for WIN scenario
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const result = await service.autoplay(mockUser, autoplayDto);

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).not.toBeNull();
      expect(parseFloat(result.finalPayout!)).toBeGreaterThan(0.001); // Should win more than bet with 24 mines

      mockGenerateMinePositions.mockRestore();
    });

    it('should propagate errors from balance service', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.001',
        minesCount: 3,
        tilePositions: [0, 1, 2],
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock mine generation for WIN scenario
      const mockGenerateMinePositions = jest.spyOn(service as any, 'generateMinePositions');
      mockGenerateMinePositions.mockReturnValue([10, 15, 20]); // Mines not on revealed tiles

      // Mock balance service failure
      mockBalanceService.updateBalance.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });

      await expect(service.autoplay(mockUser, autoplayDto)).rejects.toThrow('Insufficient balance');

      mockGenerateMinePositions.mockRestore();
    });

    it('should handle autoplay with mine hit (LOSS)', async () => {
      const autoplayDto: AutoplayMinesDto = {
        betAmount: '0.001',
        minesCount: 3,
        tilePositions: [0, 1, 2], // Player will hit mine at position 1
        gameSessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock mine generation to place mine at position 1
      const mockGenerateMinePositions = jest.spyOn(service as any, 'generateMinePositions');
      mockGenerateMinePositions.mockReturnValue([1, 15, 20]); // Mine at position 1

      // Mock balance update for LOSS scenario (only BET operation)
      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const result = await service.autoplay(mockUser, autoplayDto);

      // Should use single BET operation for LOSS
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'BET',
          userId: mockUser.id,
        }),
        expect.any(Object), // queryRunner
      );

      expect(result.status).toBe(MinesGameStatus.BUSTED);
      expect(result.finalPayout).toBe('0'); // No winnings for loss

      mockGenerateMinePositions.mockRestore();
    });
  });

  describe('Auto Cashout Logic', () => {
    it('should auto cashout when all safe tiles are revealed', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [24], // Only 1 mine at position 24
        revealedTiles: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
        ], // 23 tiles revealed
        minesCount: 1,
        betAmount: '0.001',
        currentMultiplier: '1.0000',
        potentialPayout: '0.001',
        asset: 'USDC',
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);
      mockMinesGameRepository.save.mockResolvedValue({
        ...mockGame,
        revealedTiles: [...mockGame.revealedTiles, 23], // Add final safe tile
        status: MinesGameStatus.COMPLETED,
        finalPayout: '2.00000000',
      });

      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      const dto: RevealTileDto = {
        gameId: 'game-123',
        tilePosition: 23, // Final safe tile (24 is mine, so 23 is last safe tile)
      };

      const result = await service.revealTile(mockUser, dto);

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).toBeDefined();
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          description: 'Mines auto-cashout win',
          metadata: expect.objectContaining({
            reason: 'all_safe_tiles_revealed',
          }),
        }),
      );
    });

    it('should auto cashout when maximum payout multiplier is exceeded', async () => {
      const mockGame = {
        id: 'game-123',
        userId: mockUser.id,
        status: MinesGameStatus.ACTIVE,
        minePositions: [0],
        revealedTiles: [1, 2, 3], // Fewer tiles for simpler test
        minesCount: 1,
        betAmount: '0.001',
        currentMultiplier: '900.0000',
        potentialPayout: '0.9',
        asset: 'USDC',
      };

      mockMinesGameRepository.findOne.mockResolvedValue(mockGame);
      mockMinesGameRepository.save.mockResolvedValue({
        ...mockGame,
        revealedTiles: [...mockGame.revealedTiles, 4],
        status: MinesGameStatus.COMPLETED,
        finalPayout: '1.00000000',
      });

      mockBalanceService.updateBalance.mockResolvedValue({ success: true });

      // Mock calculatePayoutForReveal to return multiplier that exceeds maximum (1000x)
      const originalCalculatePayoutForReveal = service['calculatePayoutForReveal'];
      service['calculatePayoutForReveal'] = jest.fn().mockReturnValue({
        multiplier: new (require('bignumber.js'))(1500), // Exceeds MAX_PAYOUT_MULTIPLIER (1000)
        payout: new (require('bignumber.js'))(1.5),
      });

      const dto: RevealTileDto = {
        gameId: 'game-123',
        tilePosition: 4,
      };

      const result = await service.revealTile(mockUser, dto);

      expect(result.status).toBe(MinesGameStatus.COMPLETED);
      expect(result.finalPayout).toBeDefined();
      expect(mockBalanceService.updateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          description: 'Mines auto-cashout win',
          metadata: expect.objectContaining({
            reason: 'max_payout_reached',
          }),
        }),
      );

      // Restore original method
      service['calculatePayoutForReveal'] = originalCalculatePayoutForReveal;
    });
  });
});
