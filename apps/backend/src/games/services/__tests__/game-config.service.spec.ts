import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssetTypeEnum, GameBetTypeLimitsEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CryptoConverterService } from '../../../balance/services/crypto-converter.service';
import { RedisService } from '../../../common/services/redis.service';
import { createTestProviders } from '../../../test-utils';
import { GameBetLimitsEntity } from '../../entities/game-bet-limits.entity';
import { GameConfigEntity, GameStatus, GameType } from '../../entities/game-config.entity';
import { BetLimitsResponse } from '../../types/game-config.types';
import { GameConfigService } from '../game-config.service';

describe('GameConfigService', () => {
  let service: GameConfigService;
  let gameConfigRepo: jest.Mocked<Repository<GameConfigEntity>>;
  let betLimitsRepo: jest.Mocked<Repository<GameBetLimitsEntity>>;
  let redisService: jest.Mocked<RedisService>;
  let cryptoConverterService: jest.Mocked<CryptoConverterService>;

  const mockGameConfig: GameConfigEntity = {
    id: 'test-config-id',
    gameType: GameType.CRASH,
    status: GameStatus.ENABLED,
    name: 'Crash Game',
    description: 'Test crash game configuration',
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBetLimits: GameBetLimitsEntity = {
    id: 'test-bet-limits-id',
    gameType: GameType.CRASH,
    name: 'Standard Limits',
    description: 'Standard bet limits for Crash',
    minBetUsd: 0.1,
    maxBetUsd: 1000.0,
    maxPayoutUsd: 100000.0,
    isActive: true,
    createdBy: 'admin',
    updatedBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockGameConfigRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockBetLimitsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockBetTypeLimitsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    const mockCryptoConverterService = {
      convertToUsd: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameConfigService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(GameConfigEntity),
          useValue: mockGameConfigRepo,
        },
        {
          provide: getRepositoryToken(GameBetLimitsEntity),
          useValue: mockBetLimitsRepo,
        },
        {
          provide: getRepositoryToken(GameBetTypeLimitsEntity),
          useValue: mockBetTypeLimitsRepo,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: CryptoConverterService,
          useValue: mockCryptoConverterService,
        },
      ],
    }).compile();

    service = module.get<GameConfigService>(GameConfigService);
    gameConfigRepo = module.get(getRepositoryToken(GameConfigEntity));
    betLimitsRepo = module.get(getRepositoryToken(GameBetLimitsEntity));
    redisService = module.get(RedisService);
    cryptoConverterService = module.get(CryptoConverterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isGameEnabled', () => {
    it('should return true for enabled game', async () => {
      // Mock cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query
      gameConfigRepo.findOne.mockResolvedValue(mockGameConfig);

      // Mock cache set
      redisService.set.mockResolvedValue(true);

      const result = await service.isGameEnabled(GameType.CRASH);

      expect(result).toBe(true);
      expect(gameConfigRepo.findOne).toHaveBeenCalledWith({
        where: { gameType: GameType.CRASH },
        select: ['status'],
      });
    });

    it('should return false for disabled game', async () => {
      // Mock cache miss
      redisService.get.mockResolvedValue(null);

      // Mock disabled game config
      const disabledConfig = { ...mockGameConfig, status: GameStatus.DISABLED };
      gameConfigRepo.findOne.mockResolvedValue(disabledConfig);

      // Mock cache set
      redisService.set.mockResolvedValue(true);

      const result = await service.isGameEnabled(GameType.CRASH);

      expect(result).toBe(false);
    });

    it('should return cached result when available', async () => {
      // Mock cache hit
      redisService.get.mockResolvedValue(JSON.stringify(true));

      const result = await service.isGameEnabled(GameType.CRASH);

      expect(result).toBe(true);
      expect(gameConfigRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getBetLimitsUsd', () => {
    it('should return bet limits for a game type', async () => {
      // Mock cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query
      betLimitsRepo.findOne.mockResolvedValue(mockBetLimits);

      // Mock cache set
      redisService.set.mockResolvedValue(true);

      const result = await service.getBetLimitsUsd(GameType.CRASH);

      const expected: BetLimitsResponse = {
        gameType: GameType.CRASH,
        minBetUsd: 0.1,
        maxBetUsd: 1000.0,
        maxPayoutUsd: 100000.0,
        isActive: true,
      };

      expect(result).toEqual(expected);
      expect(betLimitsRepo.findOne).toHaveBeenCalledWith({
        where: {
          gameType: GameType.CRASH,
          isActive: true,
        },
      });
    });

    it('should return cached result when available', async () => {
      const cachedResult: BetLimitsResponse = {
        gameType: GameType.CRASH,
        minBetUsd: 0.1,
        maxBetUsd: 1000.0,
        maxPayoutUsd: 100000.0,
        isActive: true,
      };

      // Mock cache hit
      redisService.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.getBetLimitsUsd(GameType.CRASH);

      expect(result).toEqual(cachedResult);
      expect(betLimitsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return fallback limits when bet limits not found', async () => {
      // Mock cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returning null
      betLimitsRepo.findOne.mockResolvedValue(null);

      const result = await service.getBetLimitsUsd(GameType.CRASH);

      expect(result.gameType).toBe(GameType.CRASH);
      expect(result.minBetUsd).toBe(0.1);
      expect(result.maxBetUsd).toBe(1000.0);
      expect(result.isActive).toBe(true);
    });
  });

  describe('validateBetAmount', () => {
    beforeEach(() => {
      // Mock cache miss for bet limits
      redisService.get.mockResolvedValue(null);
      betLimitsRepo.findOne.mockResolvedValue(mockBetLimits);
      redisService.set.mockResolvedValue(true);
    });

    it('should validate a valid bet amount', async () => {
      // Mock crypto conversion
      cryptoConverterService.convertToUsd.mockReturnValue(10.0);

      const result = await service.validateBetAmount(GameType.CRASH, '0.001', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(true);
      expect(result.usdAmount).toBe(10.0);
      expect(result.error).toBeUndefined();
    });

    it('should reject bet amount below minimum', async () => {
      // Mock crypto conversion to below minimum
      cryptoConverterService.convertToUsd.mockReturnValue(0.05);

      const result = await service.validateBetAmount(GameType.CRASH, '0.00001', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Bet amount too small');
      expect(result.usdAmount).toBe(0.05);
    });

    it('should reject bet amount above maximum', async () => {
      // Mock crypto conversion to above maximum
      cryptoConverterService.convertToUsd.mockReturnValue(2000.0);

      const result = await service.validateBetAmount(GameType.CRASH, '1', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Bet amount too large');
      expect(result.usdAmount).toBe(2000.0);
    });

    it('should reject invalid bet amount string', async () => {
      const result = await service.validateBetAmount(GameType.CRASH, 'invalid', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid bet amount');
    });

    it('should reject negative bet amount', async () => {
      const result = await service.validateBetAmount(GameType.CRASH, '-10', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid bet amount');
    });

    it('should handle crypto conversion failure', async () => {
      // Mock crypto conversion failure
      cryptoConverterService.convertToUsd.mockReturnValue(null);

      const result = await service.validateBetAmount(GameType.CRASH, '0.001', AssetTypeEnum.BTC);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Failed to convert bet amount to USD');
    });
  });

  describe('getAllBetLimits', () => {
    it('should return all active bet limits', async () => {
      const mockAllLimits = [
        mockBetLimits,
        {
          ...mockBetLimits,
          id: 'test-bet-limits-dice',
          gameType: GameType.DICE,
          minBetUsd: 0.05,
          maxBetUsd: 500.0,
        },
      ];

      // Mock cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query
      betLimitsRepo.find.mockResolvedValue(mockAllLimits);

      // Mock cache set
      redisService.set.mockResolvedValue(true);

      const result = await service.getAllBetLimits();

      expect(result).toHaveLength(2);
      expect(result[0].gameType).toBe(GameType.CRASH);
      expect(result[1].gameType).toBe(GameType.DICE);
      expect(betLimitsRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { gameType: 'ASC' },
      });
    });

    it('should return cached result when available', async () => {
      const cachedResult: BetLimitsResponse[] = [
        {
          gameType: GameType.CRASH,
          minBetUsd: 0.1,
          maxBetUsd: 1000.0,
          maxPayoutUsd: 100000.0,
          isActive: true,
        },
      ];

      // Mock cache hit
      redisService.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.getAllBetLimits();

      expect(result).toEqual(cachedResult);
      expect(betLimitsRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('updateBetLimits', () => {
    it('should update bet limits for a game type', async () => {
      // Mock database update
      betLimitsRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      // Mock cache clearing
      redisService.del.mockResolvedValue(true);

      await service.updateBetLimits(GameType.CRASH, 0.2, 2000.0, 'admin');

      expect(betLimitsRepo.update).toHaveBeenCalledWith(
        { gameType: GameType.CRASH },
        {
          minBetUsd: 0.2,
          maxBetUsd: 2000.0,
          updatedBy: 'admin',
        },
      );
    });
  });

  describe('refreshCache', () => {
    it('should refresh cache for specific game type', async () => {
      // Mock cache clearing
      redisService.del.mockResolvedValue(true);

      // Mock bet limits fetching
      redisService.get.mockResolvedValue(null);
      betLimitsRepo.findOne.mockResolvedValue(mockBetLimits);
      redisService.set.mockResolvedValue(true);

      await service.refreshCache(GameType.CRASH);

      expect(redisService.del).toHaveBeenCalled();
      expect(betLimitsRepo.findOne).toHaveBeenCalled();
    });

    it('should refresh cache for all games', async () => {
      // Mock cache clearing
      redisService.keys.mockResolvedValue(['bet_limits_usd:crash', 'all_bet_limits']);
      redisService.del.mockResolvedValue(true);

      await service.refreshCache();

      expect(redisService.keys).toHaveBeenCalledWith('bet_limits_*');
    });
  });
});
