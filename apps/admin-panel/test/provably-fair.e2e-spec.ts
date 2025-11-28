import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CurrencyEnum, FiatFormatEnum, PasswordUtil } from '@zetik/common';
import {
  AdminEntity,
  AdminRole,
  AuthStrategyEnum,
  SeedPairEntity,
  UserEntity,
} from '@zetik/shared-entities';
import * as crypto from 'crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AdminPanelModule } from '../src/admin-panel.module';

describe('Provably Fair Admin Endpoints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminRepository: Repository<AdminEntity>;
  let userRepository: Repository<UserEntity>;
  let seedPairRepository: Repository<SeedPairEntity>;

  let superAdminToken: string;
  let regularAdminToken: string;
  let superAdminId: string;
  let regularAdminId: string;
  let testUserId: string;
  let testSeedPairId: number;

  // Helper function to generate valid 64-char hex string
  const generateValidHex = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  // Helper function to hash seed
  const hashSeed = (seed: string): string => {
    return crypto.createHash('sha256').update(seed).digest('hex');
  };

  // Helper function to create test user
  const createTestUser = async (username: string): Promise<UserEntity> => {
    const userId = crypto.randomUUID();

    // Check if user with this username already exists and delete
    const existingUser = await dataSource.query('SELECT id FROM users.users WHERE username = $1', [
      username,
    ]);
    if (existingUser && existingUser.length > 0) {
      await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [
        existingUser[0].id,
      ]);
      await dataSource.query('DELETE FROM users.users WHERE id = $1', [existingUser[0].id]);
    }

    // Use direct query to insert user since entity creation has type issues
    await dataSource.query(
      `INSERT INTO users.users (
        id, username, email, "isEmailVerified", "currentCurrency",
        "currentFiatFormat", "registrationStrategy", "registrationData",
        "isBanned", "isPrivate", "emailMarketing", "streamerMode",
        "excludeFromRain", "hideStatistics", "hideRaceStatistics", "is2FAEnabled"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        userId,
        username,
        `${username}@test.com`,
        false,
        CurrencyEnum.USD,
        FiatFormatEnum.STANDARD,
        AuthStrategyEnum.EMAIL,
        JSON.stringify({ passwordHash: 'test' }),
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        false,
      ],
    );

    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('Failed to create test user');
    }
    return user;
  };

  // Helper function to create test seed pair
  const createTestSeedPair = async (
    userId: string,
    isActive: boolean = true,
    options?: Partial<SeedPairEntity>,
  ): Promise<SeedPairEntity> => {
    const serverSeed = generateValidHex();
    const nextServerSeed = generateValidHex();
    const seedPair = seedPairRepository.create({
      userId,
      serverSeed,
      serverSeedHash: hashSeed(serverSeed),
      nextServerSeed,
      nextServerSeedHash: hashSeed(nextServerSeed),
      clientSeed: 'test_client_seed',
      nonce: '0',
      isActive,
      ...options,
    });
    return await seedPairRepository.save(seedPair);
  };

  // Helper function to create admin and get token
  const createAdminAndGetToken = async (
    email: string,
    name: string,
    role: AdminRole,
  ): Promise<{ token: string; adminId: string }> => {
    // Check if admin already exists and delete it
    const existingAdmin = await adminRepository.findOne({ where: { email } });
    if (existingAdmin) {
      await adminRepository.delete({ id: existingAdmin.id });
    }

    const hashedPassword = await PasswordUtil.hash('Test1234!');
    const admin = adminRepository.create({
      email,
      name,
      password: hashedPassword,
      role,
      isActive: true,
      tokenVersion: 1,
    });
    const savedAdmin = await adminRepository.save(admin);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Test1234!' })
      .expect(200);

    return {
      token: loginResponse.body.accessToken,
      adminId: savedAdmin.id,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AdminPanelModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableCors();

    await app.init();

    // Get repositories
    dataSource = moduleFixture.get<DataSource>(DataSource);
    adminRepository = moduleFixture.get<Repository<AdminEntity>>(getRepositoryToken(AdminEntity));
    userRepository = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    seedPairRepository = moduleFixture.get<Repository<SeedPairEntity>>(
      getRepositoryToken(SeedPairEntity),
    );

    // Create super admin and get token
    const superAdmin = await createAdminAndGetToken(
      'superadmin@test.com',
      'Super Admin',
      AdminRole.SUPER_ADMIN,
    );
    superAdminToken = superAdmin.token;
    superAdminId = superAdmin.adminId;

    // Create regular admin and get token
    const regularAdmin = await createAdminAndGetToken(
      'admin@test.com',
      'Regular Admin',
      AdminRole.ADMIN,
    );
    regularAdminToken = regularAdmin.token;
    regularAdminId = regularAdmin.adminId;

    // Create test user
    const testUser = await createTestUser('testuser');
    testUserId = testUser.id;

    // Create initial test seed pair
    const seedPair = await createTestSeedPair(testUserId);
    testSeedPairId = seedPair.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (dataSource && dataSource.isInitialized) {
      try {
        // Use raw queries for cleanup to avoid entity metadata issues
        await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [testUserId]);
        await dataSource.query('DELETE FROM users.users WHERE id = $1', [testUserId]);
        await dataSource.query('DELETE FROM admin.admin_users WHERE id = $1', [superAdminId]);
        await dataSource.query('DELETE FROM admin.admin_users WHERE id = $1', [regularAdminId]);
      } catch (error) {
        // Ignore cleanup errors
        console.error('Cleanup error:', error);
      }
    }
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when no auth token provided', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs`)
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 403 when regular admin tries to access (not super_admin)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs`)
        .set('Authorization', `Bearer ${regularAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('statusCode', 403);
      expect(response.body).toHaveProperty('message');
    });

    it('should allow super_admin access', async () => {
      await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });
  });

  describe('GET /api/provably-fair/users/:userId/seed-pairs', () => {
    let testUser2Id: string;

    beforeAll(async () => {
      // Create another test user with multiple seed pairs
      const user2 = await createTestUser('testuser2');
      testUser2Id = user2.id;

      // Create 15 seed pairs for pagination testing
      for (let i = 0; i < 15; i++) {
        await createTestSeedPair(testUser2Id, i === 0); // Only first one is active
      }
    });

    afterAll(async () => {
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [testUser2Id]);
          await dataSource.query('DELETE FROM users.users WHERE id = $1', [testUser2Id]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should return paginated list of seed pairs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUser2Id}/seed-pairs`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('seedPairs');
      expect(response.body).toHaveProperty('total', 15);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('hasNext', true);
      expect(Array.isArray(response.body.seedPairs)).toBe(true);
      expect(response.body.seedPairs.length).toBe(10);
    });

    it('should respect pagination parameters (page, limit)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUser2Id}/seed-pairs?page=2&limit=5`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('page', 2);
      expect(response.body).toHaveProperty('limit', 5);
      expect(response.body.seedPairs.length).toBe(5);
    });

    it('should return empty array if user has no seed pairs', async () => {
      const emptyUser = await createTestUser('emptyuser');

      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${emptyUser.id}/seed-pairs`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.seedPairs).toEqual([]);
      expect(response.body.total).toBe(0);

      // Cleanup
      await dataSource.query('DELETE FROM users.users WHERE id = $1', [emptyUser.id]);
    });

    it('should return 404 if user does not exist', async () => {
      const fakeUserId = crypto.randomUUID();
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${fakeUserId}/seed-pairs`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/provably-fair/users/:userId/seed-pairs/active', () => {
    it('should return active seed pair if exists', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs/active`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', testUserId);
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('serverSeed');
      expect(response.body).toHaveProperty('serverSeedHash');
      expect(response.body).toHaveProperty('clientSeed');
      expect(response.body).toHaveProperty('nonce');
    });

    it('should return null if no active seed pair', async () => {
      const userWithoutActive = await createTestUser('noactiveseed');
      await createTestSeedPair(userWithoutActive.id, false); // Inactive seed pair

      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${userWithoutActive.id}/seed-pairs/active`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // API returns empty object {} instead of null for 200 responses with no body
      expect(response.body).toEqual({});

      // Cleanup
      await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [
        userWithoutActive.id,
      ]);
      await dataSource.query('DELETE FROM users.users WHERE id = $1', [userWithoutActive.id]);
    });

    it('should return 404 if user does not exist', async () => {
      const fakeUserId = crypto.randomUUID();
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${fakeUserId}/seed-pairs/active`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/provably-fair/users/:userId/seed-pairs/:seedPairId', () => {
    it('should return specific seed pair by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs/${testSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testSeedPairId.toString());
      expect(response.body).toHaveProperty('userId', testUserId);
      expect(response.body).toHaveProperty('serverSeed');
      expect(response.body).toHaveProperty('serverSeedHash');
      expect(response.body).toHaveProperty('clientSeed');
      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('isActive');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 404 if seed pair does not exist', async () => {
      const fakeSeedPairId = 999999;
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${testUserId}/seed-pairs/${fakeSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if user does not exist', async () => {
      const fakeUserId = crypto.randomUUID();
      const response = await request(app.getHttpServer())
        .get(`/api/provably-fair/users/${fakeUserId}/seed-pairs/${testSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /api/provably-fair/users/:userId/seed-pairs/:seedPairId', () => {
    let updateTestUserId: string;
    let updateTestSeedPairId: number;

    beforeEach(async () => {
      // Create fresh user and seed pair for each update test
      const user = await createTestUser(`updatetest_${Date.now()}`);
      updateTestUserId = user.id;
      const seedPair = await createTestSeedPair(updateTestUserId);
      updateTestSeedPairId = seedPair.id;
    });

    afterEach(async () => {
      // Clean up after each test
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [
            updateTestUserId,
          ]);
          await dataSource.query('DELETE FROM users.users WHERE id = $1', [updateTestUserId]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should update serverSeed and auto-calculate hash', async () => {
      const newServerSeed = generateValidHex();
      const expectedHash = hashSeed(newServerSeed);

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ serverSeed: newServerSeed })
        .expect(200);

      expect(response.body.serverSeed).toBe(newServerSeed);
      expect(response.body.serverSeedHash).toBe(expectedHash);

      // Verify in database
      const updated = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      expect(updated?.serverSeed).toBe(newServerSeed);
      expect(updated?.serverSeedHash).toBe(expectedHash);
    });

    it('should update clientSeed', async () => {
      const newClientSeed = 'my_custom_client_seed_123';

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: newClientSeed })
        .expect(200);

      expect(response.body.clientSeed).toBe(newClientSeed);

      // Verify in database
      const updated = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      expect(updated?.clientSeed).toBe(newClientSeed);
    });

    it('should update nonce', async () => {
      const newNonce = '42';

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ nonce: newNonce })
        .expect(200);

      expect(response.body.nonce).toBe(newNonce);

      // Verify in database
      const updated = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      expect(updated?.nonce).toBe(newNonce);
    });

    it('should update nextServerSeed and auto-calculate hash', async () => {
      const newNextServerSeed = generateValidHex();
      const expectedHash = hashSeed(newNextServerSeed);

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ nextServerSeed: newNextServerSeed })
        .expect(200);

      expect(response.body.nextServerSeed).toBe(newNextServerSeed);
      expect(response.body.nextServerSeedHash).toBe(expectedHash);

      // Verify in database
      const updated = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      expect(updated?.nextServerSeed).toBe(newNextServerSeed);
      expect(updated?.nextServerSeedHash).toBe(expectedHash);
    });

    it('should update multiple fields at once', async () => {
      const newServerSeed = generateValidHex();
      const newClientSeed = 'multi_update_client_seed';
      const newNonce = '100';

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          serverSeed: newServerSeed,
          clientSeed: newClientSeed,
          nonce: newNonce,
        })
        .expect(200);

      expect(response.body.serverSeed).toBe(newServerSeed);
      expect(response.body.serverSeedHash).toBe(hashSeed(newServerSeed));
      expect(response.body.clientSeed).toBe(newClientSeed);
      expect(response.body.nonce).toBe(newNonce);
    });

    it('should reject invalid hex strings (wrong length)', async () => {
      const invalidSeed = 'a'.repeat(32); // Only 32 chars, should be 64

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ serverSeed: invalidSeed })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      // message can be either a string or an array
      const message = Array.isArray(response.body.message)
        ? response.body.message.join(' ')
        : response.body.message;
      expect(message).toContain('64 characters');
    });

    it('should reject invalid hex strings (invalid characters)', async () => {
      const invalidSeed = 'g'.repeat(64); // 'g' is not a valid hex char

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ serverSeed: invalidSeed })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      // message can be either a string or an array
      const message = Array.isArray(response.body.message)
        ? response.body.message.join(' ')
        : response.body.message;
      expect(message).toContain('hexadecimal');
    });

    it('should reject negative nonce', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ nonce: '-1' })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should return 404 if seed pair does not exist', async () => {
      const fakeSeedPairId = 999999;

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${fakeSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 if user does not exist', async () => {
      const fakeUserId = crypto.randomUUID();

      const response = await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${fakeUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });

    it('should use transaction (rollback on error)', async () => {
      // Get current state
      const before = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      const originalClientSeed = before?.clientSeed;

      // Try to update with both valid and invalid data
      // The invalid serverSeed should cause the entire transaction to rollback
      await request(app.getHttpServer())
        .patch(`/api/provably-fair/users/${updateTestUserId}/seed-pairs/${updateTestSeedPairId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          clientSeed: 'should_not_be_saved',
          serverSeed: 'invalid_hex', // This should cause validation error
        })
        .expect(400);

      // Verify that clientSeed was NOT updated (transaction rolled back)
      const after = await seedPairRepository.findOne({ where: { id: updateTestSeedPairId } });
      expect(after?.clientSeed).toBe(originalClientSeed);
    });
  });

  describe('POST /api/provably-fair/users/:userId/seed-pairs/rotate', () => {
    let rotateTestUserId: string;
    let rotateTestSeedPairId: number;

    beforeEach(async () => {
      // Create fresh user and seed pair for each rotate test
      const user = await createTestUser(`rotatetest_${Date.now()}`);
      rotateTestUserId = user.id;
      const seedPair = await createTestSeedPair(rotateTestUserId);
      rotateTestSeedPairId = seedPair.id;
    });

    afterEach(async () => {
      // Clean up after each test
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource.query('DELETE FROM games.seed_pairs WHERE "userId" = $1', [
            rotateTestUserId,
          ]);
          await dataSource.query('DELETE FROM users.users WHERE id = $1', [rotateTestUserId]);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should deactivate old seed pair and create new one', async () => {
      const newClientSeed = 'rotated_client_seed';

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: newClientSeed })
        .expect(201);

      expect(response.body).toHaveProperty('old');
      expect(response.body).toHaveProperty('new');

      // Verify old seed pair is deactivated
      expect(response.body.old.isActive).toBe(false);
      expect(response.body.old.id).toBe(rotateTestSeedPairId.toString());

      // Verify new seed pair is active
      expect(response.body.new.isActive).toBe(true);
      expect(response.body.new.clientSeed).toBe(newClientSeed);
      expect(response.body.new.nonce).toBe('0');

      // Verify in database
      const oldSeedPair = await seedPairRepository.findOne({ where: { id: rotateTestSeedPairId } });
      expect(oldSeedPair?.isActive).toBe(false);

      const newSeedPair = await seedPairRepository.findOne({
        where: { userId: rotateTestUserId, isActive: true },
      });
      expect(newSeedPair).toBeTruthy();
      expect(newSeedPair?.clientSeed).toBe(newClientSeed);
    });

    it('should set revealedAt on old seed pair', async () => {
      const beforeRotate = new Date();

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      const afterRotate = new Date();

      // Verify revealedAt is set and within reasonable time range
      const oldSeedPair = await seedPairRepository.findOne({ where: { id: rotateTestSeedPairId } });
      expect(oldSeedPair?.revealedAt).toBeTruthy();

      if (oldSeedPair?.revealedAt) {
        expect(oldSeedPair.revealedAt.getTime()).toBeGreaterThanOrEqual(beforeRotate.getTime());
        expect(oldSeedPair.revealedAt.getTime()).toBeLessThanOrEqual(afterRotate.getTime());
      }
    });

    it('should reveal nextServerSeed of old seed pair', async () => {
      // Get the original nextServerSeed before rotation
      const before = await seedPairRepository.findOne({ where: { id: rotateTestSeedPairId } });
      const originalNextServerSeed = before?.nextServerSeed;
      const originalNextServerSeedHash = before?.nextServerSeedHash;

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Verify old seed pair now has the nextServerSeed as serverSeed
      expect(response.body.old.serverSeed).toBe(originalNextServerSeed);
      expect(response.body.old.serverSeedHash).toBe(originalNextServerSeedHash);
    });

    it('should generate new server seed and hash', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Verify new seed pair has valid server seed
      expect(response.body.new.serverSeed).toBeTruthy();
      expect(response.body.new.serverSeed).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(response.body.new.serverSeed)).toBe(true);

      // Verify hash is correct
      const expectedHash = hashSeed(response.body.new.serverSeed);
      expect(response.body.new.serverSeedHash).toBe(expectedHash);
    });

    it('should use provided client seed', async () => {
      const customClientSeed = 'my_custom_client_seed_for_rotation';

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: customClientSeed })
        .expect(201);

      expect(response.body.new.clientSeed).toBe(customClientSeed);
    });

    it('should reset nonce to 0', async () => {
      // Set nonce to non-zero value
      await seedPairRepository.update({ id: rotateTestSeedPairId }, { nonce: '100' });

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      expect(response.body.new.nonce).toBe('0');
    });

    it('should return both old and new seed pairs', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Verify old seed pair structure
      expect(response.body.old).toHaveProperty('id');
      expect(response.body.old).toHaveProperty('userId', rotateTestUserId);
      expect(response.body.old).toHaveProperty('serverSeed');
      expect(response.body.old).toHaveProperty('serverSeedHash');
      expect(response.body.old).toHaveProperty('clientSeed');
      expect(response.body.old).toHaveProperty('nonce');
      expect(response.body.old).toHaveProperty('isActive', false);

      // Verify new seed pair structure
      expect(response.body.new).toHaveProperty('id');
      expect(response.body.new).toHaveProperty('userId', rotateTestUserId);
      expect(response.body.new).toHaveProperty('serverSeed');
      expect(response.body.new).toHaveProperty('serverSeedHash');
      expect(response.body.new).toHaveProperty('clientSeed');
      expect(response.body.new).toHaveProperty('nonce', '0');
      expect(response.body.new).toHaveProperty('isActive', true);

      // Verify IDs are different
      expect(response.body.old.id).not.toBe(response.body.new.id);
    });

    it('should generate nextServerSeed for new seed pair', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Verify new seed pair has nextServerSeed
      expect(response.body.new.nextServerSeed).toBeTruthy();
      expect(response.body.new.nextServerSeed).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(response.body.new.nextServerSeed)).toBe(true);

      // Verify nextServerSeedHash is correct
      const expectedHash = hashSeed(response.body.new.nextServerSeed);
      expect(response.body.new.nextServerSeedHash).toBe(expectedHash);

      // Verify nextServerSeed is different from serverSeed
      expect(response.body.new.nextServerSeed).not.toBe(response.body.new.serverSeed);
    });

    it('should return 404 if user does not exist', async () => {
      const fakeUserId = crypto.randomUUID();

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${fakeUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle case when user has no active seed pair', async () => {
      // Deactivate the seed pair
      await seedPairRepository.update({ id: rotateTestSeedPairId }, { isActive: false });

      const response = await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body.message).toContain('No active seed pair');
    });

    it('should ensure only one active seed pair exists after rotation', async () => {
      await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Query database for active seed pairs
      const activeSeedPairs = await seedPairRepository.find({
        where: { userId: rotateTestUserId, isActive: true },
      });

      expect(activeSeedPairs).toHaveLength(1);
    });

    it('should maintain transaction integrity on rotation', async () => {
      // Count seed pairs before rotation
      const countBefore = await seedPairRepository.count({ where: { userId: rotateTestUserId } });

      await request(app.getHttpServer())
        .post(`/api/provably-fair/users/${rotateTestUserId}/seed-pairs/rotate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ clientSeed: 'test' })
        .expect(201);

      // Count seed pairs after rotation (should have one more)
      const countAfter = await seedPairRepository.count({ where: { userId: rotateTestUserId } });
      expect(countAfter).toBe(countBefore + 1);

      // Verify old seed pair still exists but is inactive
      const oldSeedPair = await seedPairRepository.findOne({ where: { id: rotateTestSeedPairId } });
      expect(oldSeedPair).toBeTruthy();
      expect(oldSeedPair?.isActive).toBe(false);
    });
  });
});
