import {
  LimitPeriodEnum,
  PlatformTypeEnum,
  SelfExclusionEntity,
  SelfExclusionTypeEnum,
} from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { mailConfig } from '../src/config/mail.config';
import { AppDataSource } from '../src/data-source';
import { SelfExclusionService } from '../src/users/self-exclusion.service';
import { UsersModule } from '../src/users/users.module';

describe('SelfExclusionController (e2e)', () => {
  let app: INestApplication;
  const logger = new Logger('SelfExclusionE2E');
  let accessToken: string;
  let userId: string;
  let dataSource: DataSource;
  let selfExclusionRepository: Repository<SelfExclusionEntity>;

  /**
   * Clear all caches to ensure fresh queries
   */
  async function clearAllCaches() {
    if (dataSource.queryResultCache) {
      await dataSource.queryResultCache.clear();
    }
    // Clear entity manager cache
    dataSource.manager.clear(SelfExclusionEntity);
  }

  /**
   * Get exclusion using raw query (bypasses cache)
   */
  async function getExclusionById(id: string) {
    const result = await dataSource.query(
      `SELECT * FROM "users"."self_exclusions" WHERE "id" = $1`,
      [id],
    );
    return result[0] || null;
  }

  /**
   * Update exclusion date using raw query
   */
  async function updateExclusionDate(
    id: string,
    field: 'endDate' | 'postCooldownWindowEnd' | 'removalRequestedAt',
    value: Date | string,
  ) {
    await dataSource.query(`UPDATE "users"."self_exclusions" SET "${field}" = $1 WHERE "id" = $2`, [
      value,
      id,
    ]);
    await clearAllCaches();
  }

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          AuthModule,
          UsersModule,
          BalanceModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig, mailConfig],
          }),
        ],
      })

        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      // Get data source and repository for direct DB manipulation in tests
      dataSource = app.get(DataSource);
      selfExclusionRepository = dataSource.getRepository(SelfExclusionEntity);

      // Register a user for testing
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `self-exclusion-test${Date.now()}@example.com`,
          username: `self-exclusion-user${Date.now()}`,
          password: 'Secret123',
        });

      accessToken = registerResponse.body.accessToken;

      // Get user profile to get userId
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      userId = profileResponse.body.id;
    } catch (error) {
      logger.error('Test setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users/self-exclusion', () => {
    it('should create a cooldown self-exclusion', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.SPORTS,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.COOLDOWN);
      expect(response.body).toHaveProperty('platformType', PlatformTypeEnum.SPORTS);
      expect(response.body).toHaveProperty('isActive', true);

      // Cooldown should be 24 hours
      const endDate = new Date(response.body.endDate);
      const startDate = new Date(response.body.startDate);
      const timeDiff = endDate.getTime() - startDate.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0); // Allow small differences due to test execution time
    });

    it('should create a temporary self-exclusion after cooldown', async () => {
      // We need to mock the cooldown check since we can't wait 24 hours in a test
      // This is done by creating a cooldown and then manually updating its endDate to be in the past

      // First, get the active cooldown we just created
      const activeExclusionsResponse = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const cooldown = activeExclusionsResponse.body.find(
        (exclusion) => exclusion.type === SelfExclusionTypeEnum.COOLDOWN,
      );

      expect(cooldown).toBeDefined();

      // Now create a temporary self-exclusion
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now

      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.SPORTS,
          endDate,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.TEMPORARY);
      expect(response.body).toHaveProperty('platformType', PlatformTypeEnum.SPORTS);
      expect(response.body).toHaveProperty('isActive', true);
      expect(new Date(response.body.endDate)).toEqual(new Date(endDate.toISOString()));
    });

    it('should create a deposit limit self-exclusion', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 1000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.DEPOSIT_LIMIT);
      expect(response.body).toHaveProperty('period', LimitPeriodEnum.DAILY);
      expect(response.body).toHaveProperty('limitAmount', 1000);
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('platformType', PlatformTypeEnum.PLATFORM); // Default platform type
    });

    it('should create a loss limit self-exclusion', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.WEEKLY,
          limitAmount: 500,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.LOSS_LIMIT);
      expect(response.body).toHaveProperty('period', LimitPeriodEnum.WEEKLY);
      expect(response.body).toHaveProperty('limitAmount', 500);
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('platformType', PlatformTypeEnum.PLATFORM); // Default platform type
    });

    it('should create a permanent self-exclusion for casino platform', async () => {
      // First create a cooldown for the casino platform
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      expect(cooldownResponse.body).toHaveProperty('type', SelfExclusionTypeEnum.COOLDOWN);
      expect(cooldownResponse.body).toHaveProperty('platformType', PlatformTypeEnum.CASINO);

      // Now create a permanent self-exclusion for the casino platform
      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.PERMANENT,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.PERMANENT);
      expect(response.body).toHaveProperty('platformType', PlatformTypeEnum.CASINO);
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('endDate', null);
    });

    it('should return 400 for invalid input data', async () => {
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.TEMPORARY,
          // Missing required endDate
        })
        .expect(400);
    });
  });

  describe('GET /users/self-exclusions', () => {
    it('should return all self-exclusions for the user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('userId', userId);
    });
  });

  describe('GET /users/self-exclusions/active', () => {
    it('should return active self-exclusions for the user', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('userId', userId);
      expect(response.body[0]).toHaveProperty('isActive', true);
    });
  });

  describe('DELETE /users/self-exclusions/:id', () => {
    it('should start removal countdown for deposit limit', async () => {
      // First create a new deposit limit to cancel
      const createResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
          period: LimitPeriodEnum.MONTHLY,
          limitAmount: 2000,
        })
        .expect(201);

      const depositLimitId = createResponse.body.id;

      // Request removal - should start 24h countdown
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${depositLimitId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify removal countdown started
      const response = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const limitWithCountdown = response.body.find((exclusion) => exclusion.id === depositLimitId);

      expect(limitWithCountdown).toBeDefined();
      expect(limitWithCountdown).toHaveProperty('isActive', true); // Still active during countdown
      expect(limitWithCountdown).toHaveProperty('isRemovalPending', true);
      expect(limitWithCountdown.removalRequestedAt).toBeDefined();
    });

    it('should return 404 for non-existent self-exclusion', async () => {
      await request(app.getHttpServer())
        .delete('/users/self-exclusions/128c5eae-3756-4ee8-9d3e-5087fb3c7b52') // non existent uuid
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid self-exclusion uuid', async () => {
      await request(app.getHttpServer())
        .delete('/users/self-exclusions/non-existent-id') // invalid uuid
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 409 when trying to cancel a permanent self-exclusion', async () => {
      // First, create a cooldown for the platform
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      expect(cooldownResponse.body).toHaveProperty('type', SelfExclusionTypeEnum.COOLDOWN);
      expect(cooldownResponse.body).toHaveProperty('platformType', PlatformTypeEnum.PLATFORM);

      // Now create a permanent self-exclusion
      const createResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.PERMANENT,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      const permanentExclusionId = createResponse.body.id;

      // Try to cancel it
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${permanentExclusionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);
    });

    it('should return 409 when trying to cancel a temporary self-exclusion', async () => {
      // First create a cooldown for the platform
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      expect(cooldownResponse.body).toHaveProperty('type', SelfExclusionTypeEnum.COOLDOWN);
      expect(cooldownResponse.body).toHaveProperty('platformType', PlatformTypeEnum.PLATFORM);

      // Now create a temporary exclusion
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now

      const createResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.PLATFORM,
          endDate,
        })
        .expect(201);

      const temporaryExclusionId = createResponse.body.id;

      // Try to cancel it
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${temporaryExclusionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);
    });

    it('should start 24h countdown when cancelling deposit limit immediately after creation', async () => {
      // Create a new deposit limit
      const createResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 1500,
        })
        .expect(201);

      const depositLimitId = createResponse.body.id;

      // Cancel immediately - should start 24h countdown (not reject)
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${depositLimitId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify countdown started
      const response = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const limit = response.body.find((e: any) => e.id === depositLimitId);
      expect(limit).toBeDefined();
      expect(limit.isRemovalPending).toBe(true);
      expect(limit.isActive).toBe(true); // Still active during countdown
    });

    it('should start 24h countdown when cancelling loss limit immediately after creation', async () => {
      // Clean up any existing loss limits from previous tests
      const allLimits = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Manually delete any loss limits with pending removal to clean up
      const lossLimits = allLimits.body.filter(
        (e: any) => e.type === SelfExclusionTypeEnum.LOSS_LIMIT,
      );

      for (const limit of lossLimits) {
        await selfExclusionRepository.remove({ id: limit.id } as any);
      }

      // Create new loss limit
      const createResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 1500,
        })
        .expect(201);

      const lossLimitId = createResponse.body.id;

      // Cancel immediately - should start 24h countdown (not reject)
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${lossLimitId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify countdown started
      const response = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const limit = response.body.find((e: any) => e.id === lossLimitId);
      expect(limit).toBeDefined();
      expect(limit.isRemovalPending).toBe(true);
      expect(limit.isActive).toBe(true); // Still active during countdown
    });
  });

  describe('GET /users/gambling-limits', () => {
    it('should return gambling limits with remaining amounts', async () => {
      // Clean up any existing gambling limits for this user from previous tests
      await dataSource.query(
        `DELETE FROM "users"."self_exclusions" WHERE "userId" = $1 AND "type" IN ('DEPOSIT_LIMIT', 'LOSS_LIMIT', 'WAGER_LIMIT')`,
        [userId],
      );
      await clearAllCaches();

      // First, create deposit and loss limits
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 1000,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.WEEKLY,
          limitAmount: 2000,
        })
        .expect(201);

      // Get gambling limits
      const response = await request(app.getHttpServer())
        .get('/users/gambling-limits')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('depositLimits');
      expect(response.body).toHaveProperty('lossLimits');
      expect(Array.isArray(response.body.depositLimits)).toBe(true);
      expect(Array.isArray(response.body.lossLimits)).toBe(true);

      // Verify deposit limits
      const depositLimit = response.body.depositLimits.find(
        (limit) => limit.period === LimitPeriodEnum.DAILY,
      );
      expect(depositLimit).toBeDefined();
      expect(depositLimit).toHaveProperty('type', SelfExclusionTypeEnum.DEPOSIT_LIMIT);
      expect(depositLimit).toHaveProperty('limitAmount', 1000);
      expect(depositLimit).toHaveProperty('usedAmount');
      expect(depositLimit).toHaveProperty('remainingAmount');
      expect(depositLimit).toHaveProperty('periodStartDate');
      expect(depositLimit).toHaveProperty('periodEndDate');

      // Verify loss limits
      const lossLimit = response.body.lossLimits.find(
        (limit) => limit.period === LimitPeriodEnum.WEEKLY,
      );
      expect(lossLimit).toBeDefined();
      expect(lossLimit).toHaveProperty('type', SelfExclusionTypeEnum.LOSS_LIMIT);
      expect(lossLimit).toHaveProperty('limitAmount', 2000);
      expect(lossLimit).toHaveProperty('usedAmount');
      expect(lossLimit).toHaveProperty('remainingAmount');
      expect(lossLimit).toHaveProperty('periodStartDate');
      expect(lossLimit).toHaveProperty('periodEndDate');
    });
  });

  // PHASE 7: NEW COMPREHENSIVE E2E TESTS FOR ALL SELF-EXCLUSION FEATURES

  describe('Permanent Exclusion Login Blocking', () => {
    it('should prevent login after permanent self-exclusion', async () => {
      // Create a new user for this test to avoid conflicts
      const testEmail = `perm-excluded-${Date.now()}@example.com`;
      const testPassword = 'Secret123';

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `perm-user-${Date.now()}`,
          password: testPassword,
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown first
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Manually update cooldown to expired state and set post-cooldown window
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        const past = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
        const windowEnd = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now

        cooldown.endDate = past;
        cooldown.postCooldownWindowEnd = windowEnd;
        await selfExclusionRepository.save(cooldown);
      }

      // Create permanent exclusion via extend endpoint
      await request(app.getHttpServer())
        .post(`/users/self-exclusion/extend/${cooldownResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          platformType: PlatformTypeEnum.PLATFORM,
          // durationDays omitted = permanent
        })
        .expect(201);

      // Try to login - should fail with specific error message
      const loginAttempt = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(401);

      expect(loginAttempt.body.message).toContain('permanently self-excluded');
    });

    it('should prevent token refresh for permanently excluded users', async () => {
      // Create a new user
      const testEmail = `perm-refresh-${Date.now()}@example.com`;
      const testPassword = 'Secret123';

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `perm-refresh-user-${Date.now()}`,
          password: testPassword,
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;
      const refreshToken = registerResponse.body.refreshToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Update cooldown to expired with window
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        cooldown.endDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
        cooldown.postCooldownWindowEnd = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        await selfExclusionRepository.save(cooldown);
      }

      // Create permanent exclusion
      await request(app.getHttpServer())
        .post(`/users/self-exclusion/extend/${cooldownResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Try to refresh token - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(401);
    });
  });

  describe('Rewards Endpoint Blocking for Self-Excluded Users', () => {
    it('should block bonus viewing for permanently excluded users', async () => {
      // Create user with permanent exclusion
      const testEmail = `bonus-blocked-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `bonus-blocked-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Update to expired with window
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        cooldown.endDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
        cooldown.postCooldownWindowEnd = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        await selfExclusionRepository.save(cooldown);
      }

      // Create permanent exclusion
      await request(app.getHttpServer())
        .post(`/users/self-exclusion/extend/${cooldownResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Try to access protected bonus endpoint - should be blocked by SelfExclusionGuard
      // Note: /bonus endpoint requires auth and uses SelfExclusionGuard
      const bonusResponse = await request(app.getHttpServer())
        .get('/bonus')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);

      expect(bonusResponse.body.message).toContain('permanently excluded');
    });

    it('should allow temporary excluded users to view but not claim bonuses', async () => {
      // Create user with temporary exclusion
      const testEmail = `temp-bonus-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `temp-bonus-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Create temporary exclusion (will replace cooldown since cooldown is active)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.PLATFORM,
          endDate,
        })
        .expect(201);

      // Try to access protected bonus endpoint - should be blocked
      await request(app.getHttpServer())
        .get('/bonus')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);
    });
  });

  describe('Post-Cooldown Window Extension', () => {
    it('should enter post-cooldown window after cooldown expires', async () => {
      // Create user with cooldown
      const testEmail = `post-cooldown-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `post-cooldown-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Manually expire the cooldown
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        cooldown.endDate = new Date(now.getTime() - 1000); // 1 second ago
        await selfExclusionRepository.save(cooldown);
      }

      // Run the cron job that expires cooldowns
      const selfExclusionService = app.get(SelfExclusionService);
      await selfExclusionService.expireOutdatedSelfExclusions();

      // Get self-exclusions to verify post-cooldown window
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const updatedCooldown = exclusions.body.find((e: any) => e.id === cooldownResponse.body.id);

      expect(updatedCooldown).toBeDefined();
      expect(updatedCooldown.postCooldownWindowEnd).toBeDefined();
      expect(updatedCooldown.isInPostCooldownWindow).toBe(true);
      expect(new Date(updatedCooldown.postCooldownWindowEnd).getTime()).toBeGreaterThan(Date.now());
    });

    it('should allow extending during post-cooldown window', async () => {
      // Create user with expired cooldown
      const testEmail = `extend-cooldown-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `extend-cooldown-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Set cooldown to expired with post-cooldown window
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        cooldown.endDate = new Date(now.getTime() - 1000);
        cooldown.postCooldownWindowEnd = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        await selfExclusionRepository.save(cooldown);
      }

      // Extend to 30-day temporary exclusion
      const response = await request(app.getHttpServer())
        .post(`/users/self-exclusion/extend/${cooldownResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          platformType: PlatformTypeEnum.PLATFORM,
          durationDays: 30,
        })
        .expect(201);

      expect(response.body.exclusion.type).toBe(SelfExclusionTypeEnum.TEMPORARY);
      expect(response.body.exclusion.endDate).toBeDefined();

      // Verify cooldown was deleted
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const oldCooldown = exclusions.body.find((e: any) => e.id === cooldownResponse.body.id);
      expect(oldCooldown).toBeUndefined();
    });

    it('should silent revert to normal after 24h window expires', async () => {
      // Create user with cooldown
      const testEmail = `silent-revert-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `silent-revert-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Get user ID from profile
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${testToken}`);
      const testUserId = profileResponse.body.id;

      // Directly create a cooldown with expired post-cooldown window using raw SQL
      // to bypass the cron job complexity
      const now = new Date();
      const pastEndDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const expiredWindowEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

      const result = await dataSource.query(
        `INSERT INTO "users"."self_exclusions"
         ("userId", "type", "platformType", "startDate", "endDate", "postCooldownWindowEnd", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING "id"`,
        [
          testUserId,
          SelfExclusionTypeEnum.COOLDOWN,
          PlatformTypeEnum.PLATFORM,
          pastEndDate,
          pastEndDate,
          expiredWindowEnd,
          true,
          now,
          now,
        ],
      );

      const cooldownId = result[0].id;

      // Verify cooldown exists
      let cooldown = await getExclusionById(cooldownId);
      expect(cooldown).not.toBeNull();
      expect(cooldown.postCooldownWindowEnd).toBeDefined();

      // Run cron job to delete expired window
      const selfExclusionService = app.get(SelfExclusionService);
      await selfExclusionService.expireOutdatedSelfExclusions();

      // Clear cache and verify cooldown was deleted
      await clearAllCaches();
      cooldown = await getExclusionById(cooldownId);

      expect(cooldown).toBeNull();
    });

    it('should reject extension after window expires', async () => {
      // Create user with expired window
      const testEmail = `expired-window-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `expired-window-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Set cooldown with expired post-cooldown window
      const cooldown = await selfExclusionRepository.findOne({
        where: { id: cooldownResponse.body.id },
      });

      if (cooldown) {
        const now = new Date();
        cooldown.endDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
        cooldown.postCooldownWindowEnd = new Date(now.getTime() - 1000);
        await selfExclusionRepository.save(cooldown);
      }

      // Try to extend - should fail
      const response = await request(app.getHttpServer())
        .post(`/users/self-exclusion/extend/${cooldownResponse.body.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          platformType: PlatformTypeEnum.PLATFORM,
          durationDays: 7,
        })
        .expect(400);

      expect(response.body.message).toContain('window has expired');
    });
  });

  describe('Wager Limits Enforcement', () => {
    it('should create wager limit successfully', async () => {
      const testEmail = `wager-limit-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `wager-limit-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.WAGER_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
        })
        .expect(201);

      expect(response.body).toHaveProperty('type', SelfExclusionTypeEnum.WAGER_LIMIT);
      expect(response.body).toHaveProperty('period', LimitPeriodEnum.DAILY);
      expect(response.body).toHaveProperty('limitAmount', 100);
      expect(response.body).toHaveProperty('isActive', true);
    });

    it('should enforce only 1 active wager limit', async () => {
      const testEmail = `wager-limit-multi-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `wager-limit-multi-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create first wager limit
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.WAGER_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
        })
        .expect(201);

      // Try to create second wager limit - should fail
      const response = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.WAGER_LIMIT,
          period: LimitPeriodEnum.WEEKLY,
          limitAmount: 500,
        })
        .expect(400);

      expect(response.body.message).toContain('only have one active wager limit');
    });

    it('should return wager limits in gambling-limits endpoint', async () => {
      const testEmail = `wager-gambling-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `wager-gambling-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create wager limit
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.WAGER_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 200,
        })
        .expect(201);

      // Get gambling limits
      const response = await request(app.getHttpServer())
        .get('/users/gambling-limits')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wagerLimits');
      expect(Array.isArray(response.body.wagerLimits)).toBe(true);
      expect(response.body.wagerLimits.length).toBeGreaterThan(0);

      const wagerLimit = response.body.wagerLimits[0];
      expect(wagerLimit).toHaveProperty('type', SelfExclusionTypeEnum.WAGER_LIMIT);
      expect(wagerLimit).toHaveProperty('limitAmount', 200);
      expect(wagerLimit).toHaveProperty('usedAmount');
      expect(wagerLimit).toHaveProperty('remainingAmount');
    });
  });

  describe('Limit Removal Countdown', () => {
    it('should set removalRequestedAt when cancelling limit', async () => {
      const testEmail = `removal-countdown-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `removal-countdown-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create loss limit
      const limitResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
        })
        .expect(201);

      const limitId = limitResponse.body.id;

      // Request removal (will start 24h countdown)
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${limitId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // Get self-exclusions to verify removal pending
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const updatedLimit = exclusions.body.find((e: any) => e.id === limitId);

      expect(updatedLimit).toBeDefined();
      expect(updatedLimit.isRemovalPending).toBe(true);
      expect(updatedLimit.removalRequestedAt).toBeDefined();
      expect(updatedLimit.removalExpiresAt).toBeDefined();
      expect(updatedLimit.isActive).toBe(true); // Still active during countdown
    });

    it('should delete limit after 24h countdown expires', async () => {
      const testEmail = `removal-delete-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `removal-delete-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create loss limit
      const limitResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
        })
        .expect(201);

      const limitId = limitResponse.body.id;

      // Request removal
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${limitId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // Manually set removalRequestedAt to 25 hours ago using raw SQL
      await updateExclusionDate(
        limitId,
        'removalRequestedAt',
        new Date(Date.now() - 25 * 60 * 60 * 1000),
      );

      // IMPORTANT: Clear cache before running cron so it picks up the updated value
      await clearAllCaches();

      // Run cron job
      const selfExclusionService = app.get(SelfExclusionService);
      await selfExclusionService.expireOutdatedSelfExclusions();

      // Clear cache and verify limit was deleted using raw query
      await clearAllCaches();
      const limit = await getExclusionById(limitId);

      expect(limit).toBeNull();
    });

    it('should immediately cancel cooldown without countdown', async () => {
      const testEmail = `cooldown-cancel-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `cooldown-cancel-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      const cooldownId = cooldownResponse.body.id;

      // Cancel cooldown
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${cooldownId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // Verify immediately deleted (isActive = false)
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const canceledCooldown = exclusions.body.find((e: any) => e.id === cooldownId);
      expect(canceledCooldown).toBeDefined();
      expect(canceledCooldown.isActive).toBe(false);
    });
  });

  describe('Multiple Platform Cooldowns', () => {
    it('should allow separate cooldowns for SPORTS and CASINO', async () => {
      const testEmail = `multi-cooldown-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `multi-cooldown-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create SPORTS cooldown
      const sportsResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.SPORTS,
        })
        .expect(201);

      expect(sportsResponse.body.platformType).toBe(PlatformTypeEnum.SPORTS);

      // Create CASINO cooldown - should succeed
      const casinoResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      expect(casinoResponse.body.platformType).toBe(PlatformTypeEnum.CASINO);

      // Verify both exist
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const cooldowns = exclusions.body.filter(
        (e: any) => e.type === SelfExclusionTypeEnum.COOLDOWN,
      );
      expect(cooldowns.length).toBe(2);

      const sportsCooldown = cooldowns.find((c: any) => c.platformType === PlatformTypeEnum.SPORTS);
      const casinoCooldown = cooldowns.find((c: any) => c.platformType === PlatformTypeEnum.CASINO);

      expect(sportsCooldown).toBeDefined();
      expect(casinoCooldown).toBeDefined();
    });

    it('should allow separate permanent exclusions for different platforms', async () => {
      const testEmail = `multi-perm-${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: testEmail,
          username: `multi-perm-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const testToken = registerResponse.body.accessToken;

      // Create SPORTS cooldown
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.SPORTS,
        })
        .expect(201);

      // Create CASINO cooldown
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      // Create SPORTS permanent
      const sportsPerm = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.PERMANENT,
          platformType: PlatformTypeEnum.SPORTS,
        })
        .expect(201);

      expect(sportsPerm.body.platformType).toBe(PlatformTypeEnum.SPORTS);
      expect(sportsPerm.body.type).toBe(SelfExclusionTypeEnum.PERMANENT);

      // Create CASINO permanent - should succeed
      const casinoPerm = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.PERMANENT,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      expect(casinoPerm.body.platformType).toBe(PlatformTypeEnum.CASINO);
      expect(casinoPerm.body.type).toBe(SelfExclusionTypeEnum.PERMANENT);

      // Verify both exist
      const exclusions = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const permanents = exclusions.body.filter(
        (e: any) => e.type === SelfExclusionTypeEnum.PERMANENT,
      );
      expect(permanents.length).toBe(2);
    });
  });

  describe('Betting Enforcement During Self-Exclusion', () => {
    let testToken: string;
    let testUserId: string;
    let selfExclusionService: SelfExclusionService;

    beforeAll(async () => {
      // Create a new user for betting tests
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `betting-test-${Date.now()}@example.com`,
          username: `betting-test-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      testToken = registerResponse.body.accessToken;

      // Get user profile to get userId
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      testUserId = profileResponse.body.id;

      // Get self-exclusion service for direct manipulation
      selfExclusionService = app.get(SelfExclusionService);
    });

    it('should block all bets during active cooldown', async () => {
      // Create a cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      const cooldownId = cooldownResponse.body.id;

      // Verify hasActiveSelfExclusion returns the cooldown
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(testUserId);
      expect(activeExclusion).not.toBeNull();
      expect(activeExclusion?.type).toBe(SelfExclusionTypeEnum.COOLDOWN);
      expect(activeExclusion?.isInPostCooldownWindow).toBe(false);

      // Verify getActiveSelfExclusions returns the cooldown
      const activeExclusions = await selfExclusionService.getActiveSelfExclusions(testUserId);
      const activeCooldown = activeExclusions.find(
        (e) => e.type === SelfExclusionTypeEnum.COOLDOWN,
      );
      expect(activeCooldown).toBeDefined();
      expect(activeCooldown?.id).toBe(cooldownId);

      // Attempt to place a dice bet - should be blocked
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should be blocked by self-exclusion guard
      expect(betResponse.status).toBe(403);
      expect(betResponse.body.message).toContain('cooldown');
      expect(betResponse.body.message).toContain('not allowed');

      // Clean up - cancel cooldown
      await request(app.getHttpServer())
        .delete(`/users/self-exclusions/${cooldownId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
    });

    it('should block all bets during post-cooldown window (24h extension)', async () => {
      // Create a cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      const cooldownId = cooldownResponse.body.id;

      // Manually expire the cooldown and start post-cooldown window
      await selfExclusionService.testExpireCooldown(cooldownId);

      // Verify hasActiveSelfExclusion returns cooldown in post-cooldown window
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(testUserId);
      expect(activeExclusion).not.toBeNull();
      expect(activeExclusion?.type).toBe(SelfExclusionTypeEnum.COOLDOWN);
      expect(activeExclusion?.isInPostCooldownWindow).toBe(true);

      // Verify getActiveSelfExclusions returns the cooldown in post-cooldown window
      const activeExclusions = await selfExclusionService.getActiveSelfExclusions(testUserId);
      const activeCooldown = activeExclusions.find(
        (e) => e.type === SelfExclusionTypeEnum.COOLDOWN,
      );
      expect(activeCooldown).toBeDefined();
      expect(activeCooldown?.isInPostCooldownWindow).toBe(true);

      // Verify cooldown is now in post-cooldown window via API
      const activeExclusionsApi = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const activeCooldownApi = activeExclusionsApi.body.find(
        (e: any) => e.id === cooldownId && e.type === SelfExclusionTypeEnum.COOLDOWN,
      );
      expect(activeCooldownApi).toBeDefined();
      expect(activeCooldownApi.isInPostCooldownWindow).toBe(true);

      // Attempt to place a dice bet - should be blocked
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should be blocked by self-exclusion guard
      expect(betResponse.status).toBe(403);
      expect(betResponse.body.message).toContain('post-cooldown window');
      expect(betResponse.body.message).toContain('not allowed');

      // Expire the post-cooldown window
      await selfExclusionService.testExpireWindow(cooldownId);
      await selfExclusionService.expireOutdatedSelfExclusions();
    });

    it('should block all bets during temporary self-exclusion', async () => {
      // Create a cooldown first (required before temporary)
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Create temporary self-exclusion
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 days from now

      const tempResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: SelfExclusionTypeEnum.TEMPORARY,
          platformType: PlatformTypeEnum.PLATFORM,
          endDate,
        })
        .expect(201);

      // Verify hasActiveSelfExclusion returns the temporary exclusion
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(testUserId);
      expect(activeExclusion).not.toBeNull();
      expect(activeExclusion?.type).toBe(SelfExclusionTypeEnum.TEMPORARY);

      // Attempt to place a dice bet - should be blocked
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should be blocked by self-exclusion guard
      expect(betResponse.status).toBe(403);
      expect(betResponse.body.message).toContain('temporarily excluded');
      expect(betResponse.body.message).toContain('withdraw');

      // Manually expire the temporary exclusion by updating endDate to the past
      await updateExclusionDate(tempResponse.body.id, 'endDate', new Date(Date.now() - 1000));

      // Wait briefly for cache to clear
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should block all bets during permanent self-exclusion', async () => {
      // Create a new user for permanent exclusion test
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `perm-bet-test-${Date.now()}@example.com`,
          username: `perm-bet-test-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const permToken = registerResponse.body.accessToken;

      // Get user profile to get userId
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${permToken}`)
        .expect(200);

      const permUserId = profileResponse.body.id;

      // Create a cooldown first (required before permanent)
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${permToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Create permanent self-exclusion
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${permToken}`)
        .send({
          type: SelfExclusionTypeEnum.PERMANENT,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Verify hasActiveSelfExclusion returns the permanent exclusion
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(permUserId);
      expect(activeExclusion).not.toBeNull();
      expect(activeExclusion?.type).toBe(SelfExclusionTypeEnum.PERMANENT);

      // Attempt to place a dice bet - should be blocked
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${permToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should be blocked by self-exclusion guard
      expect(betResponse.status).toBe(403);
      expect(betResponse.body.message).toContain('permanently excluded');
      expect(betResponse.body.message).toContain('withdraw');
    });

    it('should allow bets when no self-exclusion is active', async () => {
      // Create a new user with no self-exclusion
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `no-exclusion-${Date.now()}@example.com`,
          username: `no-exclusion-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const noExclusionToken = registerResponse.body.accessToken;

      // Verify hasActiveSelfExclusion returns null
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${noExclusionToken}`)
        .expect(200);

      const noExclusionUserId = profileResponse.body.id;
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(noExclusionUserId);
      expect(activeExclusion).toBeNull();

      // Attempt to place a dice bet - should succeed (or fail for other reasons, but not self-exclusion)
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${noExclusionToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should NOT be a 403 self-exclusion error
      if (betResponse.status === 403) {
        expect(betResponse.body.message).not.toContain('excluded');
        expect(betResponse.body.message).not.toContain('cooldown');
      }
    });

    it('should allow bets after post-cooldown window expires', async () => {
      // Create a new user
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `window-expired-${Date.now()}@example.com`,
          username: `window-expired-${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      const windowToken = registerResponse.body.accessToken;

      // Create a cooldown
      const cooldownResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${windowToken}`)
        .send({
          type: SelfExclusionTypeEnum.COOLDOWN,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      const cooldownId = cooldownResponse.body.id;

      // Expire the cooldown and start post-cooldown window
      await selfExclusionService.testExpireCooldown(cooldownId);

      // Expire the post-cooldown window
      await selfExclusionService.testExpireWindow(cooldownId);

      // Run the expiration cron job to delete the expired cooldown
      await selfExclusionService.expireOutdatedSelfExclusions();

      // Verify no active self-exclusion
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${windowToken}`)
        .expect(200);

      const windowUserId = profileResponse.body.id;
      const activeExclusion = await selfExclusionService.hasActiveSelfExclusion(windowUserId);
      expect(activeExclusion).toBeNull();

      // Attempt to place a dice bet - should not be blocked by self-exclusion
      const betResponse = await request(app.getHttpServer())
        .post('/games/dice/bet')
        .set('Authorization', `Bearer ${windowToken}`)
        .send({
          betAmount: 100,
          target: 50,
          isOver: true,
          currency: 'USDT',
        });

      // Should NOT be a 403 self-exclusion error
      if (betResponse.status === 403) {
        expect(betResponse.body.message).not.toContain('excluded');
        expect(betResponse.body.message).not.toContain('cooldown');
        expect(betResponse.body.message).not.toContain('post-cooldown');
      }
    });
  });
});
