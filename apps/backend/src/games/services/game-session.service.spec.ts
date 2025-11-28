import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  GameSessionEntity,
  GameStatusEnum,
  GameTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { CreateGameSessionDto, GameSessionService } from './game-session.service';
import { ProvablyFairService } from './provably-fair.service';

describe('GameSessionService', () => {
  let service: GameSessionService;
  let gameSessionRepository: Repository<GameSessionEntity>;
  let provablyFairService: ProvablyFairService;
  let balanceService: BalanceService;
  // @ts-ignore - used for module setup
  let dataSource: DataSource;

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
  } as unknown as UserEntity;

  const mockSeedPair = {
    id: 1,
    userId: mockUser.id,
    user: mockUser,
    clientSeed: 'test-client-seed',
    serverSeed: 'test-server-seed',
    serverSeedHash: 'test-hash',
    nonce: '5',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGameSession: GameSessionEntity = {
    id: 'session-id',
    userId: mockUser.id,
    user: mockUser,
    gameType: GameTypeEnum.DICE,
    status: GameStatusEnum.ACTIVE,
    asset: AssetTypeEnum.USDT,
    betAmount: '10.00',
    serverSeed: 'test-server-seed',
    clientSeed: 'test-client-seed',
    nonce: '1',
    gameConfig: {},
    gameState: {},
    gameResults: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GameSessionEntity;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        {
          provide: getRepositoryToken(GameSessionEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
            }),
          },
        },
        {
          provide: ProvablyFairService,
          useValue: {
            getActiveSeedPair: jest.fn(),
            generateSeedPair: jest.fn(),
            generateGameOutcome: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<GameSessionService>(GameSessionService);
    gameSessionRepository = module.get<Repository<GameSessionEntity>>(
      getRepositoryToken(GameSessionEntity),
    );
    provablyFairService = module.get<ProvablyFairService>(ProvablyFairService);
    balanceService = module.get<BalanceService>(BalanceService);
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  describe('createGameSession', () => {
    const createSessionDto: CreateGameSessionDto = {
      userId: mockUser.id,
      gameType: GameTypeEnum.DICE,
      asset: AssetTypeEnum.USDT,
      betAmount: '10.00',
      gameConfig: { sides: 6 },
    };

    it('should create game session successfully', async () => {
      jest.spyOn(provablyFairService, 'getActiveSeedPair').mockResolvedValue(mockSeedPair as any);
      jest.spyOn(balanceService, 'updateBalance').mockResolvedValue({
        success: true,
        status: BalanceOperationResultEnum.SUCCESS,
        balance: '90.00',
      });
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(mockGameSession);

      const result = await service.createGameSession(createSessionDto);

      expect(provablyFairService.getActiveSeedPair).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockGameSession);
    });

    it('should throw error if insufficient balance', async () => {
      jest.spyOn(provablyFairService, 'getActiveSeedPair').mockResolvedValue(mockSeedPair as any);
      jest.spyOn(balanceService, 'updateBalance').mockResolvedValue({
        success: false,
        status: BalanceOperationResultEnum.INSUFFICIENT_BALANCE,
        balance: '0.00',
        error: 'Insufficient balance',
      });

      await expect(service.createGameSession(createSessionDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw error for invalid bet amount', async () => {
      const invalidDto = { ...createSessionDto, betAmount: '0' };

      await expect(service.createGameSession(invalidDto)).rejects.toThrow();
    });
  });

  describe('completeGameSession', () => {
    const outcome = { result: 'win', number: 6 };

    it('should complete game session with win', async () => {
      const updatedSession = { ...mockGameSession, status: GameStatusEnum.COMPLETED };
      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockGameSession);
      jest.spyOn(provablyFairService, 'generateGameOutcome').mockResolvedValue({
        value: 0.5,
        hash: 'test-hash',
        nonce: '1',
        serverSeed: 'test-server-seed',
        clientSeed: 'test-client-seed',
      });
      jest.spyOn(balanceService, 'updateBalance').mockResolvedValue({
        success: true,
        status: BalanceOperationResultEnum.SUCCESS,
        balance: '120.00',
      });
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(updatedSession);

      const result = await service.completeGameSession('session-id', outcome, true, 2);

      expect(result.isWin).toBe(true);
      expect(result.winAmount).toBe('20.00000000');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should complete game session with loss', async () => {
      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockGameSession);
      jest.spyOn(provablyFairService, 'generateGameOutcome').mockResolvedValue({
        value: 0.8,
        hash: 'test-hash',
        nonce: '1',
        serverSeed: 'test-server-seed',
        clientSeed: 'test-client-seed',
      });
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(mockGameSession);

      const result = await service.completeGameSession('session-id', outcome, false);

      expect(result.isWin).toBe(false);
      expect(result.winAmount).toBeUndefined();
      expect(balanceService.updateBalance).not.toHaveBeenCalledWith(
        expect.objectContaining({ operation: BalanceOperationEnum.WIN }),
      );
    });

    it('should throw error if session not found', async () => {
      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(null);

      await expect(service.completeGameSession('invalid-id', outcome, true)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelGameSession', () => {
    it('should cancel game session and refund bet', async () => {
      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockGameSession);
      jest.spyOn(balanceService, 'updateBalance').mockResolvedValue({
        success: true,
        status: BalanceOperationResultEnum.SUCCESS,
        balance: '100.00',
      });

      await service.cancelGameSession('session-id');

      expect(balanceService.updateBalance).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getGameSession', () => {
    it('should return game session by id', async () => {
      jest.spyOn(gameSessionRepository, 'findOne').mockResolvedValue(mockGameSession);

      const result = await service.getGameSession('session-id');

      expect(gameSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'session-id' },
        relations: ['user', 'gameResults'],
      });
      expect(result).toEqual(mockGameSession);
    });

    it('should return null if session not found', async () => {
      jest.spyOn(gameSessionRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getGameSession('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserGameHistory', () => {
    it('should return user game history', async () => {
      const mockSessions = [mockGameSession];
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockSessions, 1]),
      };
      jest.spyOn(gameSessionRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.getUserGameHistory(mockUser.id, GameTypeEnum.DICE, 10, 0);

      expect(result.sessions).toEqual(mockSessions);
      expect(result.total).toBe(1);
    });
  });

  describe('getCurrentSession', () => {
    it('should return current active session', async () => {
      jest.spyOn(gameSessionRepository, 'findOne').mockResolvedValue(mockGameSession);

      const result = await service.getCurrentSession(mockUser.id);

      expect(gameSessionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, status: GameStatusEnum.ACTIVE },
        }),
      );
      expect(result).toEqual(mockGameSession);
    });

    it('should return null if no active session', async () => {
      jest.spyOn(gameSessionRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getCurrentSession(mockUser.id);

      expect(result).toBeNull();
    });
  });
});
