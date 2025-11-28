import { PasswordUtil } from '@zetik/common';
import { AdminEntity, AdminRole, St8BonusEntity, St8BonusStatusEnum } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { BalanceModule } from '../src/balance/balance.module';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { providerGamesConfig } from '../src/config/provider-games.config';
import { AppDataSource } from '../src/data-source';
import { ProviderGamesModule } from '../src/provider-games/provider-games.module';

describe('St8BonusController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminRepository: Repository<AdminEntity>;
  let st8BonusRepository: Repository<St8BonusEntity>;
  let testLogger: Logger;
  let testAdminId: string;

  beforeAll(async () => {
    testLogger = new Logger('St8BonusTest');

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, providerGamesConfig],
          }),
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          ProviderGamesModule,
          BalanceModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      dataSource = moduleFixture.get<DataSource>(DataSource);
      adminRepository = dataSource.getRepository(AdminEntity);
      st8BonusRepository = dataSource.getRepository(St8BonusEntity);

      // Create test admin
      const hashedPassword = await PasswordUtil.hashPassword('TestPassword123!');
      const admin = adminRepository.create({
        email: `admin_${Date.now()}@test.com`,
        name: 'Test Admin',
        password: hashedPassword,
        role: AdminRole.ADMIN,
        isActive: true,
        tokenVersion: 1,
      });
      const savedAdmin = await adminRepository.save(admin);
      testAdminId = savedAdmin.id;

      // Clean up existing bonuses
      await st8BonusRepository.delete({});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      testLogger.error(`Error setting up test environment: ${errorMessage}`);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up bonuses before each test
    await st8BonusRepository.delete({});
  });

  describe('POST /provider-games/st8/bonus', () => {
    const validBonusData = {
      bonus_id: `bonus-${randomUUID()}-test`,
      game_codes: ['game1', 'game2'],
      currency: 'USD',
      value: '100.00',
      type: 'free_money',
      players: ['player1', 'player2'],
      count: 1,
      site: 'site1',
    };

    it('should create bonus with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', testAdminId)
        .send(validBonusData)
        .expect(201);

      expect(response.body).toBeDefined();

      // Verify bonus was created in database
      const bonus = await st8BonusRepository.findOne({
        where: { bonus_id: validBonusData.bonus_id },
      });
      expect(bonus).toBeDefined();
      expect(bonus?.bonus_id).toBe(validBonusData.bonus_id);
      expect(bonus?.createdByAdminId).toBe(testAdminId);
    });

    it('should reject duplicate bonus_id (idempotency)', async () => {
      // Create first bonus
      await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', testAdminId)
        .send(validBonusData)
        .expect(201);

      // Try to create duplicate
      const duplicateData = { ...validBonusData };
      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', testAdminId)
        .send(duplicateData)
        .expect(409);

      expect(response.body.message).toContain('Bonus ID already exists');
    });

    it('should reject bonus_id with invalid format', async () => {
      const invalidData = {
        ...validBonusData,
        bonus_id: 'invalid!@#id',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', testAdminId)
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should require admin ID header', async () => {
      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .send(validBonusData)
        .expect(400);

      expect(response.body.message).toContain('Admin ID required');
    });

    it('should reject non-existent admin ID', async () => {
      const nonExistentAdminId = randomUUID();

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', nonExistentAdminId)
        .send(validBonusData)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should create bonus with start_time', async () => {
      const bonusWithTime = {
        ...validBonusData,
        bonus_id: `bonus-${randomUUID()}-time`,
        start_time: '2025-12-31T23:59:59Z',
      };

      await request(app.getHttpServer())
        .post('/provider-games/st8/bonus')
        .set('x-admin-id', testAdminId)
        .send(bonusWithTime)
        .expect(201);

      const bonus = await st8BonusRepository.findOne({
        where: { bonus_id: bonusWithTime.bonus_id },
      });
      expect(bonus?.startTime).toBeDefined();
    });
  });

  describe('GET /provider-games/st8/bonus/local', () => {
    beforeEach(async () => {
      // Create test bonuses
      const bonuses = [
        {
          bonus_id: `bonus-${randomUUID()}-1`,
          gameCodes: ['game1'],
          type: 'free_money' as any,
          value: '100.00',
          currency: 'USD',
          players: ['player1'],
          status: St8BonusStatusEnum.FINISHED,
          createdByAdminId: testAdminId,
        },
        {
          bonus_id: `bonus-${randomUUID()}-2`,
          gameCodes: ['game2'],
          type: 'free_bets' as any,
          value: '200.00',
          currency: 'EUR',
          players: ['player2'],
          status: St8BonusStatusEnum.PROCESSING,
          createdByAdminId: testAdminId,
        },
      ];

      for (const bonusData of bonuses) {
        await st8BonusRepository.save(bonusData);
      }
    });

    it('should return all bonuses', async () => {
      const response = await request(app.getHttpServer())
        .get('/provider-games/st8/bonus/local')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter bonuses by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/provider-games/st8/bonus/local?status=finished')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((bonus: any) => {
        expect(bonus.status).toBe('finished');
      });
    });

    it('should filter bonuses by createdByAdminId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/provider-games/st8/bonus/local?createdByAdminId=${testAdminId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((bonus: any) => {
        expect(bonus.createdByAdminId).toBe(testAdminId);
      });
    });

    it('should apply pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/provider-games/st8/bonus/local?limit=1&offset=0')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /provider-games/st8/bonus/:bonusId', () => {
    let testBonusId: string;

    beforeEach(async () => {
      const bonus = await st8BonusRepository.save({
        bonus_id: `bonus-${randomUUID()}-fetch`,
        gameCodes: ['game1'],
        type: 'free_money' as any,
        value: '100.00',
        currency: 'USD',
        players: ['player1'],
        status: St8BonusStatusEnum.PROCESSING,
        createdByAdminId: testAdminId,
      });
      testBonusId = bonus.bonus_id;
    });

    it('should fetch bonus by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/provider-games/st8/bonus/${testBonusId}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /provider-games/st8/bonus/:bonusId/cancel', () => {
    let testBonusId: string;

    beforeEach(async () => {
      const bonus = await st8BonusRepository.save({
        bonus_id: `bonus-${randomUUID()}-cancel`,
        gameCodes: ['game1'],
        type: 'free_money' as any,
        value: '100.00',
        currency: 'USD',
        players: ['player1'],
        status: St8BonusStatusEnum.FINISHED,
        createdByAdminId: testAdminId,
      });
      testBonusId = bonus.bonus_id;
    });

    it('should cancel bonus', async () => {
      const response = await request(app.getHttpServer())
        .post(`/provider-games/st8/bonus/${testBonusId}/cancel`)
        .send({
          site: 'site1',
          players: ['player1'],
        })
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('Race condition: concurrent bonus creation', () => {
    it('should handle concurrent requests with same bonus_id', async () => {
      const bonusId = `bonus-${randomUUID()}-race`;
      const bonusData = {
        bonus_id: bonusId,
        game_codes: ['game1'],
        currency: 'USD',
        value: '100.00',
        type: 'free_money',
        players: ['player1'],
      };

      // Send concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/provider-games/st8/bonus')
          .set('x-admin-id', testAdminId)
          .send(bonusData),
      );

      const results = await Promise.allSettled(promises);

      // Only one should succeed
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201,
      ).length;
      const conflictCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 409,
      ).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      // Verify only one bonus exists in database
      const bonuses = await st8BonusRepository.find({
        where: { bonus_id: bonusId },
      });
      expect(bonuses.length).toBe(1);
    });
  });
});
