import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  AuthStrategyEnum,
  BalanceOperationEnum,
  BetType,
  RouletteColor,
  RouletteGame,
} from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { createTestProviders } from '../../test-utils';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { RouletteService } from './roulette.service';

describe('RouletteService', () => {
  let service: RouletteService;
  let repository: jest.Mocked<Repository<RouletteGame>>;
  let balanceService: jest.Mocked<BalanceService>;
  let userBetService: jest.Mocked<UserBetService>;
  let findOneMock: jest.Mock;
  let findMock: jest.Mock;

  const mockUser = {
    id: 'user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: true,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: { passwordHash: 'hash' },
    isBanned: false,
    isPrivate: false,
    currentFiatFormat: FiatFormatEnum.STANDARD,
    currentCurrency: CurrencyEnum.USD,
    createdAt: new Date(),
    updatedAt: new Date(),
    primaryAsset: AssetTypeEnum.BTC,
  } as any;

  const mockRouletteGame = {
    id: 'game-id',
    userId: 'user-id',
    asset: AssetTypeEnum.BTC,
    seedPairId: 1,
    bets: [
      {
        type: BetType.STRAIGHT,
        numbers: [7],
        amount: '0.001',
        payout: 0.035,
      },
    ],
    totalBetAmount: '0.001',
    winningNumber: 7,
    winningColor: RouletteColor.RED,
    totalPayout: '0.035',
    profit: '0.034',
    totalMultiplier: '35.0000',
    isCompleted: true,
    nonce: 1,
    clientSeed: 'client-seed-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  } as RouletteGame;

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockBalanceService = {
      updateBalance: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockUserBetService = {
      createUserBet: jest.fn().mockResolvedValue({ success: true }),
      getUserBets: jest.fn(),
    };

    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockReturnValue(mockRouletteGame),
        save: jest.fn().mockResolvedValue(mockRouletteGame),
        findOne: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(2.7),
    };

    const mockProvablyFairService = {
      updateClientSeed: jest.fn().mockResolvedValue(undefined),
      generateGameOutcome: jest.fn().mockResolvedValue({
        value: 7,
        hash: 'mocked-hash',
        nonce: '1',
        serverSeed: 'mocked-server-seed',
        clientSeed: 'mocked-client-seed',
      }),
      getActiveSeedPair: jest.fn().mockResolvedValue({
        id: 1,
        serverSeed: 'mocked-server-seed',
        clientSeed: 'mocked-client-seed',
        nonce: '1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouletteService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(RouletteGame),
          useValue: mockRepository,
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
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ProvablyFairService,
          useValue: mockProvablyFairService,
        },
        // Mock UserVipStatusService for DI
        {
          provide: UserVipStatusService,
          useValue: {
            getUsersVipStatus: jest
              .fn()
              .mockResolvedValue([{ userId: mockUser.id, vipLevel: 0, vipLevelImage: '' }]),
          },
        },
      ],
    }).compile();

    service = module.get<RouletteService>(RouletteService);
    repository = module.get(getRepositoryToken(RouletteGame));
    balanceService = module.get(BalanceService);
    userBetService = module.get(UserBetService);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    findOneMock = repository.findOne as jest.Mock;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    findMock = repository.find as jest.Mock;
  });

  describe('placeBet', () => {
    it('should place a straight bet successfully', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '0.001',
          },
        ],
        clientSeed: 'client-seed-123',
      };

      const result = await service.placeBet(mockUser, dto);

      // Should call updateBalance twice: first BET, then WIN (no batching)
      expect(balanceService.updateBalance).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          operation: BalanceOperationEnum.BET,
          operationId: expect.any(String) as string,
          userId: 'user-id',
          amount: expect.anything(),
          asset: AssetTypeEnum.BTC,
          description: 'Roulette bet',
        }),
        expect.any(Object), // queryRunner
      );

      expect(balanceService.updateBalance).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          operation: BalanceOperationEnum.WIN,
          operationId: expect.any(String) as string,
          userId: 'user-id',
          amount: expect.anything(),
          asset: AssetTypeEnum.BTC,
          description: 'Roulette win',
        }),
        expect.any(Object), // queryRunner
      );
      expect(userBetService.createUserBet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          game: 'ROULETTE',
          betId: 'game-id',
          betAmount: '0.001',
          asset: AssetTypeEnum.BTC,
          payout: expect.any(String),
        }),
      );

      expect(result).toMatchObject({
        id: 'game-id',
        asset: AssetTypeEnum.BTC,
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '0.001',
          },
        ],
        totalBetAmount: '0.001',
        winningNumber: expect.any(Number) as number,
        winningColor: expect.any(String) as string,
        totalPayout: expect.any(String) as string,
        profit: expect.any(String) as string,
        isCompleted: true,
        serverSeedHash: expect.any(String) as string,
        clientSeed: 'client-seed-123',
        nonce: 1,
        createdAt: mockRouletteGame.createdAt,
      });

      // Additional specific checks
      expect(result.winningNumber).toBeGreaterThanOrEqual(0);
      expect(result.winningNumber).toBeLessThanOrEqual(36);
      expect(['red', 'black', 'green']).toContain(result.winningColor);
    });

    it('should place multiple bets successfully', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '0.001',
          },
          {
            type: BetType.RED,
            numbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
            amount: '0.0005',
          },
        ],
      };

      await service.placeBet(mockUser, dto);

      // Should use batch balance operations (BET only for losses, or [BET,WIN] for wins)
      expect(balanceService.updateBalance).toHaveBeenCalledWith(
        expect.anything(), // Could be single BET or [BET,WIN] array
        expect.any(Object), // queryRunner
      );
    });

    it('should handle no primary asset found for user', async () => {
      const userWithoutAsset = { ...mockUser, primaryAsset: null };

      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '0.001',
          },
        ],
      };

      await expect(service.placeBet(userWithoutAsset, dto)).rejects.toThrow(
        'No primary asset found for user',
      );
    });

    it('should validate minimum bet amount', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '0.000000001', // Below minimum
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow('Bet amount too small');
    });

    it('should validate maximum bet amount', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [7],
            amount: '2000000', // Above maximum
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow('Bet amount too large');
    });

    it('should reject invalid split bet', async () => {
      const dto = {
        bets: [
          {
            type: BetType.SPLIT,
            numbers: [1, 5], // Not adjacent
            amount: '100.00',
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid street bet', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STREET,
            numbers: [1, 2, 4], // Not a valid row
            amount: '100.00',
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject numbers outside valid range', async () => {
      const dto = {
        bets: [
          {
            type: BetType.STRAIGHT,
            numbers: [37], // Invalid number
            amount: '100.00',
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject wrong number count for bet type', async () => {
      const dto = {
        bets: [
          {
            type: BetType.SPLIT,
            numbers: [1], // Should have 2 numbers
            amount: '100.00',
          },
        ],
      };

      await expect(service.placeBet(mockUser, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGameHistory', () => {
    it('should return game history', async () => {
      repository.find.mockResolvedValue([mockRouletteGame]);

      const result = await service.getGameHistory('user-id', 50, 0);

      expect(findMock).toHaveBeenCalledWith({
        where: { userId: 'user-id', isCompleted: true },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('game-id');
    });
  });

  describe('getGameById', () => {
    it('should return specific game', async () => {
      repository.findOne.mockResolvedValue(mockRouletteGame);

      const result = await service.getBetById('game-id');

      expect(findOneMock).toHaveBeenCalledWith({
        where: { id: 'game-id' },
        relations: ['user'],
      });

      expect(result.id).toBe('game-id');
    });

    it('should throw NotFoundException when game not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getBetById('game-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bet validation', () => {
    it('should validate valid split bets', () => {
      const validSplits = [
        [1, 2],
        [2, 3],
        [1, 4],
        [2, 5],
        [0, 1],
        [0, 2],
        [0, 3],
      ];

      for (const numbers of validSplits) {
        const dto = {
          bets: [{ type: BetType.SPLIT, numbers, amount: '100.00' }],
        };
        expect(() => service['validateBets'](dto.bets)).not.toThrow();
      }
    });

    it('should validate valid street bets', () => {
      const validStreets = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [34, 35, 36],
      ];

      for (const numbers of validStreets) {
        const dto = {
          bets: [{ type: BetType.STREET, numbers, amount: '100.00' }],
        };
        expect(() => service['validateBets'](dto.bets)).not.toThrow();
      }
    });

    it('should validate valid corner bets', () => {
      const validCorners = [
        [1, 2, 4, 5],
        [2, 3, 5, 6],
        [4, 5, 7, 8],
        [32, 33, 35, 36],
      ];

      for (const numbers of validCorners) {
        const dto = {
          bets: [{ type: BetType.CORNER, numbers, amount: '100.00' }],
        };
        expect(() => service['validateBets'](dto.bets)).not.toThrow();
      }
    });

    it('should validate valid basket bets', () => {
      const dto = {
        bets: [{ type: BetType.BASKET, numbers: [0, 1, 2, 3], amount: '100.00' }],
      };
      expect(() => service['validateBets'](dto.bets)).not.toThrow();
    });

    it('should reject invalid basket bets', () => {
      const invalidBaskets = [
        [0, 1, 2], // wrong count
        [0, 1, 2, 4], // wrong numbers
        [1, 2, 3, 4], // missing 0
      ];

      for (const numbers of invalidBaskets) {
        const dto = {
          bets: [{ type: BetType.BASKET, numbers, amount: '100.00' }],
        };
        expect(() => service['validateBets'](dto.bets)).toThrow();
      }
    });

    it('should validate valid trio bets', () => {
      const dto = {
        bets: [{ type: BetType.TRIO, numbers: [0, 1, 2], amount: '100.00' }],
      };
      expect(() => service['validateBets'](dto.bets)).not.toThrow();
    });

    it('should reject invalid trio bets', () => {
      const invalidTrios = [
        [0, 1], // wrong count
        [0, 1, 3], // wrong numbers
        [1, 2, 3], // missing 0
        [0, 1, 2, 3], // too many numbers
      ];

      for (const numbers of invalidTrios) {
        const dto = {
          bets: [{ type: BetType.TRIO, numbers, amount: '100.00' }],
        };
        expect(() => service['validateBets'](dto.bets)).toThrow();
      }
    });

    it('should validate column bets', () => {
      const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
      const dto = {
        bets: [{ type: BetType.COLUMN, numbers: column1, amount: '100.00' }],
      };
      expect(() => service['validateBets'](dto.bets)).not.toThrow();
    });

    it('should validate dozen bets', () => {
      const firstDozen = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const dto = {
        bets: [{ type: BetType.DOZEN, numbers: firstDozen, amount: '100.00' }],
      };
      expect(() => service['validateBets'](dto.bets)).not.toThrow();
    });
  });

  describe('payout calculations', () => {
    it('should calculate correct payout for straight bet (36:1 from CSV)', () => {
      const bets = [{ type: BetType.STRAIGHT, numbers: [7], amount: '1' }];
      const winningNumber = 7;

      const result = service['calculatePayouts'](bets, winningNumber);

      const expectedPayout = 36; // Direct multiplier from CSV, no house edge adjustment

      expect(result.totalPayoutBN.toNumber()).toEqual(expectedPayout);
      expect(result.updatedBets[0].payout).toEqual(expectedPayout);
    });

    it('should calculate correct payout for red bet (2:1 from CSV)', () => {
      const bets = [{ type: BetType.RED, numbers: [], amount: '1' }];
      const winningNumber = 7; // Red number

      const result = service['calculatePayouts'](bets, winningNumber);

      const expectedPayout = 2; // Direct multiplier from CSV, no house edge adjustment

      expect(result.totalPayoutBN.toNumber()).toEqual(expectedPayout);
      expect(result.updatedBets[0].payout).toEqual(expectedPayout);
    });

    it('should return zero payout for losing bet', () => {
      const bets = [{ type: BetType.RED, numbers: [], amount: '1' }];
      const winningNumber = 2; // Black number

      const result = service['calculatePayouts'](bets, winningNumber);

      expect(result.totalPayoutBN.toNumber()).toEqual(0);
      expect(result.updatedBets[0].payout).toEqual(0);
    });

    it('should calculate correct payout for very small bets', () => {
      const bets = [
        {
          type: BetType.HIGH,
          numbers: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
          amount: '0.00000001',
        },
      ];
      const winningNumber = 28; // High number (19-36)

      const result = service['calculatePayouts'](bets, winningNumber);

      // 0.00000001 * 2 = 0.00000002 (direct CSV multiplier, no house edge adjustment)
      const expectedPayout = 0.00000002;

      expect(result.totalPayoutBN.toNumber()).toBeGreaterThan(0);
      expect(result.totalPayoutBN.toNumber()).toEqual(expectedPayout);
      expect(result.updatedBets[0].payout).toEqual(expectedPayout);
      expect(result.updatedBets[0].payout).toBeGreaterThan(0);
    });

    it('should handle precision correctly for very small amounts', () => {
      const bets = [{ type: BetType.STRAIGHT, numbers: [7], amount: '0.00000001' }];
      const winningNumber = 7; // Winning straight bet

      const result = service['calculatePayouts'](bets, winningNumber);

      // 0.00000001 * 36 = 0.00000036 (direct CSV multiplier, no house edge adjustment)
      const expectedPayout = 0.00000036;

      expect(result.totalPayoutBN.toNumber()).toBeGreaterThan(0);
      expect(result.totalPayoutBN.toNumber()).toEqual(expectedPayout);
      expect(result.updatedBets[0].payout).toBeGreaterThan(0);

      // Should maintain 8 decimal place precision
      const payoutStr = (result.updatedBets[0].payout || 0).toString();
      const decimalPart = payoutStr.split('.')[1];
      const decimalPlaces = decimalPart ? decimalPart.length : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(8);
    });
  });

  describe('number color determination', () => {
    it('should identify red numbers correctly', () => {
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

      for (const number of redNumbers) {
        expect(service['getNumberColor'](number)).toBe(RouletteColor.RED);
      }
    });

    it('should identify black numbers correctly', () => {
      const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

      for (const number of blackNumbers) {
        expect(service['getNumberColor'](number)).toBe(RouletteColor.BLACK);
      }
    });

    it('should identify zero as green', () => {
      expect(service['getNumberColor'](0)).toBe(RouletteColor.GREEN);
    });
  });

  describe('winning determination', () => {
    it('should determine winning for outside bets correctly', () => {
      expect(service['isBetWinning'](BetType.RED, [], 7)).toBe(true); // 7 is red
      expect(service['isBetWinning'](BetType.BLACK, [], 7)).toBe(false); // 7 is not black
      expect(service['isBetWinning'](BetType.EVEN, [], 8)).toBe(true); // 8 is even
      expect(service['isBetWinning'](BetType.ODD, [], 7)).toBe(true); // 7 is odd
      expect(service['isBetWinning'](BetType.LOW, [], 10)).toBe(true); // 10 is 1-18
      expect(service['isBetWinning'](BetType.HIGH, [], 25)).toBe(true); // 25 is 19-36
      expect(service['isBetWinning'](BetType.EVEN, [], 0)).toBe(false); // 0 is not even/odd
    });

    it('should determine winning for inside bets correctly', () => {
      expect(service['isBetWinning'](BetType.STRAIGHT, [7], 7)).toBe(true);
      expect(service['isBetWinning'](BetType.SPLIT, [1, 2], 2)).toBe(true);
      expect(service['isBetWinning'](BetType.STREET, [1, 2, 3], 2)).toBe(true);
      expect(service['isBetWinning'](BetType.CORNER, [1, 2, 4, 5], 4)).toBe(true);
      expect(service['isBetWinning'](BetType.BASKET, [0, 1, 2, 3], 0)).toBe(true);
      expect(service['isBetWinning'](BetType.BASKET, [0, 1, 2, 3], 1)).toBe(true);
      expect(service['isBetWinning'](BetType.BASKET, [0, 1, 2, 3], 2)).toBe(true);
      expect(service['isBetWinning'](BetType.BASKET, [0, 1, 2, 3], 3)).toBe(true);
      expect(service['isBetWinning'](BetType.BASKET, [0, 1, 2, 3], 4)).toBe(false);
      expect(service['isBetWinning'](BetType.TRIO, [0, 1, 2], 0)).toBe(true);
      expect(service['isBetWinning'](BetType.TRIO, [0, 1, 2], 1)).toBe(true);
      expect(service['isBetWinning'](BetType.TRIO, [0, 1, 2], 2)).toBe(true);
      expect(service['isBetWinning'](BetType.TRIO, [0, 1, 2], 3)).toBe(false);
    });
  });
});
