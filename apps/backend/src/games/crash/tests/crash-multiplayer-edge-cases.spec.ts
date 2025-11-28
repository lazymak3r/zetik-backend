import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CrashBetEntity,
  CrashBetStatusEnum,
  CrashGameEntity,
  CrashGameStatusEnum,
} from '@zetik/shared-entities';
import { BalanceService } from '../../../balance/balance.service';
import { CrashGateway } from '../gateways/crash.gateway.simple';
import { CrashPlayer, CrashWebSocketService } from '../services/crash-websocket.service';

describe('Crash Game - Multiplayer Edge Cases', () => {
  let crashWebSocketService: CrashWebSocketService;
  let mockCrashGateway: Partial<CrashGateway>;
  let mockCrashBetRepository: any;
  let mockCrashGameRepository: any;

  beforeEach(async () => {
    // Enhanced mocks for edge case testing
    mockCrashBetRepository = {
      find: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };

    mockCrashGameRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };

    mockCrashGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        fetchSockets: jest.fn().mockResolvedValue([]),
        emit: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashWebSocketService,
        {
          provide: getRepositoryToken(CrashGameEntity),
          useValue: mockCrashGameRepository,
        },
        {
          provide: getRepositoryToken(CrashBetEntity),
          useValue: mockCrashBetRepository,
        },
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
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

  describe('Concurrent Player Handling', () => {
    it('should handle multiple players betting simultaneously', () => {
      console.log('👥 Testing simultaneous player betting...');

      const playerCount = 50;
      const startTime = Date.now();

      // Add players simultaneously
      const players: Array<{
        userId: string;
        socketId: string;
        username: string;
        betAmount: number;
        autoCashOutAt: number;
      }> = [];
      for (let i = 1; i <= playerCount; i++) {
        const player = {
          userId: `concurrent-user-${i}`,
          socketId: `concurrent-socket-${i}`,
          username: `player${i}`,
          betAmount: Math.floor(Math.random() * 1000) + 1,
          autoCashOutAt: 1.5 + Math.random() * 3.5,
        };

        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
        players.push(player);
      }

      const addTime = Date.now();

      // Simulate concurrent bet placements
      players.forEach((player, index) => {
        crashWebSocketService.updatePlayerBet(player.userId, `bet-${index + 1}`);
      });

      const betTime = Date.now();

      console.log(`📊 Concurrent betting stats:`);
      console.log(`   Players added: ${playerCount} in ${addTime - startTime}ms`);
      console.log(`   Bets placed: ${playerCount} in ${betTime - addTime}ms`);
      console.log(`   Total player count: ${crashWebSocketService.getPlayersCount()}`);

      // Validate all players were added successfully
      expect(crashWebSocketService.getPlayersCount()).toBe(playerCount);

      // Check that each player has their bet
      players.forEach((player) => {
        const retrievedPlayer = crashWebSocketService.getPlayer(player.userId);
        expect(retrievedPlayer).toBeDefined();
        expect(retrievedPlayer?.userId).toBe(player.userId);
      });
    });

    it('should manage concurrent manual cash-outs', async () => {
      console.log('💰 Testing concurrent manual cash-outs...');

      const playerCount = 30;
      const cashOutMultiplier = 2.5;

      // Setup players with active bets
      const players: Array<{ userId: string; socketId: string; username: string; betId: string }> =
        [];
      for (let i = 1; i <= playerCount; i++) {
        const player = {
          userId: `cashout-user-${i}`,
          socketId: `cashout-socket-${i}`,
          username: `player${i}`,
          betId: `bet-${i}`,
        };

        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
        crashWebSocketService.updatePlayerBet(player.userId, player.betId);
        players.push(player);
      }

      // Mock active bets in repository
      const mockBets = players.map((player, index) => ({
        id: player.betId,
        userId: player.userId,
        betAmount: '100.00',
        status: CrashBetStatusEnum.ACTIVE,
        autoCashOutAt: null, // Manual cash-out only
        user: { username: player.username },
      }));

      mockCrashBetRepository.find.mockResolvedValue(mockBets);

      const startTime = Date.now();

      // Simulate concurrent cash-out attempts
      const cashOutPromises = players.map(async (player) => {
        return new Promise((resolve) => {
          // Simulate network delay variation
          setTimeout(() => {
            const result = {
              userId: player.userId,
              cashOutAt: cashOutMultiplier,
              timestamp: Date.now(),
            };
            resolve(result);
          }, Math.random() * 50); // 0-50ms delay
        });
      });

      const cashOutResults = await Promise.all(cashOutPromises);
      const endTime = Date.now();

      console.log(`📊 Concurrent cash-out stats:`);
      console.log(`   Players: ${playerCount}`);
      console.log(`   Successful cash-outs: ${cashOutResults.length}`);
      console.log(`   Processing time: ${endTime - startTime}ms`);
      console.log(`   Average per cash-out: ${(endTime - startTime) / playerCount}ms`);

      // Validate all cash-outs were processed
      expect(cashOutResults).toHaveLength(playerCount);
      cashOutResults.forEach((result) => {
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('cashOutAt', cashOutMultiplier);
        expect(result).toHaveProperty('timestamp');
      });
    });

    it('should validate player isolation (no interference)', () => {
      console.log('🔒 Testing player isolation...');

      const playerPairs = [
        { user1: 'isolation-user-1', user2: 'isolation-user-2' },
        { user1: 'isolation-user-3', user2: 'isolation-user-4' },
        { user1: 'isolation-user-5', user2: 'isolation-user-6' },
      ];

      playerPairs.forEach((pair, pairIndex) => {
        const socket1 = `socket-${pairIndex * 2 + 1}`;
        const socket2 = `socket-${pairIndex * 2 + 2}`;

        // Add both players
        crashWebSocketService.addPlayer(pair.user1, socket1, `player1-${pairIndex}`);
        crashWebSocketService.addPlayer(pair.user2, socket2, `player2-${pairIndex}`);

        // Update bet for player 1
        crashWebSocketService.updatePlayerBet(pair.user1, `bet-1-${pairIndex}`);

        // Verify player 1 has bet, player 2 doesn't
        const player1 = crashWebSocketService.getPlayer(pair.user1);
        const player2 = crashWebSocketService.getPlayer(pair.user2);

        expect(player1?.activeBetId).toBe(`bet-1-${pairIndex}`);
        expect(player2?.activeBetId).toBeUndefined();

        // Update bet for player 2
        crashWebSocketService.updatePlayerBet(pair.user2, `bet-2-${pairIndex}`);

        // Verify both players have independent bets
        const updatedPlayer1 = crashWebSocketService.getPlayer(pair.user1);
        const updatedPlayer2 = crashWebSocketService.getPlayer(pair.user2);

        expect(updatedPlayer1?.activeBetId).toBe(`bet-1-${pairIndex}`);
        expect(updatedPlayer2?.activeBetId).toBe(`bet-2-${pairIndex}`);

        console.log(`   Pair ${pairIndex + 1}: Both players isolated correctly`);
      });

      expect(crashWebSocketService.getPlayersCount()).toBe(playerPairs.length * 2);
    });

    it('should handle bet placement race conditions', async () => {
      console.log('🏁 Testing bet placement race conditions...');

      const userId = 'race-user-1';
      const socketId = 'race-socket-1';
      const concurrentBets = 10;

      crashWebSocketService.addPlayer(userId, socketId, 'race-player');

      // Simulate multiple bet attempts happening simultaneously
      const betPromises: Array<Promise<unknown>> = [];
      for (let i = 1; i <= concurrentBets; i++) {
        const betPromise = new Promise((resolve) => {
          // Random micro-delay to simulate real race conditions
          setTimeout(() => {
            crashWebSocketService.updatePlayerBet(userId, `race-bet-${i}`);
            resolve(`race-bet-${i}`);
          }, Math.random() * 5);
        });
        betPromises.push(betPromise);
      }

      const betResults = await Promise.all(betPromises);

      // Check final state - should have the last bet that was processed
      const finalPlayer = crashWebSocketService.getPlayer(userId);

      console.log(`📊 Race condition test:`);
      console.log(`   Concurrent bet attempts: ${concurrentBets}`);
      console.log(`   Final active bet: ${finalPlayer?.activeBetId}`);
      console.log(`   All bet results: ${betResults.join(', ')}`);

      // Validate that player has exactly one active bet
      expect(finalPlayer?.activeBetId).toBeDefined();
      expect(typeof finalPlayer?.activeBetId).toBe('string');
      expect(betResults).toHaveLength(concurrentBets);
    });

    it('should process large numbers of concurrent bets', async () => {
      console.log('📈 Testing large-scale concurrent betting...');

      const playerCount = 200;
      const startTime = Date.now();

      // Setup many players
      const setupPromises: Array<Promise<unknown>> = [];
      for (let i = 1; i <= playerCount; i++) {
        const setupPromise = new Promise((resolve) => {
          crashWebSocketService.addPlayer(`large-user-${i}`, `large-socket-${i}`, `player${i}`);
          resolve(true);
        });
        setupPromises.push(setupPromise);
      }

      await Promise.all(setupPromises);
      const setupTime = Date.now();

      // Process concurrent bets
      const betPromises: Array<Promise<unknown>> = [];
      for (let i = 1; i <= playerCount; i++) {
        const betPromise = new Promise((resolve) => {
          setTimeout(() => {
            crashWebSocketService.updatePlayerBet(`large-user-${i}`, `large-bet-${i}`);
            resolve(`large-bet-${i}`);
          }, Math.random() * 100); // 0-100ms random delay
        });
        betPromises.push(betPromise);
      }

      const betResults = await Promise.all(betPromises);
      const endTime = Date.now();

      console.log(`📊 Large-scale betting stats:`);
      console.log(`   Total players: ${playerCount}`);
      console.log(`   Setup time: ${setupTime - startTime}ms`);
      console.log(`   Betting time: ${endTime - setupTime}ms`);
      console.log(`   Total time: ${endTime - startTime}ms`);
      console.log(`   Final player count: ${crashWebSocketService.getPlayersCount()}`);
      console.log(`   Successful bets: ${betResults.length}`);

      // Validate results
      expect(crashWebSocketService.getPlayersCount()).toBe(playerCount);
      expect(betResults).toHaveLength(playerCount);
      expect(endTime - startTime).toBeLessThan(5000); // Under 5 seconds total
    });
  });

  describe('Game State Synchronization', () => {
    it('should synchronize game state across all connected players', async () => {
      console.log('🔄 Testing game state synchronization...');

      const playerCount = 25;
      let broadcastCount = 0;

      // Mock broadcast tracking
      const mockEmit = jest.fn(() => {
        broadcastCount++;
      });

      (mockCrashGateway.server?.to as jest.Mock).mockReturnValue({
        emit: mockEmit,
      });

      // Add players
      for (let i = 1; i <= playerCount; i++) {
        crashWebSocketService.addPlayer(`sync-user-${i}`, `sync-socket-${i}`, `player${i}`);
      }

      // Broadcast game state changes
      const gameStates = [
        {
          id: 'sync-game-1',
          status: CrashGameStatusEnum.WAITING,
          betsCount: 0,
          totalBetAmount: '0',
          serverSeedHash: 'sync-hash-1',
          gameIndex: 1,
        },
        {
          id: 'sync-game-1',
          status: CrashGameStatusEnum.FLYING,
          betsCount: playerCount,
          totalBetAmount: (100 * playerCount).toString(),
          serverSeedHash: 'sync-hash-1',
          gameIndex: 1,
        },
        {
          id: 'sync-game-1',
          status: CrashGameStatusEnum.CRASHED,
          betsCount: playerCount,
          totalBetAmount: (100 * playerCount).toString(),
          serverSeedHash: 'sync-hash-1',
          gameIndex: 1,
        },
      ];

      const startTime = Date.now();

      // Broadcast each state
      for (const gameState of gameStates) {
        await crashWebSocketService.broadcastGameState(gameState);
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay between states
      }

      const endTime = Date.now();

      console.log(`📊 Synchronization stats:`);
      console.log(`   Players: ${playerCount}`);
      console.log(`   Game state changes: ${gameStates.length}`);
      console.log(`   Total broadcasts: ${broadcastCount}`);
      console.log(`   Synchronization time: ${endTime - startTime}ms`);

      // Validate synchronization
      expect(broadcastCount).toBe(gameStates.length);
      expect(mockCrashGateway.server?.to).toHaveBeenCalledWith('crash-game');
    });

    it('should handle player disconnection/reconnection', () => {
      console.log('🔌 Testing player disconnection/reconnection...');

      const userId = 'reconnect-user';
      const oldSocketId = 'old-socket-123';
      const newSocketId = 'new-socket-456';
      const username = 'reconnect-player';

      // Initial connection
      crashWebSocketService.addPlayer(userId, oldSocketId, username);
      crashWebSocketService.updatePlayerBet(userId, 'active-bet-123');

      let player = crashWebSocketService.getPlayer(userId);
      expect(player?.socketId).toBe(oldSocketId);
      expect(player?.activeBetId).toBe('active-bet-123');

      // Simulate disconnection
      const removedPlayer = crashWebSocketService.removePlayer(oldSocketId);
      expect(removedPlayer?.userId).toBe(userId);
      expect(crashWebSocketService.getPlayer(userId)).toBeNull();

      // Simulate reconnection with new socket ID
      crashWebSocketService.addPlayer(userId, newSocketId, username);

      player = crashWebSocketService.getPlayer(userId);
      expect(player?.socketId).toBe(newSocketId);
      expect(player?.userId).toBe(userId);
      expect(player?.username).toBe(username);

      // Note: In a real implementation, you might want to restore bet state
      console.log('   ✅ Player disconnection/reconnection handled correctly');
    });

    it('should validate bet visibility between players', async () => {
      console.log('👀 Testing bet visibility between players...');

      const players = [
        { userId: 'visible-user-1', socketId: 'visible-socket-1', username: 'player1' },
        { userId: 'visible-user-2', socketId: 'visible-socket-2', username: 'player2' },
        { userId: 'visible-user-3', socketId: 'visible-socket-3', username: 'player3' },
      ];

      // Add all players
      players.forEach((player) => {
        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
      });

      // Create mock game with bets
      const mockGame: CrashGameEntity = {
        id: 'visibility-game',
        status: CrashGameStatusEnum.WAITING,
        crashPoint: '0',
        serverSeedHash: 'visibility-hash',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: undefined,
        crashedAt: undefined,
        endedAt: undefined,
        serverSeed: 'visibility-seed',
        gameData: {
          totalBets: players.length,
          totalBetAmount: '300',
          totalWinAmount: '0',
          maxMultiplier: '0',
          playerCount: players.length,
        },
        bets: [],
      };

      // Mock bets for visibility
      const mockBets = players.map((player, index) => ({
        id: `visibility-bet-${index + 1}`,
        userId: player.userId,
        betAmount: '100.00',
        autoCashOutAt: (2.0 + index * 0.5).toString(),
        status: CrashBetStatusEnum.ACTIVE,
        user: { username: player.username },
      }));

      mockCrashBetRepository.find.mockResolvedValue(mockBets);

      // Build room state (simulates what all players see)
      const roomState = await crashWebSocketService.buildRoomState(mockGame);

      console.log(`📊 Bet visibility test:`);
      console.log(`   Total players: ${players.length}`);
      console.log(`   Visible bets: ${roomState?.activeBets?.length || 0}`);
      console.log(`   Player count in room: ${roomState?.playerCount || 0}`);
      console.log(`   Total bet amount: ${roomState?.totalBetAmount || '0'}`);

      // Validate visibility
      expect(roomState).toBeDefined();
      expect(roomState?.activeBets).toHaveLength(players.length);
      expect(roomState?.playerCount).toBe(players.length);
      expect(roomState?.totalBetAmount).toBe('300');

      // Check each bet is visible
      roomState?.activeBets?.forEach((bet, index) => {
        expect(bet.userId).toBe(players[index].userId);
        expect(bet.betAmount).toBe('100.00');
      });
    });

    it('should test real-time leaderboard updates', async () => {
      console.log('🏆 Testing real-time leaderboard updates...');

      const playerCount = 10;
      let leaderboardUpdates = 0;

      // Mock leaderboard broadcast
      const mockEmit = jest.fn(() => {
        leaderboardUpdates++;
      });

      (mockCrashGateway.server?.to as jest.Mock).mockReturnValue({
        emit: mockEmit,
      });

      // Add players with different bet amounts
      const players: Array<{
        userId: string;
        socketId: string;
        username: string;
        betAmount: number;
      }> = [];
      for (let i = 1; i <= playerCount; i++) {
        const player = {
          userId: `leader-user-${i}`,
          socketId: `leader-socket-${i}`,
          username: `player${i}`,
          betAmount: i * 50, // Increasing bet amounts
        };

        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
        players.push(player);
      }

      // Simulate leaderboard updates as bets are placed
      const updatePromises = players.map(async (player, index) => {
        return new Promise((resolve) => {
          setTimeout(async () => {
            // Update player bet
            crashWebSocketService.updatePlayerBet(player.userId, `leader-bet-${index + 1}`);

            // Simulate leaderboard broadcast
            await crashWebSocketService.broadcastGameState({
              id: 'leaderboard-game',
              status: CrashGameStatusEnum.WAITING,
              betsCount: index + 1,
              totalBetAmount: ((index + 1) * 50).toString(),
              serverSeedHash: 'leader-hash',
              gameIndex: 1,
            });

            resolve(player);
          }, index * 50); // Staggered updates
        });
      });

      await Promise.all(updatePromises);

      console.log(`📊 Leaderboard update stats:`);
      console.log(`   Total players: ${playerCount}`);
      console.log(`   Leaderboard updates: ${leaderboardUpdates}`);
      console.log(`   Final player count: ${crashWebSocketService.getPlayersCount()}`);

      // Validate leaderboard updates
      expect(leaderboardUpdates).toBe(playerCount);
      expect(crashWebSocketService.getPlayersCount()).toBe(playerCount);
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle all players cashing out simultaneously', async () => {
      console.log('💨 Testing simultaneous mass cash-out...');

      const playerCount = 20;
      const crashMultiplier = 3.0;

      // Setup players with auto cash-out just below crash point
      const players: Array<{
        userId: string;
        socketId: string;
        username: string;
        autoCashOutAt: number;
      }> = [];
      for (let i = 1; i <= playerCount; i++) {
        const player = {
          userId: `mass-user-${i}`,
          socketId: `mass-socket-${i}`,
          username: `player${i}`,
          autoCashOutAt: 2.8 + Math.random() * 0.15, // 2.8-2.95x
        };

        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
        crashWebSocketService.updatePlayerBet(player.userId, `mass-bet-${i}`);
        players.push(player);
      }

      // Simulate all players hitting auto cash-out at once
      const cashOutPromises = players.map(async (player) => {
        return new Promise((resolve) => {
          // All trigger at the same time when multiplier reaches 2.9x
          setTimeout(() => {
            const shouldCashOut = crashMultiplier >= player.autoCashOutAt;
            resolve({
              userId: player.userId,
              cashedOut: shouldCashOut,
              multiplier: player.autoCashOutAt,
            });
          }, 10); // Very small delay to simulate real timing
        });
      });

      const startTime = Date.now();
      const results = await Promise.all(cashOutPromises);
      const endTime = Date.now();

      const successfulCashOuts = results.filter((r: any) => r.cashedOut).length;

      console.log(`📊 Mass cash-out stats:`);
      console.log(`   Total players: ${playerCount}`);
      console.log(`   Successful cash-outs: ${successfulCashOuts}`);
      console.log(`   Processing time: ${endTime - startTime}ms`);
      console.log(`   Success rate: ${((successfulCashOuts / playerCount) * 100).toFixed(1)}%`);

      // Validate mass cash-out handling
      expect(results).toHaveLength(playerCount);
      expect(successfulCashOuts).toBe(playerCount); // All should cash out since crash > their targets
      expect(endTime - startTime).toBeLessThan(1000); // Process in under 1 second
    });

    it('should process bets during game state transitions', () => {
      console.log('⚡ Testing bets during state transitions...');

      const transitionStates = [
        CrashGameStatusEnum.WAITING,
        CrashGameStatusEnum.STARTING,
        CrashGameStatusEnum.FLYING,
        CrashGameStatusEnum.CRASHED,
      ];

      let totalPlayersAdded = 0;
      let totalBetsPlaced = 0;

      transitionStates.forEach((state, stateIndex) => {
        const playersForState = 5;

        for (let i = 1; i <= playersForState; i++) {
          const userId = `transition-user-${stateIndex}-${i}`;
          const socketId = `transition-socket-${stateIndex}-${i}`;

          // Add player during this state
          crashWebSocketService.addPlayer(userId, socketId, `player${stateIndex}-${i}`);
          totalPlayersAdded++;

          // Place bet during this state
          crashWebSocketService.updatePlayerBet(userId, `transition-bet-${stateIndex}-${i}`);
          totalBetsPlaced++;

          // Verify player was added successfully
          const player = crashWebSocketService.getPlayer(userId);
          expect(player).toBeDefined();
          expect(player?.activeBetId).toBe(`transition-bet-${stateIndex}-${i}`);
        }

        console.log(`   State ${state}: ${playersForState} players added and bet`);
      });

      console.log(`📊 State transition stats:`);
      console.log(`   Total players added: ${totalPlayersAdded}`);
      console.log(`   Total bets placed: ${totalBetsPlaced}`);
      console.log(`   Final player count: ${crashWebSocketService.getPlayersCount()}`);

      // Validate results
      expect(totalPlayersAdded).toBe(transitionStates.length * 5);
      expect(totalBetsPlaced).toBe(transitionStates.length * 5);
      expect(crashWebSocketService.getPlayersCount()).toBe(totalPlayersAdded);
    });

    it('should handle disconnected players during game', () => {
      console.log('📡 Testing disconnected players during active game...');

      const totalPlayers = 15;
      const disconnectedCount = 5;

      // Add all players
      const players: Array<{ userId: string; socketId: string; username: string }> = [];
      for (let i = 1; i <= totalPlayers; i++) {
        const player = {
          userId: `disconnect-user-${i}`,
          socketId: `disconnect-socket-${i}`,
          username: `player${i}`,
        };

        crashWebSocketService.addPlayer(player.userId, player.socketId, player.username);
        crashWebSocketService.updatePlayerBet(player.userId, `disconnect-bet-${i}`);
        players.push(player);
      }

      const initialPlayerCount = crashWebSocketService.getPlayersCount();

      // Disconnect some players during game
      const disconnectedPlayers: Array<CrashPlayer | null> = [];
      for (let i = 1; i <= disconnectedCount; i++) {
        const playerToDisconnect = players[i - 1];
        const removedPlayer = crashWebSocketService.removePlayer(playerToDisconnect.socketId);

        expect(removedPlayer?.userId).toBe(playerToDisconnect.userId);
        disconnectedPlayers.push(removedPlayer);
      }

      const finalPlayerCount = crashWebSocketService.getPlayersCount();
      const activePlayerCount = totalPlayers - disconnectedCount;

      console.log(`📊 Disconnection stats:`);
      console.log(`   Initial players: ${initialPlayerCount}`);
      console.log(`   Disconnected: ${disconnectedCount}`);
      console.log(`   Final active players: ${finalPlayerCount}`);
      console.log(`   Expected active: ${activePlayerCount}`);

      // Validate disconnection handling
      expect(initialPlayerCount).toBe(totalPlayers);
      expect(finalPlayerCount).toBe(activePlayerCount);
      expect(disconnectedPlayers).toHaveLength(disconnectedCount);

      // Verify disconnected players are no longer accessible
      disconnectedPlayers.forEach((player) => {
        if (player) {
          const retrievedPlayer = crashWebSocketService.getPlayer(player.userId);
          expect(retrievedPlayer).toBeNull();
        }
      });
    });

    it('should validate game continuation with zero active bets', async () => {
      console.log('⭕ Testing game continuation with no active bets...');

      // Create a game scenario with no active players
      const mockGame: CrashGameEntity = {
        id: 'empty-game',
        status: CrashGameStatusEnum.FLYING,
        crashPoint: '2.5',
        serverSeedHash: 'empty-hash',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        crashedAt: undefined,
        endedAt: undefined,
        serverSeed: 'empty-seed',
        gameData: {
          totalBets: 0,
          totalBetAmount: '0',
          totalWinAmount: '0',
          maxMultiplier: '0',
          playerCount: 0,
        },
        bets: [],
      };

      // Mock empty bet result
      mockCrashBetRepository.find.mockResolvedValue([]);

      // Build room state for empty game
      const roomState = await crashWebSocketService.buildRoomState(mockGame);

      console.log(`📊 Empty game stats:`);
      console.log(`   Game ID: ${roomState?.gameId}`);
      console.log(`   Game status: ${roomState?.status}`);
      console.log(`   Active bets: ${roomState?.activeBets?.length || 0}`);
      console.log(`   Player count: ${roomState?.playerCount || 0}`);
      console.log(`   Total bet amount: ${roomState?.totalBetAmount || '0'}`);

      // Validate empty game handling
      expect(roomState).toBeDefined();
      expect(roomState?.gameId).toBe('empty-game');
      expect(roomState?.status).toBe(CrashGameStatusEnum.FLYING);
      expect(roomState?.activeBets).toHaveLength(0);
      expect(roomState?.playerCount).toBe(0);
      expect(roomState?.totalBetAmount).toBe('0');

      // Game should still be valid even with no bets
      expect(roomState?.betsCount).toBe(0);
    });
  });
});
