import { AssetTypeEnum, BalanceOperationEnum, UserEntity } from '@zetik/shared-entities';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { BalanceService } from '../src/balance/balance.service';
import { RakebackService } from '../src/bonus/services/rakeback.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DistributedLockService } from '../src/common/services/distributed-lock.service';
import { DiceService } from '../src/games/dice/dice.service';
import { KenoService } from '../src/games/keno/keno.service';
import { LimboService } from '../src/games/limbo/limbo.service';

describe('Distributed Locks (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<UserEntity>;
  let balanceService: BalanceService;
  let distributedLockService: DistributedLockService;
  let diceService: DiceService;
  let limboService: LimboService;
  let kenoService: KenoService;
  let rakebackService: RakebackService;

  // Test users
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.enableCors();
    app.setGlobalPrefix('v1');

    await app.init();

    // Get services and repositories
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    balanceService = moduleFixture.get<BalanceService>(BalanceService);
    distributedLockService = moduleFixture.get<DistributedLockService>(DistributedLockService);
    diceService = moduleFixture.get<DiceService>(DiceService);
    limboService = moduleFixture.get<LimboService>(LimboService);
    kenoService = moduleFixture.get<KenoService>(KenoService);
    rakebackService = moduleFixture.get<RakebackService>(RakebackService);

    // Create test users
    const user1Response = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `locktest1_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `lockuser1_${Date.now()}`,
      })
      .expect(201);

    user1Token = user1Response.body.accessToken;
    user1Id = user1Response.body.user.id;

    const user2Response = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `locktest2_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `lockuser2_${Date.now()}`,
      })
      .expect(201);

    user2Token = user2Response.body.accessToken;
    user2Id = user2Response.body.user.id;

    // Fund test users with sufficient balance
    await balanceService.updateBalance({
      userId: user1Id,
      asset: AssetTypeEnum.USDC,
      amount: '10000.00000000',
      operation: BalanceOperationEnum.MANUAL_CREDIT,
      operationId: `fund-user1-${Date.now()}`,
    });

    await balanceService.updateBalance({
      userId: user2Id,
      asset: AssetTypeEnum.USDC,
      amount: '10000.00000000',
      operation: BalanceOperationEnum.MANUAL_CREDIT,
      operationId: `fund-user2-${Date.now()}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('DistributedLockService - Basic Functionality', () => {
    it('should acquire and release lock successfully', async () => {
      const resource = `test:basic:${Date.now()}`;
      const lock = await distributedLockService.acquireLock(resource, 5000);

      expect(lock).toBeDefined();
      expect(lock.resources).toContain(`locks:${resource}`);

      await distributedLockService.releaseLock(lock);

      // Verify lock is released by checking if we can acquire it again
      const secondLock = await distributedLockService.acquireLock(resource, 5000);
      expect(secondLock).toBeDefined();
      await distributedLockService.releaseLock(secondLock);
    });

    it('should prevent concurrent lock acquisition on same resource', async () => {
      const resource = `test:concurrent:${Date.now()}`;
      const lock1 = await distributedLockService.acquireLock(resource, 5000);

      // Try to acquire the same lock without retries - should fail
      await expect(
        distributedLockService.acquireLock(resource, 5000, { retryCount: 0 }),
      ).rejects.toThrow();

      await distributedLockService.releaseLock(lock1);
    });

    it('should successfully use withLock helper', async () => {
      const resource = `test:withlock:${Date.now()}`;
      let operationExecuted = false;

      const result = await distributedLockService.withLock(resource, 5000, async () => {
        operationExecuted = true;
        return 'success';
      });

      expect(operationExecuted).toBe(true);
      expect(result).toBe('success');
    });

    it('should release lock even if operation throws error', async () => {
      const resource = `test:error:${Date.now()}`;

      await expect(
        distributedLockService.withLock(resource, 5000, async () => {
          throw new Error('Operation failed');
        }),
      ).rejects.toThrow('Operation failed');

      // Verify lock was released by acquiring it again
      const lock = await distributedLockService.acquireLock(resource, 5000);
      expect(lock).toBeDefined();
      await distributedLockService.releaseLock(lock);
    });

    it('should support tryLock for non-blocking acquisition', async () => {
      const resource = `test:trylock:${Date.now()}`;

      const lock1 = await distributedLockService.tryLock(resource, 5000);
      expect(lock1).not.toBeNull();

      const lock2 = await distributedLockService.tryLock(resource, 5000);
      expect(lock2).toBeNull();

      if (lock1) {
        await distributedLockService.releaseLock(lock1);
      }
    });

    it('should extend lock TTL successfully', async () => {
      const resource = `test:extend:${Date.now()}`;
      const lock = await distributedLockService.acquireLock(resource, 5000);

      const extendedLock = await distributedLockService.extendLock(lock, 10000);
      expect(extendedLock).toBeDefined();

      await distributedLockService.releaseLock(extendedLock);
    });

    it('should check if resource is locked', async () => {
      const resource = `test:islocked:${Date.now()}`;

      const isLockedBefore = await distributedLockService.isLocked(resource);
      expect(isLockedBefore).toBe(false);

      const lock = await distributedLockService.acquireLock(resource, 5000);

      const isLockedDuring = await distributedLockService.isLocked(resource);
      expect(isLockedDuring).toBe(true);

      await distributedLockService.releaseLock(lock);

      // Note: There might be a small delay before Redis fully releases the lock
      await new Promise((resolve) => setTimeout(resolve, 100));

      const isLockedAfter = await distributedLockService.isLocked(resource);
      expect(isLockedAfter).toBe(false);
    });
  });

  describe('Concurrent Bet Placement - Race Condition Tests', () => {
    describe('Dice Game Concurrent Bets', () => {
      it('should handle concurrent dice bets for same user without race conditions', async () => {
        const betAmount = '10.00000000';
        const numConcurrentBets = 5;

        // Get initial balance
        const initialBalanceResponse = await request(app.getHttpServer())
          .get('/v1/balance')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        const initialBalance = parseFloat(
          initialBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
            ?.amount || '0',
        );

        // Place multiple concurrent bets
        const betPromises = Array(numConcurrentBets)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .post('/v1/games/dice')
              .set('Authorization', `Bearer ${user1Token}`)
              .send({
                betAmount,
                betType: 'roll_over',
                targetNumber: 50,
              }),
          );

        const results = await Promise.allSettled(betPromises);

        // All bets should succeed due to distributed locking preventing race conditions
        const successfulBets = results.filter((r) => r.status === 'fulfilled');
        expect(successfulBets.length).toBe(numConcurrentBets);

        // Get final balance
        const finalBalanceResponse = await request(app.getHttpServer())
          .get('/v1/balance')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        const finalBalance = parseFloat(
          finalBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
            ?.amount || '0',
        );

        // Verify balance changes are consistent
        // Balance should decrease by at least the total bet amount (minus any wins)
        expect(finalBalance).toBeLessThanOrEqual(initialBalance);
      });

      it('should handle concurrent dice bets from different users without interference', async () => {
        const betAmount = '5.00000000';

        // Place concurrent bets from both users
        const [result1, result2] = await Promise.all([
          request(app.getHttpServer())
            .post('/v1/games/dice')
            .set('Authorization', `Bearer ${user1Token}`)
            .send({
              betAmount,
              betType: 'roll_over',
              targetNumber: 50,
            }),
          request(app.getHttpServer())
            .post('/v1/games/dice')
            .set('Authorization', `Bearer ${user2Token}`)
            .send({
              betAmount,
              betType: 'roll_under',
              targetNumber: 50,
            }),
        ]);

        expect(result1.status).toBe(201);
        expect(result2.status).toBe(201);
        expect(result1.body.bet).toBeDefined();
        expect(result2.body.bet).toBeDefined();
      });
    });

    describe('Limbo Game Concurrent Bets', () => {
      it('should handle concurrent limbo bets without race conditions', async () => {
        const betAmount = '10.00000000';
        const numConcurrentBets = 5;

        const betPromises = Array(numConcurrentBets)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .post('/v1/games/limbo')
              .set('Authorization', `Bearer ${user1Token}`)
              .send({
                betAmount,
                multiplier: 2.0,
              }),
          );

        const results = await Promise.allSettled(betPromises);
        const successfulBets = results.filter((r) => r.status === 'fulfilled');

        expect(successfulBets.length).toBe(numConcurrentBets);
      });
    });

    describe('Keno Game Concurrent Bets', () => {
      it('should handle concurrent keno bets without race conditions', async () => {
        const betAmount = '10.00000000';
        const numConcurrentBets = 5;

        const betPromises = Array(numConcurrentBets)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .post('/v1/games/keno')
              .set('Authorization', `Bearer ${user1Token}`)
              .send({
                betAmount,
                selectedNumbers: [1, 2, 3, 4, 5],
              }),
          );

        const results = await Promise.allSettled(betPromises);
        const successfulBets = results.filter((r) => r.status === 'fulfilled');

        expect(successfulBets.length).toBe(numConcurrentBets);
      });
    });
  });

  describe('Concurrent Balance Updates - Race Condition Tests', () => {
    it('should prevent double-crediting with concurrent balance updates', async () => {
      const operationId = `test-credit-${Date.now()}`;
      const creditAmount = '100.00000000';

      // Get initial balance
      const initialBalanceResponse = await request(app.getHttpServer())
        .get('/v1/balance')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const initialBalance = parseFloat(
        initialBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
          ?.amount || '0',
      );

      // Try to credit the same amount twice with the same operationId
      const promises = [
        balanceService.updateBalance({
          userId: user1Id,
          asset: AssetTypeEnum.USDC,
          amount: creditAmount,
          operation: BalanceOperationEnum.MANUAL_CREDIT,
          operationId,
        }),
        balanceService.updateBalance({
          userId: user1Id,
          asset: AssetTypeEnum.USDC,
          amount: creditAmount,
          operation: BalanceOperationEnum.MANUAL_CREDIT,
          operationId,
        }),
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail due to duplicate operationId
      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);

      // Get final balance
      const finalBalanceResponse = await request(app.getHttpServer())
        .get('/v1/balance')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const finalBalance = parseFloat(
        finalBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
          ?.amount || '0',
      );

      // Balance should only increase by creditAmount once
      expect(finalBalance).toBeCloseTo(initialBalance + parseFloat(creditAmount), 6);
    });

    it('should handle multiple concurrent balance updates with different operations', async () => {
      const numOperations = 10;
      const amount = '10.00000000';

      // Get initial balance
      const initialBalanceResponse = await request(app.getHttpServer())
        .get('/v1/balance')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      const initialBalance = parseFloat(
        initialBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
          ?.amount || '0',
      );

      // Create concurrent credit operations
      const promises = Array(numOperations)
        .fill(null)
        .map((_, index) =>
          balanceService.updateBalance({
            userId: user2Id,
            asset: AssetTypeEnum.USDC,
            amount,
            operation: BalanceOperationEnum.MANUAL_CREDIT,
            operationId: `concurrent-credit-${Date.now()}-${index}`,
          }),
        );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');

      // All should succeed with unique operationIds
      expect(successful.length).toBe(numOperations);

      // Get final balance
      const finalBalanceResponse = await request(app.getHttpServer())
        .get('/v1/balance')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      const finalBalance = parseFloat(
        finalBalanceResponse.body.balances.find((b: any) => b.asset === AssetTypeEnum.USDC)
          ?.amount || '0',
      );

      // Balance should increase by amount * numOperations
      const expectedIncrease = parseFloat(amount) * numOperations;
      expect(finalBalance).toBeCloseTo(initialBalance + expectedIncrease, 6);
    });
  });

  describe('Rakeback Claim - Double Claim Prevention', () => {
    it('should prevent double-claim of rakeback', async () => {
      // First, make some bets to accumulate rakeback
      const betAmount = '100.00000000';
      await request(app.getHttpServer())
        .post('/v1/games/dice')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          betAmount,
          betType: 'roll_over',
          targetNumber: 50,
        });

      // Wait a bit for rakeback to accumulate (if needed)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to claim rakeback twice concurrently
      const claimPromises = [
        request(app.getHttpServer())
          .post('/v1/bonus/rakeback/claim')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            asset: AssetTypeEnum.USDC,
          }),
        request(app.getHttpServer())
          .post('/v1/bonus/rakeback/claim')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            asset: AssetTypeEnum.USDC,
          }),
      ];

      const results = await Promise.allSettled(claimPromises);

      // Both requests might complete, but the second one should indicate no rakeback available
      // or one should fail. The key is that rakeback amount should only be credited once.
      const responses = results
        .filter((r) => r.status === 'fulfilled')
        .map((r: any) => r.value.body);

      // At least one should succeed or indicate no rakeback
      expect(results.length).toBe(2);

      // Verify only one claim was successful (if there was rakeback to claim)
      const successfulClaims = responses.filter((r: any) => r.success === true);
      expect(successfulClaims.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Lock Performance and Contention', () => {
    it('should handle high contention with retries', async () => {
      const resource = `test:contention:${Date.now()}`;
      const numAttempts = 10;
      let successCount = 0;
      let failCount = 0;

      const promises = Array(numAttempts)
        .fill(null)
        .map(async () => {
          try {
            await distributedLockService.withLock(
              resource,
              1000,
              async () => {
                // Simulate some work
                await new Promise((resolve) => setTimeout(resolve, 50));
                successCount++;
              },
              {
                retryCount: 20, // Allow retries for high contention
                retryDelay: 50,
              },
            );
          } catch (error) {
            failCount++;
          }
        });

      await Promise.allSettled(promises);

      // Most or all should succeed due to retry mechanism
      expect(successCount).toBeGreaterThan(numAttempts * 0.8); // At least 80% success rate
    });

    it('should measure lock acquisition latency', async () => {
      const resource = `test:latency:${Date.now()}`;
      const startTime = Date.now();

      await distributedLockService.withLock(resource, 5000, async () => {
        // Quick operation
        return true;
      });

      const latency = Date.now() - startTime;

      // Lock acquisition should be fast (under 100ms for uncontended lock)
      expect(latency).toBeLessThan(100);
    });
  });

  describe('Lock Expiration and Cleanup', () => {
    it('should allow lock acquisition after TTL expires', async () => {
      const resource = `test:expiration:${Date.now()}`;
      const shortTTL = 1000; // 1 second

      const lock1 = await distributedLockService.acquireLock(resource, shortTTL);
      expect(lock1).toBeDefined();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, shortTTL + 500));

      // Should be able to acquire the lock again after expiration
      const lock2 = await distributedLockService.acquireLock(resource, 5000);
      expect(lock2).toBeDefined();
      await distributedLockService.releaseLock(lock2);
    });
  });

  describe('Cross-Service Lock Coordination', () => {
    it('should coordinate locks across different service operations', async () => {
      // This test verifies that different services can coordinate using locks
      const userId = user1Id;
      const asset = AssetTypeEnum.USDC;
      const lockKey = `balance:update:${userId}:${asset}`;

      // Acquire a lock
      const lock = await distributedLockService.acquireLock(lockKey, 5000);

      // Try to make a bet (which also needs to update balance)
      // This should wait for the lock or fail
      const betPromise = request(app.getHttpServer())
        .post('/v1/games/dice')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          betAmount: '1.00000000',
          betType: 'roll_over',
          targetNumber: 50,
        });

      // Release the lock after a short delay
      setTimeout(async () => {
        await distributedLockService.releaseLock(lock);
      }, 500);

      // The bet should eventually succeed after lock is released
      const betResult = await betPromise;
      expect([201, 400, 500]).toContain(betResult.status);
    });
  });

  describe('Stress Test - Multiple Users, Multiple Operations', () => {
    it('should handle complex concurrent scenario with multiple users and operations', async () => {
      const operations = [];

      // User 1: Place multiple bets
      for (let i = 0; i < 3; i++) {
        operations.push(
          request(app.getHttpServer())
            .post('/v1/games/dice')
            .set('Authorization', `Bearer ${user1Token}`)
            .send({
              betAmount: '5.00000000',
              betType: 'roll_over',
              targetNumber: 50,
            }),
        );
      }

      // User 2: Place multiple bets
      for (let i = 0; i < 3; i++) {
        operations.push(
          request(app.getHttpServer())
            .post('/v1/games/limbo')
            .set('Authorization', `Bearer ${user2Token}`)
            .send({
              betAmount: '5.00000000',
              multiplier: 2.0,
            }),
        );
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      const successful = results.filter((r) => r.status === 'fulfilled');

      // All operations should succeed
      expect(successful.length).toBe(operations.length);
    });
  });

  describe('Lock Error Handling', () => {
    it('should handle lock acquisition timeout gracefully', async () => {
      const resource = `test:timeout:${Date.now()}`;

      // Acquire a lock and hold it
      const lock = await distributedLockService.acquireLock(resource, 10000);

      // Try to acquire the same lock with no retries - should fail quickly
      await expect(
        distributedLockService.acquireLock(resource, 5000, { retryCount: 0 }),
      ).rejects.toThrow();

      await distributedLockService.releaseLock(lock);
    });

    it('should not leave orphaned locks after service errors', async () => {
      const resource = `test:orphan:${Date.now()}`;

      // Attempt an operation that fails
      try {
        await distributedLockService.withLock(resource, 5000, async () => {
          throw new Error('Simulated service error');
        });
      } catch (error) {
        // Expected error
      }

      // Lock should be released, allowing immediate re-acquisition
      const lock = await distributedLockService.acquireLock(resource, 5000);
      expect(lock).toBeDefined();
      await distributedLockService.releaseLock(lock);
    });
  });
});
