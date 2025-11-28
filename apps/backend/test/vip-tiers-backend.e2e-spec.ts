import {
  AssetTypeEnum,
  BalanceWalletEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
  WalletEntity,
} from '@zetik/shared-entities';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { AppDataSource } from '../src/data-source';
import { PaymentsModule } from '../src/payments/payments.module';

describe('VIP Bonus System (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userId: string;
  let accessToken: string;
  let bonusId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ ...AppDataSource.options }),
        EventEmitterModule.forRoot(),
        AuthModule,
        PaymentsModule,
        BalanceModule,
        BonusesModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [commonConfig, databaseConfig, authConfig],
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    const userInfo = {
      email: `viptest${Date.now()}@example.com`,
      username: `viptest${Date.now()}`,
      password: 'VipTest123',
    };

    // Register and login user
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send(userInfo)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login/email')
      .send({
        email: userInfo.email,
        password: userInfo.password,
      })
      .expect(200);

    accessToken = loginRes.body.accessToken;
    userId = registerRes.body.user.id;

    // Create wallets for bonus operations
    const walletRepo = dataSource.getRepository(WalletEntity);
    await walletRepo.save(
      walletRepo.create({
        userId,
        asset: AssetTypeEnum.BTC,
        addresses: { BTC: 'test-btc-address' },
      }),
    );

    const balanceRepo = dataSource.getRepository(BalanceWalletEntity);
    await balanceRepo.save(
      balanceRepo.create({
        userId,
        asset: AssetTypeEnum.BTC,
        balance: '0',
        isPrimary: true,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('VIP Tier System', () => {
    it('GET /v1/bonus/vip-tiers should return all VIP tiers', async () => {
      const response = await request(app.getHttpServer()).get('/v1/bonus/vip-tiers').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(4);

      const visitor = response.body.find((tier) => tier.level === 0);
      const bronze = response.body.find((tier) => tier.level === 1);

      expect(visitor).toBeDefined();
      expect(visitor.name).toBe('Visitor');
      expect(bronze).toBeDefined();
      expect(bronze.name).toBe('Bronze I');
    });

    it('GET /v1/bonus/vip-status should return user VIP status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentVipLevel', 0);
      expect(response.body).toHaveProperty('previousVipLevel', 0);
      expect(response.body).toHaveProperty('currentWager');
      expect(response.body).toHaveProperty('tierName', 'Visitor');
    });
  });

  describe('VIP Progression and Bonuses', () => {
    it('should create level-up bonus when user reaches Bronze tier', async () => {
      // Simulate large bet to trigger Bronze level
      const betPayload = {
        userId,
        betAmount: '1500000', // $15,000 in cents (above Bronze requirement)
        refundAmount: '0',
        operationId: `test-bet-${Date.now()}`,
      };

      await request(app.getHttpServer())
        .post('/v1/bonus/test/bet-confirmed')
        .send(betPayload)
        .expect(201);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check VIP status updated
      const vipResponse = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(vipResponse.body.currentVipLevel).toBe(1);
      expect(vipResponse.body.previousVipLevel).toBe(0);

      // Check pending bonus created
      const bonusResponse = await request(app.getHttpServer())
        .get('/v1/bonus/pending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(bonusResponse.body.total).toBeGreaterThan(0);
      expect(bonusResponse.body.data[0]).toHaveProperty('bonusType', BonusTypeEnum.LEVEL_UP);
      expect(bonusResponse.body.data[0]).toHaveProperty(
        'status',
        BonusTransactionStatusEnum.PENDING,
      );

      bonusId = bonusResponse.body.data[0].id;
    });

    it('should claim level-up bonus successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/bonus/claim/${bonusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('status', BonusTransactionStatusEnum.CLAIMED);
      expect(response.body).toHaveProperty('bonusType', BonusTypeEnum.LEVEL_UP);
      expect(response.body).toHaveProperty('claimedAt');
    });

    it('should not allow claiming already claimed bonus', async () => {
      await request(app.getHttpServer())
        .post(`/v1/bonus/claim/${bonusId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should show no pending bonuses after claim', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bonus/pending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.total).toBe(0);
      expect(response.body.data).toEqual([]);
    });
  });

  // Note: Admin functions are tested in admin-panel e2e tests, not backend

  describe('Edge Cases and Validation', () => {
    it('should prevent claiming non-existent bonus', async () => {
      // Use a valid UUID that doesn't exist
      const nonExistentUuid = '550e8400-e29b-41d4-a716-446655440000';
      await request(app.getHttpServer())
        .post(`/v1/bonus/claim/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should require authentication for bonus operations', async () => {
      await request(app.getHttpServer()).get('/v1/bonus/pending').expect(401);

      await request(app.getHttpServer()).get('/v1/bonus/vip-status').expect(401);

      await request(app.getHttpServer()).post('/v1/bonus/claim/some-id').expect(401);
    });

    it('should validate bonus id', async () => {
      // Test with invalid UUID format - causes database error since there's no validation pipe
      await request(app.getHttpServer())
        .post('/v1/bonus/claim/invalid-uuid-format')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should handle pagination for bonus listing', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/bonus/pending')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 5);
    });
  });

  describe('VIP Status Calculations', () => {
    it('should accumulate wager correctly across multiple bets', async () => {
      const initialStatus = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const initialWager = parseFloat(initialStatus.body.currentWager);

      // Place additional bet
      await request(app.getHttpServer())
        .post('/v1/bonus/test/bet-confirmed')
        .send({
          userId,
          betAmount: '100000', // $1,000
          refundAmount: '0',
          operationId: `wager-test-${Date.now()}`,
        })
        .expect(201);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updatedStatus = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const updatedWager = parseFloat(updatedStatus.body.currentWager);
      expect(updatedWager).toBeGreaterThan(initialWager);
      expect(updatedWager - initialWager).toBe(100000); // $1,000 in cents
    });

    it('should handle refunds correctly in wager calculation', async () => {
      const initialStatus = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const initialWager = parseFloat(initialStatus.body.currentWager);

      // Place bet with refund
      await request(app.getHttpServer())
        .post('/v1/bonus/test/bet-confirmed')
        .send({
          userId,
          betAmount: '200000', // $2,000
          refundAmount: '50000', // $500 refund
          operationId: `refund-test-${Date.now()}`,
        })
        .expect(201);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updatedStatus = await request(app.getHttpServer())
        .get('/v1/bonus/vip-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const updatedWager = parseFloat(updatedStatus.body.currentWager);
      // Net wager should be bet - refund = $2000 - $500 = $1500 in cents = 150000
      expect(updatedWager - initialWager).toBe(150000);
    });
  });
});
