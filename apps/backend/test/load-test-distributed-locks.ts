import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BalanceService } from '../src/balance/balance.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DistributedLockService } from '../src/common/services/distributed-lock.service';

/**
 * Load Test Script for Distributed Locks
 *
 * This script simulates high-concurrency scenarios to test:
 * - Lock acquisition success rate under load
 * - Lock contention handling
 * - Average lock wait time
 * - System throughput with distributed locks
 *
 * Usage: ts-node -r tsconfig-paths/register test/load-test-distributed-locks.ts
 */

interface LoadTestMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  lockAcquisitionFailures: number;
  operationFailures: number;
  throughput: number; // operations per second
}

interface LockMetrics {
  lockAcquisitions: number;
  lockFailures: number;
  totalLockWaitTime: number;
  averageLockWaitTime: number;
  maxLockWaitTime: number;
  minLockWaitTime: number;
}

class DistributedLockLoadTester {
  private app: INestApplication;
  private distributedLockService: DistributedLockService;
  private balanceService: BalanceService;
  private testUsers: Array<{ token: string; userId: string }> = [];

  async initialize(): Promise<void> {
    console.log('Initializing load test environment...\n');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    this.app.useGlobalFilters(new GlobalExceptionFilter());
    this.app.enableCors();
    this.app.setGlobalPrefix('v1');

    await this.app.init();

    this.distributedLockService = moduleFixture.get<DistributedLockService>(DistributedLockService);
    this.balanceService = moduleFixture.get<BalanceService>(BalanceService);

    console.log('✓ Application initialized');
  }

  async createTestUsers(count: number): Promise<void> {
    console.log(`Creating ${count} test users...`);

    for (let i = 0; i < count; i++) {
      const timestamp = Date.now();
      const userResponse = await request(this.app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: `loadtest_${timestamp}_${i}@example.com`,
          password: 'TestPassword123!',
          username: `loaduser_${timestamp}_${i}`,
        });

      if (userResponse.status !== 201) {
        throw new Error(`Failed to create user ${i}: ${userResponse.body.message}`);
      }

      const userId = userResponse.body.user.id;
      const token = userResponse.body.accessToken;

      // Fund user with sufficient balance
      await this.balanceService.updateBalance({
        userId,
        asset: AssetTypeEnum.USDC,
        amount: '100000.00000000',
        operation: BalanceOperationEnum.MANUAL_CREDIT,
        operationId: `load-test-fund-${userId}-${timestamp}`,
      });

      this.testUsers.push({ token, userId });
    }

    console.log(`✓ Created and funded ${count} users\n`);
  }

  /**
   * Test 1: Lock Acquisition Performance
   * Measures pure lock acquisition/release performance
   */
  async testLockAcquisitionPerformance(
    numLocks: number,
    concurrency: number,
  ): Promise<LockMetrics> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST 1: Lock Acquisition Performance`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Operations: ${numLocks}`);
    console.log(`Concurrency: ${concurrency}`);

    const metrics: LockMetrics = {
      lockAcquisitions: 0,
      lockFailures: 0,
      totalLockWaitTime: 0,
      averageLockWaitTime: 0,
      maxLockWaitTime: 0,
      minLockWaitTime: Infinity,
    };

    const batches: Array<Array<() => Promise<void>>> = [];
    for (let i = 0; i < numLocks; i += concurrency) {
      const batch = [];
      for (let j = 0; j < concurrency && i + j < numLocks; j++) {
        const lockId = i + j;
        batch.push(async () => {
          const resource = `load-test:lock:${lockId}`;
          const startTime = Date.now();

          try {
            const lock = await this.distributedLockService.acquireLock(resource, 5000, {
              retryCount: 10,
              retryDelay: 100,
            });

            const waitTime = Date.now() - startTime;
            metrics.lockAcquisitions++;
            metrics.totalLockWaitTime += waitTime;
            metrics.maxLockWaitTime = Math.max(metrics.maxLockWaitTime, waitTime);
            metrics.minLockWaitTime = Math.min(metrics.minLockWaitTime, waitTime);

            // Hold lock briefly
            await new Promise((resolve) => setTimeout(resolve, 10));

            await this.distributedLockService.releaseLock(lock);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_error) {
            metrics.lockFailures++;
          }
        });
      }
      batches.push(batch);
    }

    // Execute batches sequentially, operations within batch concurrently
    for (const batch of batches) {
      await Promise.all(batch.map((fn) => fn()));
    }

    metrics.averageLockWaitTime = metrics.totalLockWaitTime / metrics.lockAcquisitions;

    console.log(`\nResults:`);
    console.log(`  ✓ Successful acquisitions: ${metrics.lockAcquisitions}`);
    console.log(`  ✗ Failed acquisitions: ${metrics.lockFailures}`);
    console.log(`  ⌛ Average wait time: ${metrics.averageLockWaitTime.toFixed(2)}ms`);
    console.log(`  ⌛ Min wait time: ${metrics.minLockWaitTime.toFixed(2)}ms`);
    console.log(`  ⌛ Max wait time: ${metrics.maxLockWaitTime.toFixed(2)}ms`);
    console.log(`  📊 Success rate: ${((metrics.lockAcquisitions / numLocks) * 100).toFixed(2)}%`);

    return metrics;
  }

  /**
   * Test 2: Contended Resource Access
   * Multiple operations trying to acquire the same lock
   */
  async testContendedResourceAccess(
    numOperations: number,
    numResources: number,
  ): Promise<LoadTestMetrics> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST 2: Contended Resource Access`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Operations: ${numOperations}`);
    console.log(`Resources: ${numResources}`);
    console.log(`Contention: ${(numOperations / numResources).toFixed(1)}x`);

    const metrics: LoadTestMetrics = {
      totalOperations: numOperations,
      successfulOperations: 0,
      failedOperations: 0,
      totalDuration: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      lockAcquisitionFailures: 0,
      operationFailures: 0,
      throughput: 0,
    };

    const latencies: number[] = [];
    const startTime = Date.now();

    const operations = Array(numOperations)
      .fill(null)
      .map((_, index) => async () => {
        const resourceId = index % numResources;
        const resource = `load-test:contended:${resourceId}`;
        const opStartTime = Date.now();

        try {
          await this.distributedLockService.withLock(
            resource,
            5000,
            async () => {
              // Simulate work
              await new Promise((resolve) => setTimeout(resolve, 20));
            },
            {
              retryCount: 20,
              retryDelay: 50,
            },
          );

          const latency = Date.now() - opStartTime;
          latencies.push(latency);
          metrics.successfulOperations++;
          metrics.minLatency = Math.min(metrics.minLatency, latency);
          metrics.maxLatency = Math.max(metrics.maxLatency, latency);
        } catch (error) {
          if (error.message.includes('lock')) {
            metrics.lockAcquisitionFailures++;
          } else {
            metrics.operationFailures++;
          }
          metrics.failedOperations++;
        }
      });

    // Execute all operations concurrently
    await Promise.all(operations.map((fn) => fn()));

    metrics.totalDuration = Date.now() - startTime;
    metrics.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    metrics.throughput = (metrics.successfulOperations / metrics.totalDuration) * 1000;

    console.log(`\nResults:`);
    console.log(`  ✓ Successful operations: ${metrics.successfulOperations}`);
    console.log(`  ✗ Failed operations: ${metrics.failedOperations}`);
    console.log(`  ⌛ Total duration: ${metrics.totalDuration}ms`);
    console.log(`  ⌛ Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Min latency: ${metrics.minLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Max latency: ${metrics.maxLatency.toFixed(2)}ms`);
    console.log(`  🚀 Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);
    console.log(
      `  📊 Success rate: ${((metrics.successfulOperations / numOperations) * 100).toFixed(2)}%`,
    );

    return metrics;
  }

  /**
   * Test 3: Concurrent Bet Placement Simulation
   * Simulates real-world game bet placement
   */
  async testConcurrentBetPlacement(numBets: number): Promise<LoadTestMetrics> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST 3: Concurrent Bet Placement`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total bets: ${numBets}`);
    console.log(`Users: ${this.testUsers.length}`);

    const metrics: LoadTestMetrics = {
      totalOperations: numBets,
      successfulOperations: 0,
      failedOperations: 0,
      totalDuration: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      lockAcquisitionFailures: 0,
      operationFailures: 0,
      throughput: 0,
    };

    const latencies: number[] = [];
    const startTime = Date.now();

    const betPromises = Array(numBets)
      .fill(null)
      .map((_, index) => async () => {
        const user = this.testUsers[index % this.testUsers.length];
        const opStartTime = Date.now();

        try {
          const response = await request(this.app.getHttpServer())
            .post('/v1/games/dice')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
              betAmount: '1.00000000',
              betType: 'roll_over',
              targetNumber: 50,
            });

          const latency = Date.now() - opStartTime;

          if (response.status === 201) {
            latencies.push(latency);
            metrics.successfulOperations++;
            metrics.minLatency = Math.min(metrics.minLatency, latency);
            metrics.maxLatency = Math.max(metrics.maxLatency, latency);
          } else {
            metrics.failedOperations++;
            metrics.operationFailures++;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
          metrics.failedOperations++;
          metrics.operationFailures++;
        }
      });

    // Execute in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < betPromises.length; i += batchSize) {
      const batch = betPromises.slice(i, i + batchSize);
      await Promise.all(batch.map((fn) => fn()));
    }

    metrics.totalDuration = Date.now() - startTime;
    metrics.averageLatency =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    metrics.throughput = (metrics.successfulOperations / metrics.totalDuration) * 1000;

    console.log(`\nResults:`);
    console.log(`  ✓ Successful bets: ${metrics.successfulOperations}`);
    console.log(`  ✗ Failed bets: ${metrics.failedOperations}`);
    console.log(`  ⌛ Total duration: ${metrics.totalDuration}ms`);
    console.log(`  ⌛ Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Min latency: ${metrics.minLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Max latency: ${metrics.maxLatency.toFixed(2)}ms`);
    console.log(`  🚀 Throughput: ${metrics.throughput.toFixed(2)} bets/sec`);
    console.log(
      `  📊 Success rate: ${((metrics.successfulOperations / numBets) * 100).toFixed(2)}%`,
    );

    return metrics;
  }

  /**
   * Test 4: Balance Update Stress Test
   * High-frequency balance updates to test race condition prevention
   */
  async testBalanceUpdateStress(numUpdatesPerUser: number): Promise<LoadTestMetrics> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST 4: Balance Update Stress Test`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Updates per user: ${numUpdatesPerUser}`);
    console.log(`Users: ${this.testUsers.length}`);
    console.log(`Total operations: ${numUpdatesPerUser * this.testUsers.length}`);

    const metrics: LoadTestMetrics = {
      totalOperations: numUpdatesPerUser * this.testUsers.length,
      successfulOperations: 0,
      failedOperations: 0,
      totalDuration: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      lockAcquisitionFailures: 0,
      operationFailures: 0,
      throughput: 0,
    };

    const latencies: number[] = [];
    const startTime = Date.now();

    const updatePromises = this.testUsers.flatMap((user) =>
      Array(numUpdatesPerUser)
        .fill(null)
        .map((_, index) => async () => {
          const opStartTime = Date.now();

          try {
            await this.balanceService.updateBalance({
              userId: user.userId,
              asset: AssetTypeEnum.USDC,
              amount: '1.00000000',
              operation: BalanceOperationEnum.MANUAL_CREDIT,
              operationId: `load-test-${user.userId}-${Date.now()}-${index}-${Math.random()}`,
            });

            const latency = Date.now() - opStartTime;
            latencies.push(latency);
            metrics.successfulOperations++;
            metrics.minLatency = Math.min(metrics.minLatency, latency);
            metrics.maxLatency = Math.max(metrics.maxLatency, latency);
          } catch (error) {
            metrics.failedOperations++;
            if (error.message.includes('lock')) {
              metrics.lockAcquisitionFailures++;
            } else {
              metrics.operationFailures++;
            }
          }
        }),
    );

    // Execute all updates concurrently
    await Promise.all(updatePromises.map((fn) => fn()));

    metrics.totalDuration = Date.now() - startTime;
    metrics.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    metrics.throughput = (metrics.successfulOperations / metrics.totalDuration) * 1000;

    console.log(`\nResults:`);
    console.log(`  ✓ Successful updates: ${metrics.successfulOperations}`);
    console.log(`  ✗ Failed updates: ${metrics.failedOperations}`);
    console.log(`  ⌛ Total duration: ${metrics.totalDuration}ms`);
    console.log(`  ⌛ Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Min latency: ${metrics.minLatency.toFixed(2)}ms`);
    console.log(`  ⌛ Max latency: ${metrics.maxLatency.toFixed(2)}ms`);
    console.log(`  🚀 Throughput: ${metrics.throughput.toFixed(2)} updates/sec`);
    console.log(
      `  📊 Success rate: ${((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(2)}%`,
    );

    return metrics;
  }

  async cleanup(): Promise<void> {
    console.log('\nCleaning up...');
    await this.app.close();
    console.log('✓ Cleanup complete\n');
  }

  async runAllTests(): Promise<void> {
    try {
      await this.initialize();
      await this.createTestUsers(10);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`DISTRIBUTED LOCK LOAD TEST SUITE`);
      console.log(`${'='.repeat(60)}\n`);

      // Test 1: Lock acquisition performance
      await this.testLockAcquisitionPerformance(100, 10);

      // Test 2: Contended resource access
      await this.testContendedResourceAccess(200, 5);

      // Test 3: Concurrent bet placement
      await this.testConcurrentBetPlacement(100);

      // Test 4: Balance update stress test
      await this.testBalanceUpdateStress(20);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`LOAD TEST SUITE COMPLETED`);
      console.log(`${'='.repeat(60)}\n`);

      await this.cleanup();
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Load test failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the load test suite if executed directly
if (require.main === module) {
  const tester = new DistributedLockLoadTester();
  void tester.runAllTests();
}

export { DistributedLockLoadTester, LoadTestMetrics, LockMetrics };
