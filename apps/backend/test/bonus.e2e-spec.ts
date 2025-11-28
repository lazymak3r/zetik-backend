/* eslint-disable */
// File disabled from ESLint for test stability

import { AssetTypeEnum, BalanceWalletEntity, WalletEntity } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { AppDataSource } from '../src/data-source';
import { PaymentsModule } from '../src/payments/payments.module';
import { NotificationService } from '../src/websocket/services/notification.service';

import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';

describe('BonusController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userId: string;
  let accessToken: string;
  let bonusId: string;
  let notificationService: NotificationService;
  const logger = new Logger('BonusE2E');

  beforeAll(async () => {
    try {
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
      notificationService = moduleFixture.get<NotificationService>(NotificationService);

      const user = {
        email: `bonususer${Date.now()}@example.com`,
        username: `bonususer${Date.now()}`,
        password: 'Secret123',
      };

      // Register and login user
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send(user)
        .expect(201);
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login/email')
        .send({ email: user.email, password: user.password })
        .expect(200);
      accessToken = loginRes.body.accessToken;
      userId = registerRes.body.user.id;

      // Create a payments wallet so bonus claims work
      const walletRepo = dataSource.getRepository(WalletEntity);
      // @ts-ignore: allow partial WalletEntity seeding
      await walletRepo.save(
        walletRepo.create({ userId, asset: AssetTypeEnum.BTC, addresses: { BTC: 'testaddr' } }),
      );
      // Seed balance wallet for bonus operations
      const balanceRepo = dataSource.getRepository(BalanceWalletEntity);
      // @ts-ignore: allow partial BalanceWalletEntity seeding
      await balanceRepo.save(
        balanceRepo.create({ userId, asset: AssetTypeEnum.BTC, balance: '0', isPrimary: true }),
      );
    } catch (error) {
      logger.error('Setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/bonus/vip-tiers returns list of tiers', async () => {
    const res = await request(app.getHttpServer()).get('/v1/bonus/vip-tiers').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it('POST /v1/bonus/test/bet-confirmed emits event and creates pending bonus', async () => {
    const payload = {
      userId,
      betAmount: '1500000', // 15000.00 USD in cents (more than Bronze requirement)
      refundAmount: '0',
      operationId: 'test-bet-operation-' + Date.now(),
    };
    await request(app.getHttpServer())
      .post('/v1/bonus/test/bet-confirmed')
      .send(payload)
      .expect(201);
    // Wait for async event processing
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('GET /v1/bonus/pending returns pending bonus', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/bonus/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('id');
    bonusId = res.body.data[0].id;
    expect(bonusId).toBeDefined();
  });

  it('GET /v1/bonus/vip-status returns updated VIP status', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/bonus/vip-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('currentVipLevel');
    expect(res.body).toHaveProperty('previousVipLevel');
    expect(res.body).toHaveProperty('currentVipLevel', 1);
    expect(res.body).toHaveProperty('previousVipLevel', 0);
  });

  it('POST /v1/bonus/claim/:bonusId claims the bonus', async () => {
    if (!bonusId) {
      throw new Error('bonusId is undefined - no bonus was created in previous test');
    }
    await request(app.getHttpServer())
      .post(`/v1/bonus/claim/${bonusId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  it('GET /v1/bonus/pending returns no pending bonuses after claim', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/bonus/pending')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it('sends notification when user VIP level changes', async () => {
    // Spy on NotificationService to capture level-up notifications
    const spy = jest
      .spyOn(notificationService, 'sendToUser')
      // Don't actually try to emit over socket.io during test
      .mockImplementation(() => void 0);

    const payload = {
      userId,
      // Large bet to ensure we cross at least one more tier threshold from current state
      betAmount: '5000000', // $50,000.00 in cents
      refundAmount: '0',
      operationId: 'test-bet-operation-' + Date.now(),
    };

    await request(app.getHttpServer())
      .post('/v1/bonus/test/bet-confirmed')
      .send(payload)
      .expect(201);

    // Wait for async event processing and notifications
    await new Promise((resolve) => setTimeout(resolve, 600));

    const calls: any[] = (spy as any).mock.calls as any[];
    // Find a call that targets our user and is a vip_level_up notification
    const levelUpCall = calls.find(
      (args) => args?.[0] === userId && args?.[1]?.type === 'vip_level_up',
    );

    expect(levelUpCall).toBeDefined();
    const [, notif] = levelUpCall as [string, any];
    expect(notif).toHaveProperty('type', 'vip_level_up');
    expect(notif).toHaveProperty('title');
    expect(notif).toHaveProperty('message');
    expect(notif).toHaveProperty('data');
    expect(notif.data).toHaveProperty('vipLevel');

    spy.mockRestore();
  });
});
