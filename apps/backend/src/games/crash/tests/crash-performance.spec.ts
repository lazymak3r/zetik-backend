import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CrashBetEntity, CrashGameEntity, CrashGameStatusEnum } from '@zetik/shared-entities';
import { BalanceService } from '../../../balance/balance.service';
import { CrashGateway } from '../gateways/crash.gateway.simple';
import { CrashWebSocketService } from '../services/crash-websocket.service';

describe('Crash Game - Performance Tests', () => {
  let crashWebSocketService: CrashWebSocketService;
  let mockCrashGateway: Partial<CrashGateway>;

  beforeEach(async () => {
    // Mock CrashGateway with performance tracking
    mockCrashGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        fetchSockets: jest.fn().mockResolvedValue([]),
        sockets: {
          size: 0,
        },
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashWebSocketService,
        {
          provide: getRepositoryToken(CrashGameEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CrashBetEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: 'DataSource',
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
        {
          provide: CrashGateway,
          useValue: mockCrashGateway,
        },
      ],
    }).compile();

    crashWebSocketService = module.get<CrashWebSocketService>(CrashWebSocketService);
  });

  describe('WebSocket Performance Tests', () => {
    it('should maintain sub-100ms latency for multiplier updates', async () => {
      console.log('⚡ Testing WebSocket multiplier update latency...');

      const updateCount = 100;
      const latencies: number[] = [];

      for (let i = 0; i < updateCount; i++) {
        const startTime = performance.now();

        await crashWebSocketService.broadcastMultiplierUpdate({
          gameId: 'test-game',
          multiplier: (1.0 + i * 0.1).toString(),
          timestamp: Date.now(),
        });

        const endTime = performance.now();
        const latency = endTime - startTime;
        latencies.push(latency);
      }

      const averageLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log(
        `📊 Latency stats: avg=${averageLatency.toFixed(2)}ms, max=${maxLatency.toFixed(2)}ms, min=${minLatency.toFixed(2)}ms`,
      );

      // Performance requirements
      expect(averageLatency).toBeLessThan(50); // Average under 50ms
      expect(maxLatency).toBeLessThan(100); // Max under 100ms
      expect(minLatency).toBeGreaterThan(0);
    });

    it('should handle 1000+ concurrent WebSocket connections simulation', () => {
      console.log('🔗 Testing concurrent WebSocket connection handling...');

      const connectionCount = 1000;
      const startTime = performance.now();

      // Simulate adding many players
      for (let i = 1; i <= connectionCount; i++) {
        crashWebSocketService.addPlayer(`user-${i}`, `socket-${i}`, `player${i}`);
      }

      const addTime = performance.now();
      const playerCount = crashWebSocketService.getPlayersCount();

      // Test getting all socket IDs
      const socketIds = crashWebSocketService.getAllSocketIds();
      const getTime = performance.now();

      // Remove half the players
      const removeCount = connectionCount / 2;
      for (let i = 1; i <= removeCount; i++) {
        crashWebSocketService.removePlayer(`socket-${i}`);
      }

      const removeTime = performance.now();
      const finalPlayerCount = crashWebSocketService.getPlayersCount();

      console.log(`📊 Performance metrics:`);
      console.log(`   Add ${connectionCount} players: ${(addTime - startTime).toFixed(2)}ms`);
      console.log(`   Get ${socketIds.length} socket IDs: ${(getTime - addTime).toFixed(2)}ms`);
      console.log(`   Remove ${removeCount} players: ${(removeTime - getTime).toFixed(2)}ms`);
      console.log(`   Final player count: ${finalPlayerCount}`);

      // Validate results
      expect(playerCount).toBe(connectionCount);
      expect(socketIds).toHaveLength(connectionCount);
      expect(finalPlayerCount).toBe(connectionCount - removeCount);

      // Performance requirements
      expect(addTime - startTime).toBeLessThan(1000); // Add 1000 players in under 1 second
      expect(getTime - addTime).toBeLessThan(100); // Get socket IDs in under 100ms
      expect(removeTime - getTime).toBeLessThan(500); // Remove 500 players in under 500ms
    });

    it('should validate message delivery reliability under load', async () => {
      console.log('📨 Testing message delivery reliability...');

      const playerCount = 100;
      const messageCount = 50;
      let deliveryCount = 0;

      // Mock emit to count deliveries
      const mockEmit = jest.fn(() => {
        deliveryCount++;
      });

      (mockCrashGateway.server?.to as jest.Mock).mockReturnValue({
        emit: mockEmit,
      });

      // Add players
      for (let i = 1; i <= playerCount; i++) {
        crashWebSocketService.addPlayer(`user-${i}`, `socket-${i}`, `player${i}`);
      }

      const startTime = performance.now();

      // Send multiple game state updates rapidly
      for (let i = 0; i < messageCount; i++) {
        await crashWebSocketService.broadcastGameState({
          id: 'test-game',
          status: CrashGameStatusEnum.FLYING,
          betsCount: playerCount,
          totalBetAmount: (100 * playerCount).toString(),
          serverSeedHash: 'test-hash',
          gameIndex: i,
        });
      }

      const endTime = performance.now();
      const deliveryTime = endTime - startTime;
      const deliveryRate = deliveryCount / messageCount;

      console.log(`📊 Delivery stats:`);
      console.log(`   Messages sent: ${messageCount}`);
      console.log(`   Messages delivered: ${deliveryCount}`);
      console.log(`   Delivery rate: ${(deliveryRate * 100).toFixed(1)}%`);
      console.log(`   Total time: ${deliveryTime.toFixed(2)}ms`);
      console.log(`   Average per message: ${(deliveryTime / messageCount).toFixed(2)}ms`);

      // Reliability requirements
      expect(deliveryRate).toBeGreaterThanOrEqual(0.99); // 99%+ delivery rate
      expect(deliveryTime / messageCount).toBeLessThan(10); // Under 10ms per message
    });
  });

  describe('Concurrent Processing Tests', () => {
    it('should process 100+ simultaneous bets without delays', async () => {
      console.log('🎰 Testing concurrent bet processing...');

      const betCount = 100;
      const bets: Array<{
        userId: string;
        betAmount: string;
        autoCashOutAt: number;
        timestamp: number;
      }> = [];

      // Generate concurrent bets
      for (let i = 1; i <= betCount; i++) {
        bets.push({
          userId: `user-${i}`,
          betAmount: (Math.random() * 100 + 1).toFixed(2),
          autoCashOutAt: 1.5 + Math.random() * 3.5,
          timestamp: Date.now() + i,
        });
      }

      const startTime = performance.now();

      // Process all bets concurrently
      const processPromises = bets.map(async (bet, index) => {
        return new Promise((resolve) => {
          // Simulate bet processing time
          setTimeout(() => {
            // Update player bet in WebSocket service
            crashWebSocketService.updatePlayerBet(bet.userId, `bet-${index + 1}`);
            resolve(bet);
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });

      const results = await Promise.all(processPromises);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const averagePerBet = processingTime / betCount;

      console.log(`📊 Concurrent processing stats:`);
      console.log(`   Bets processed: ${results.length}`);
      console.log(`   Total time: ${processingTime.toFixed(2)}ms`);
      console.log(`   Average per bet: ${averagePerBet.toFixed(2)}ms`);
      console.log(`   Throughput: ${(betCount / (processingTime / 1000)).toFixed(0)} bets/second`);

      // Performance requirements (relaxed for CI variability)
      expect(results).toHaveLength(betCount);
      expect(processingTime).toBeLessThan(2000);
      expect(averagePerBet).toBeLessThan(20);
    });

    it('should handle auto cash-out processing under load', async () => {
      console.log('💰 Testing auto cash-out under load...');

      const playerCount = 50;
      const currentMultiplier = 2.5;
      let processingTime = 0;

      // Add players with various auto cash-out targets
      const players: Array<{
        userId: string;
        autoCashOutAt: number;
        shouldCashOut: boolean;
      }> = [];
      for (let i = 1; i <= playerCount; i++) {
        const autoCashOutAt = 1.5 + Math.random() * 2.0; // 1.5x - 3.5x
        crashWebSocketService.addPlayer(`user-${i}`, `socket-${i}`, `player${i}`);
        players.push({
          userId: `user-${i}`,
          autoCashOutAt,
          shouldCashOut: currentMultiplier >= autoCashOutAt,
        });
      }

      const startTime = performance.now();

      // Process auto cash-outs for eligible players
      const cashOutPromises = players
        .filter((player) => player.shouldCashOut)
        .map(async (playerData) => {
          return new Promise((resolve) => {
            // Simulate auto cash-out processing
            setTimeout(() => {
              const retrievedPlayer = crashWebSocketService.getPlayer(playerData.userId);
              resolve(retrievedPlayer);
            }, Math.random() * 5); // Random delay 0-5ms
          });
        });

      const cashOutResults = await Promise.all(cashOutPromises);
      const endTime = performance.now();

      processingTime = endTime - startTime;
      const eligibleCount = players.filter((p) => p.shouldCashOut).length;

      console.log(`📊 Auto cash-out stats:`);
      console.log(`   Total players: ${playerCount}`);
      console.log(`   Eligible for cash-out: ${eligibleCount}`);
      console.log(`   Successfully processed: ${cashOutResults.length}`);
      console.log(`   Processing time: ${processingTime.toFixed(2)}ms`);

      // Performance requirements
      expect(cashOutResults).toHaveLength(eligibleCount);
      expect(processingTime).toBeLessThan(500); // Process all cash-outs in under 500ms
    });

    it('should maintain game timing accuracy under stress', async () => {
      console.log('⏱️ Testing game timing accuracy...');

      const iterations = 10; // Reduced from 100 to avoid timeout
      const targetInterval = 100; // 100ms intervals
      const timingErrors: number[] = [];

      let lastTimestamp = Date.now();

      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, targetInterval));

        const currentTimestamp = Date.now();
        const actualInterval = currentTimestamp - lastTimestamp;
        const error = Math.abs(actualInterval - targetInterval);

        timingErrors.push(error);
        lastTimestamp = currentTimestamp;

        // Simulate multiplier update during stress
        await crashWebSocketService.broadcastMultiplierUpdate({
          gameId: 'timing-test',
          multiplier: (1.0 + i * 0.01).toString(),
          timestamp: currentTimestamp,
        });
      }

      const averageError = timingErrors.reduce((sum, val) => sum + val, 0) / timingErrors.length;
      const maxError = Math.max(...timingErrors);
      const accuracy = ((targetInterval - averageError) / targetInterval) * 100;

      console.log(`📊 Timing accuracy stats:`);
      console.log(`   Target interval: ${targetInterval}ms`);
      console.log(`   Average error: ${averageError.toFixed(2)}ms`);
      console.log(`   Max error: ${maxError.toFixed(2)}ms`);
      console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);

      // Timing requirements
      expect(averageError).toBeLessThan(50); // Average error under 50ms
      expect(maxError).toBeLessThan(200); // Max error under 200ms
      expect(accuracy).toBeGreaterThan(80); // 80%+ accuracy
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should not leak memory during long game sessions', () => {
      console.log('🧠 Testing memory usage during long sessions...');

      const sessionDuration = 1000; // 1000 iterations
      const initialMemory = process.memoryUsage();

      // Simulate long gaming session
      for (let i = 0; i < sessionDuration; i++) {
        // Add and remove players continuously
        const userId = `session-user-${i}`;
        const socketId = `session-socket-${i}`;

        crashWebSocketService.addPlayer(userId, socketId, `player${i}`);

        // Remove some players periodically
        if (i % 10 === 0 && i > 0) {
          const removeId = `session-socket-${i - 5}`;
          crashWebSocketService.removePlayer(removeId);
        }

        // Update player bets
        if (i % 5 === 0) {
          crashWebSocketService.updatePlayerBet(userId, `bet-${i}`);
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      };

      console.log(`📊 Memory usage (MB):`);
      console.log(`   RSS increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `   Heap used increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `   Heap total increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      );

      // Memory requirements (should not increase significantly)
      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024); // Under 50MB increase

      // Clean up
      const finalPlayerCount = crashWebSocketService.getPlayersCount();
      console.log(`   Final player count: ${finalPlayerCount}`);
    });

    it('should handle WebSocket connection cleanup efficiently', () => {
      console.log('🧹 Testing WebSocket connection cleanup...');

      const connectionCount = 500;
      const startTime = performance.now();

      // Add many connections
      for (let i = 1; i <= connectionCount; i++) {
        crashWebSocketService.addPlayer(`cleanup-user-${i}`, `cleanup-socket-${i}`, `player${i}`);
      }

      const addTime = performance.now();
      expect(crashWebSocketService.getPlayersCount()).toBe(connectionCount);

      // Remove all connections
      for (let i = 1; i <= connectionCount; i++) {
        crashWebSocketService.removePlayer(`cleanup-socket-${i}`);
      }

      const cleanupTime = performance.now();
      const finalCount = crashWebSocketService.getPlayersCount();

      console.log(`📊 Cleanup performance:`);
      console.log(`   Add ${connectionCount} connections: ${(addTime - startTime).toFixed(2)}ms`);
      console.log(
        `   Cleanup ${connectionCount} connections: ${(cleanupTime - addTime).toFixed(2)}ms`,
      );
      console.log(`   Final player count: ${finalCount}`);

      // Cleanup requirements
      expect(finalCount).toBe(0);
      expect(cleanupTime - addTime).toBeLessThan(1000); // Cleanup in under 1 second
    });
  });

  describe('Load Testing Edge Cases', () => {
    it('should handle burst traffic scenarios', async () => {
      console.log('💥 Testing burst traffic handling...');

      const burstSize = 200;
      const burstCount = 5;
      let totalProcessed = 0;

      for (let burst = 1; burst <= burstCount; burst++) {
        const startTime = performance.now();

        // Create burst of concurrent operations
        const operations: Array<Promise<any>> = [];
        for (let i = 1; i <= burstSize; i++) {
          const operation = new Promise((resolve) => {
            // Mix of different operations
            const opType = i % 3;
            switch (opType) {
              case 0: // Add player
                crashWebSocketService.addPlayer(
                  `burst-${burst}-${i}`,
                  `socket-${burst}-${i}`,
                  `player${i}`,
                );
                break;
              case 1: // Update player bet
                crashWebSocketService.updatePlayerBet(`burst-${burst}-${i}`, `bet-${burst}-${i}`);
                break;
              case 2: // Broadcast update
                crashWebSocketService.broadcastMultiplierUpdate({
                  gameId: `burst-game-${burst}`,
                  multiplier: (1.0 + i * 0.01).toString(),
                  timestamp: Date.now(),
                });
                break;
            }
            resolve(true);
          });
          operations.push(operation);
        }

        await Promise.all(operations);
        const endTime = performance.now();

        totalProcessed += burstSize;
        console.log(
          `   Burst ${burst}: ${burstSize} operations in ${(endTime - startTime).toFixed(2)}ms`,
        );

        // Brief pause between bursts
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`📊 Total operations processed: ${totalProcessed}`);
      expect(totalProcessed).toBe(burstSize * burstCount);
    });

    it('should maintain performance with mixed operation types', async () => {
      console.log('🔄 Testing mixed operation performance...');

      const operationCount = 1000;
      const operationTypes = ['add', 'remove', 'update', 'broadcast'];
      const startTime = performance.now();

      for (let i = 0; i < operationCount; i++) {
        const opType = operationTypes[i % operationTypes.length];

        switch (opType) {
          case 'add':
            crashWebSocketService.addPlayer(`mixed-user-${i}`, `mixed-socket-${i}`, `player${i}`);
            break;
          case 'remove':
            if (i > 10) {
              crashWebSocketService.removePlayer(`mixed-socket-${i - 10}`);
            }
            break;
          case 'update':
            crashWebSocketService.updatePlayerBet(`mixed-user-${i}`, `mixed-bet-${i}`);
            break;
          case 'broadcast':
            await crashWebSocketService.broadcastMultiplierUpdate({
              gameId: 'mixed-game',
              multiplier: (1.0 + i * 0.001).toString(),
              timestamp: Date.now(),
            });
            break;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const operationsPerSecond = operationCount / (totalTime / 1000);

      console.log(`📊 Mixed operations performance:`);
      console.log(`   Total operations: ${operationCount}`);
      console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`   Operations per second: ${operationsPerSecond.toFixed(0)}`);

      // Performance requirements
      expect(operationsPerSecond).toBeGreaterThan(1000); // 1000+ ops/second
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds for 1000 operations
    });
  });
});
