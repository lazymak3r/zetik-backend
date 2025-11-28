import {
  BlackjackGameEntity,
  BlackjackGameStatus,
  MinesGameEntity,
  MinesGameStatus,
  SeedPairEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { BytesToFloatService } from '../src/games/services/bytes-to-float.service';
import { HouseEdgeService } from '../src/games/services/house-edge.service';
import { ProvablyFairService } from '../src/games/services/provably-fair.service';

/**
 * Integration tests for Bug 7 fix: Prevent seed changes during active Mines/Blackjack games
 *
 * Tests verify that:
 * 1. Users cannot rotate seeds while having active Mines games
 * 2. Users cannot rotate seeds while having active Blackjack games
 * 3. Users can rotate seeds when all games are completed/cashed out
 * 4. Error messages are clear and actionable
 */
describe('ProvablyFairService - Active Game Validation (Bug 7)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let provablyFairService: ProvablyFairService;
  let testUser: UserEntity;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT, 10) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'postgres',
          entities: [UserEntity, SeedPairEntity, MinesGameEntity, BlackjackGameEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          SeedPairEntity,
          MinesGameEntity,
          BlackjackGameEntity,
          UserEntity,
        ]),
      ],
      providers: [ProvablyFairService, BytesToFloatService, HouseEdgeService],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    provablyFairService = moduleFixture.get<ProvablyFairService>(ProvablyFairService);

    // Create test user
    const userRepo = dataSource.getRepository(UserEntity);
    testUser = userRepo.create({
      email: `test-bug7-${Date.now()}@example.com`,
      username: `testbug7user${Date.now()}`,
      passwordHash: 'hashed_password',
    });
    testUser = await userRepo.save(testUser);

    // Create initial seed pair
    await provablyFairService.generateSeedPair(testUser.id);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      const seedPairRepo = dataSource.getRepository(SeedPairEntity);
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const userRepo = dataSource.getRepository(UserEntity);

      await minesRepo.delete({ userId: testUser.id });
      await blackjackRepo.delete({ userId: testUser.id });
      await seedPairRepo.delete({ userId: testUser.id });
      await userRepo.delete({ id: testUser.id });
    }

    await app.close();
  });

  afterEach(async () => {
    // Clean up games after each test
    const minesRepo = dataSource.getRepository(MinesGameEntity);
    const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
    await minesRepo.delete({ userId: testUser.id });
    await blackjackRepo.delete({ userId: testUser.id });
  });

  describe('Active Mines Game Validation', () => {
    it('should prevent seed rotation when user has active Mines game', async () => {
      // Create an active Mines game
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const activeMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.ACTIVE,
        gridState: Array(25).fill(false),
        revealedTiles: [],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
      });
      await minesRepo.save(activeMinesGame);

      // Attempt to update client seed should fail
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    });

    it('should allow seed rotation when Mines game is completed', async () => {
      // Create a completed Mines game
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const completedMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.COMPLETED,
        gridState: Array(25).fill(false),
        revealedTiles: [0, 1, 2],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
        payout: '15.00',
      });
      await minesRepo.save(completedMinesGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed');
      expect(result.revealedSeed).toBeTruthy(); // Old seed should be revealed
    });

    it('should allow seed rotation when Mines game is busted', async () => {
      // Create a busted Mines game
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const bustedMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.BUSTED,
        gridState: Array(25).fill(false),
        revealedTiles: [0, 5], // Hit a mine at position 5
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
        payout: '0.00',
      });
      await minesRepo.save(bustedMinesGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-2');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-2');
    });

    it('should allow seed rotation when Mines game is cancelled', async () => {
      // Create a cancelled Mines game
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const cancelledMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.CANCELLED,
        gridState: Array(25).fill(false),
        revealedTiles: [],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
      });
      await minesRepo.save(cancelledMinesGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-3');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-3');
    });
  });

  describe('Active Blackjack Game Validation', () => {
    it('should prevent seed rotation when user has active Blackjack game (ACTIVE status)', async () => {
      // Create an active Blackjack game
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const activeBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.ACTIVE,
        playerHand: [{ suit: 'hearts', value: 'A' }],
        dealerHand: [{ suit: 'spades', value: 'K' }],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(activeBlackjackGame);

      // Attempt to update client seed should fail
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    });

    it('should prevent seed rotation when user has Blackjack game in PLAYER_STAND status', async () => {
      // Create a Blackjack game in player stand status
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const standBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.PLAYER_STAND,
        playerHand: [
          { suit: 'hearts', value: 'K' },
          { suit: 'spades', value: '9' },
        ],
        dealerHand: [{ suit: 'clubs', value: 'A' }],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(standBlackjackGame);

      // Attempt to update client seed should fail
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    });

    it('should prevent seed rotation when user has Blackjack game in DEALER_TURN status', async () => {
      // Create a Blackjack game in dealer turn status
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const dealerTurnGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.DEALER_TURN,
        playerHand: [
          { suit: 'hearts', value: 'K' },
          { suit: 'spades', value: '9' },
        ],
        dealerHand: [
          { suit: 'clubs', value: 'A' },
          { suit: 'diamonds', value: '6' },
        ],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(dealerTurnGame);

      // Attempt to update client seed should fail
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    });

    it('should allow seed rotation when Blackjack game is completed', async () => {
      // Create a completed Blackjack game
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const completedBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.COMPLETED,
        playerHand: [
          { suit: 'hearts', value: 'K' },
          { suit: 'spades', value: 'A' },
        ],
        dealerHand: [
          { suit: 'clubs', value: '10' },
          { suit: 'diamonds', value: '7' },
        ],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
        payout: '40.00',
      });
      await blackjackRepo.save(completedBlackjackGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-4');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-4');
      expect(result.revealedSeed).toBeTruthy(); // Old seed should be revealed
    });

    it('should allow seed rotation when Blackjack game is cancelled', async () => {
      // Create a cancelled Blackjack game
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const cancelledBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.CANCELLED,
        playerHand: [],
        dealerHand: [],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(cancelledBlackjackGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-5');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-5');
    });
  });

  describe('Multiple Active Games Validation', () => {
    it('should prevent seed rotation when user has both active Mines and Blackjack games', async () => {
      // Create both active games
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);

      const activeMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.ACTIVE,
        gridState: Array(25).fill(false),
        revealedTiles: [],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
      });
      await minesRepo.save(activeMinesGame);

      const activeBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.ACTIVE,
        playerHand: [{ suit: 'hearts', value: 'A' }],
        dealerHand: [{ suit: 'spades', value: 'K' }],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(activeBlackjackGame);

      // Attempt to update client seed should fail
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow(
        'Cannot change seeds while you have active games. Please complete or cashout your current games first.',
      );
    });

    it('should allow seed rotation when user has no active games', async () => {
      // No active games created

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-6');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-6');
    });

    it('should allow seed rotation when all games are completed', async () => {
      // Create completed games
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);

      const completedMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.COMPLETED,
        gridState: Array(25).fill(false),
        revealedTiles: [0, 1],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
        payout: '12.00',
      });
      await minesRepo.save(completedMinesGame);

      const completedBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.COMPLETED,
        playerHand: [
          { suit: 'hearts', value: 'K' },
          { suit: 'spades', value: 'A' },
        ],
        dealerHand: [
          { suit: 'clubs', value: '10' },
          { suit: 'diamonds', value: '9' },
        ],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
        payout: '40.00',
      });
      await blackjackRepo.save(completedBlackjackGame);

      // Attempt to update client seed should succeed
      const result = await provablyFairService.updateClientSeed(testUser.id, 'new-client-seed-7');

      expect(result).toBeDefined();
      expect(result.newClientSeed).toBe('new-client-seed-7');
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no seed pair gracefully', async () => {
      // Create new user without seed pair
      const userRepo = dataSource.getRepository(UserEntity);
      const newUser = userRepo.create({
        email: `test-noseed-${Date.now()}@example.com`,
        username: `testnoseeduser${Date.now()}`,
        passwordHash: 'hashed_password',
      });
      const savedUser = await userRepo.save(newUser);

      try {
        // Attempt to update client seed should create initial seed pair
        const result = await provablyFairService.updateClientSeed(savedUser.id, 'first-seed');

        expect(result).toBeDefined();
        expect(result.newClientSeed).toBe('first-seed');
        expect(result.revealedSeed).toBeNull(); // No previous seed to reveal
      } finally {
        // Clean up
        const seedPairRepo = dataSource.getRepository(SeedPairEntity);
        await seedPairRepo.delete({ userId: savedUser.id });
        await userRepo.delete({ id: savedUser.id });
      }
    });

    it('should prevent seed rotation if only checking for Mines but user has active Blackjack', async () => {
      // This test verifies that our validation checks BOTH game types
      const blackjackRepo = dataSource.getRepository(BlackjackGameEntity);
      const activeBlackjackGame = blackjackRepo.create({
        userId: testUser.id,
        betAmount: '20.00',
        status: BlackjackGameStatus.ACTIVE,
        playerHand: [{ suit: 'hearts', value: 'A' }],
        dealerHand: [{ suit: 'spades', value: 'K' }],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: 1,
      });
      await blackjackRepo.save(activeBlackjackGame);

      // Should fail even though no active Mines game
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow('Cannot change seeds while you have active games');
    });

    it('should prevent seed rotation if only checking for Blackjack but user has active Mines', async () => {
      // This test verifies that our validation checks BOTH game types
      const minesRepo = dataSource.getRepository(MinesGameEntity);
      const activeMinesGame = minesRepo.create({
        userId: testUser.id,
        betAmount: '10.00',
        numberOfMines: 5,
        status: MinesGameStatus.ACTIVE,
        gridState: Array(25).fill(false),
        revealedTiles: [],
        clientSeed: 'test-client-seed',
        serverSeed: 'test-server-seed',
        serverSeedHash: 'test-hash',
        nonce: '1',
      });
      await minesRepo.save(activeMinesGame);

      // Should fail even though no active Blackjack game
      await expect(
        provablyFairService.updateClientSeed(testUser.id, 'new-client-seed'),
      ).rejects.toThrow('Cannot change seeds while you have active games');
    });
  });
});
