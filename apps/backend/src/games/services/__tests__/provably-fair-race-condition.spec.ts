import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BlackjackGameEntity,
  CrashBetEntity,
  DiceBetEntity,
  GameTypeEnum,
  KenoGameEntity,
  LimboGameEntity,
  MinesGameEntity,
  PlinkoGameEntity,
  RouletteGame,
  SeedPairEntity,
} from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { BytesToFloatService } from '../bytes-to-float.service';
import { HouseEdgeService } from '../house-edge.service';
import { ProvablyFairService } from '../provably-fair.service';

/**
 * TOCTOU Race Condition Test Suite
 *
 * These tests verify that the provably fair service correctly handles
 * concurrent seed pair creation attempts, preventing database constraint
 * violations from surfacing to users.
 *
 * Race Condition Scenario:
 * 1. Two concurrent requests for a user without a seed pair
 * 2. Both rollback their transactions and try to create seed pairs
 * 3. One succeeds, the other gets a unique constraint violation (error code 23505)
 * 4. The failing request should catch the error and retry, reading the existing seed pair
 */
describe('ProvablyFairService - TOCTOU Race Condition', () => {
  let service: ProvablyFairService;
  let queryRunner: any;

  // Mock QueryRunner for transaction control
  const createMockQueryRunner = () => ({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      query: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    },
  });

  beforeEach(async () => {
    queryRunner = createMockQueryRunner();

    const mockDataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const mockSeedPairRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'games.defaultHouseEdge') return 2.0;
        return defaultValue;
      }),
    };

    const mockBytesToFloatService = {
      singleBytesToFloat: jest.fn((hashBytes: Buffer, offset: number) => {
        // Return a deterministic value for testing
        return 0.5;
      }),
    };

    const mockHouseEdgeService = {
      getEdge: jest.fn((game: string) => 2.0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvablyFairService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(SeedPairEntity),
          useValue: mockSeedPairRepository,
        },
        {
          provide: getRepositoryToken(DiceBetEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CrashBetEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(BlackjackGameEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(KenoGameEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(LimboGameEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(MinesGameEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PlinkoGameEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(RouletteGame),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: BytesToFloatService,
          useValue: mockBytesToFloatService,
        },
        {
          provide: HouseEdgeService,
          useValue: mockHouseEdgeService,
        },
      ],
    }).compile();

    service = module.get<ProvablyFairService>(ProvablyFairService);
  });

  describe('generateGameOutcome - Race Condition Handling', () => {
    it('should gracefully handle unique constraint violation (error code 23505)', async () => {
      const userId = 'test-user-123';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      // First call: no seed pair found (simulate Request B losing race)
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]); // Empty result = no seed pair

      // Mock generateSeedPair to throw unique constraint violation
      const uniqueConstraintError = new Error('duplicate key value violates unique constraint');
      (uniqueConstraintError as any).code = '23505';

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(uniqueConstraintError);

      // Second call (retry): seed pair now exists (created by Request A)
      queryRunner.manager.query.mockResolvedValueOnce([
        [
          {
            serverSeed: 'test-server-seed',
            clientSeed: 'test-client-seed',
            serverSeedHash: 'test-hash',
            nonce: '1',
          },
        ],
        1,
      ]);

      // Execute
      const result = await service.generateGameOutcome(userId, gameType, betAmount);

      // Verify outcome was generated successfully
      expect(result).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.nonce).toBe('1');
      expect(result.serverSeed).toBe('test-server-seed');
      expect(result.clientSeed).toBe('test-client-seed');

      // Verify it retried after catching the error
      expect(queryRunner.manager.query).toHaveBeenCalledTimes(2);
    });

    it('should handle unique constraint violation with message check', async () => {
      const userId = 'test-user-456';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      // First call: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Mock generateSeedPair to throw error with 'unique' in message (no code property)
      const uniqueMessageError = new Error('unique constraint violation on users_seed_pairs');

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(uniqueMessageError);

      // Second call (retry): seed pair exists
      queryRunner.manager.query.mockResolvedValueOnce([
        [
          {
            serverSeed: 'test-server-seed-2',
            clientSeed: 'test-client-seed-2',
            serverSeedHash: 'test-hash-2',
            nonce: '1',
          },
        ],
        1,
      ]);

      // Execute
      const result = await service.generateGameOutcome(userId, gameType, betAmount);

      // Verify success
      expect(result).toBeDefined();
      expect(result.nonce).toBe('1');
      expect(result.serverSeed).toBe('test-server-seed-2');
    });

    it('should re-throw non-unique constraint errors', async () => {
      const userId = 'test-user-789';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      // First call: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Mock generateSeedPair to throw different error
      const databaseError = new Error('Connection lost to database');
      (databaseError as any).code = 'ECONNREFUSED';

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(databaseError);

      // Execute and expect error to be re-thrown
      await expect(service.generateGameOutcome(userId, gameType, betAmount)).rejects.toThrow(
        'Connection lost to database',
      );
    });

    it('should not retry if isRetry flag is already true', async () => {
      const userId = 'test-user-retry';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      // First call with isRetry=true: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Execute with isRetry=true and expect error
      await expect(service.generateGameOutcome(userId, gameType, betAmount, true)).rejects.toThrow(
        'Failed to create seed pair for new user',
      );

      // Verify it didn't call generateSeedPair (prevented infinite recursion)
      expect(service.generateSeedPair).not.toHaveBeenCalled();
    });
  });

  describe('generateLimboOutcome - Race Condition Handling', () => {
    it('should gracefully handle unique constraint violation (error code 23505)', async () => {
      const userId = 'limbo-user-123';
      const betAmount = '1.00';
      const houseEdge = 2.0;

      // First call: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Mock generateSeedPair to throw unique constraint violation
      const uniqueConstraintError = new Error('duplicate key value violates unique constraint');
      (uniqueConstraintError as any).code = '23505';

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(uniqueConstraintError);

      // Second call (retry): seed pair exists
      queryRunner.manager.query.mockResolvedValueOnce([
        [
          {
            serverSeed: 'limbo-server-seed',
            clientSeed: 'limbo-client-seed',
            serverSeedHash: 'limbo-hash',
            nonce: '1',
          },
        ],
        1,
      ]);

      // Execute
      const result = await service.generateLimboOutcome(userId, betAmount, houseEdge);

      // Verify outcome was generated successfully
      expect(result).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.hash).toBe('limbo-hash');
      expect(result.nonce).toBe('1');
      expect(result.serverSeed).toBe('limbo-server-seed');
      expect(result.clientSeed).toBe('limbo-client-seed');

      // Verify it retried
      expect(queryRunner.manager.query).toHaveBeenCalledTimes(2);
    });

    it('should handle unique constraint violation with message check', async () => {
      const userId = 'limbo-user-456';
      const betAmount = '1.00';
      const houseEdge = 2.0;

      // First call: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Mock error with 'unique' in message
      const uniqueMessageError = new Error('unique constraint on seed_pairs');

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(uniqueMessageError);

      // Second call (retry): seed pair exists
      queryRunner.manager.query.mockResolvedValueOnce([
        [
          {
            serverSeed: 'limbo-server-seed-2',
            clientSeed: 'limbo-client-seed-2',
            serverSeedHash: 'limbo-hash-2',
            nonce: '1',
          },
        ],
        1,
      ]);

      // Execute
      const result = await service.generateLimboOutcome(userId, betAmount, houseEdge);

      // Verify success
      expect(result).toBeDefined();
      expect(result.nonce).toBe('1');
    });

    it('should re-throw non-unique constraint errors', async () => {
      const userId = 'limbo-user-789';
      const betAmount = '1.00';
      const houseEdge = 2.0;

      // First call: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Mock different error
      const otherError = new Error('Database connection failed');

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(otherError);

      // Execute and expect error to be re-thrown
      await expect(service.generateLimboOutcome(userId, betAmount, houseEdge)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should not retry if isRetry flag is already true', async () => {
      const userId = 'limbo-user-retry';
      const betAmount = '1.00';
      const houseEdge = 2.0;

      // First call with isRetry=true: no seed pair found
      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Execute with isRetry=true and expect error
      await expect(
        service.generateLimboOutcome(userId, betAmount, houseEdge, true),
      ).rejects.toThrow('Failed to create seed pair for new user');
    });
  });

  describe('Concurrent Seed Creation Simulation', () => {
    it('should handle multiple concurrent requests gracefully', async () => {
      const userId = 'concurrent-user';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      // Create multiple spies to track calls
      const generateSeedPairSpy = jest.spyOn(service, 'generateSeedPair');

      // Mock the first request to succeed
      generateSeedPairSpy.mockResolvedValueOnce({
        id: 1,
        userId,
        user: {} as any, // Mock user entity
        serverSeed: 'seed-1',
        serverSeedHash: 'hash-1',
        clientSeed: 'client-1',
        nonce: '0',
        isActive: true,
        nextServerSeed: 'next-seed-1',
        nextServerSeedHash: 'next-hash-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        revealedAt: undefined,
      } as SeedPairEntity);

      // Mock subsequent requests to throw unique constraint errors
      const uniqueError = new Error('duplicate key value');
      (uniqueError as any).code = '23505';

      generateSeedPairSpy.mockRejectedValueOnce(uniqueError);
      generateSeedPairSpy.mockRejectedValueOnce(uniqueError);

      // Setup query mocks for all three requests
      // First request: no seed, then seed exists after creation
      queryRunner.manager.query
        .mockResolvedValueOnce([[], 0]) // No seed initially
        .mockResolvedValueOnce([
          [
            {
              serverSeed: 'seed-1',
              clientSeed: 'client-1',
              serverSeedHash: 'hash-1',
              nonce: '1',
            },
          ],
          1,
        ]); // Seed exists after retry

      // Second request: no seed, then reads existing seed
      queryRunner.manager.query
        .mockResolvedValueOnce([[], 0]) // No seed initially
        .mockResolvedValueOnce([
          [
            {
              serverSeed: 'seed-1',
              clientSeed: 'client-1',
              serverSeedHash: 'hash-1',
              nonce: '2',
            },
          ],
          1,
        ]); // Reads existing seed

      // Third request: no seed, then reads existing seed
      queryRunner.manager.query
        .mockResolvedValueOnce([[], 0]) // No seed initially
        .mockResolvedValueOnce([
          [
            {
              serverSeed: 'seed-1',
              clientSeed: 'client-1',
              serverSeedHash: 'hash-1',
              nonce: '3',
            },
          ],
          1,
        ]); // Reads existing seed

      // Simulate concurrent requests
      const results = await Promise.all([
        service.generateGameOutcome(userId, gameType, betAmount),
        service.generateGameOutcome(userId, gameType, betAmount),
        service.generateGameOutcome(userId, gameType, betAmount),
      ]);

      // All requests should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.serverSeed).toBe('seed-1');
        expect(result.clientSeed).toBe('client-1');
      });

      // Verify nonces are different (each request incremented nonce)
      expect(results[0].nonce).toBe('1');
      expect(results[1].nonce).toBe('2');
      expect(results[2].nonce).toBe('3');

      // generateSeedPair should have been called 3 times total
      // (once successfully, twice with errors)
      expect(generateSeedPairSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null error properties gracefully', async () => {
      const userId = 'edge-case-user';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      // Error with no code or message
      const nullError = {} as Error;
      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(nullError);

      // Should re-throw because it's not a unique constraint error
      await expect(service.generateGameOutcome(userId, gameType, betAmount)).rejects.toThrow();
    });

    it('should handle error with code but no message', async () => {
      const userId = 'edge-case-user-2';
      const gameType = GameTypeEnum.DICE;
      const betAmount = '1.00';

      queryRunner.manager.query.mockResolvedValueOnce([[], 0]);

      const errorWithCode = new Error();
      (errorWithCode as any).code = '23505';

      jest.spyOn(service, 'generateSeedPair').mockRejectedValueOnce(errorWithCode);

      queryRunner.manager.query.mockResolvedValueOnce([
        [
          {
            serverSeed: 'seed',
            clientSeed: 'client',
            serverSeedHash: 'hash',
            nonce: '1',
          },
        ],
        1,
      ]);

      // Should succeed because error code matches
      const result = await service.generateGameOutcome(userId, gameType, betAmount);
      expect(result).toBeDefined();
    });
  });
});
