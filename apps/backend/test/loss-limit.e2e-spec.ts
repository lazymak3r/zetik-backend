import {
  AssetTypeEnum,
  BalanceOperationEnum,
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
import { BigNumber } from 'bignumber.js';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { BalanceService } from '../src/balance/balance.service';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { mailConfig } from '../src/config/mail.config';
import { getDataSourceConfig } from '../src/data-source';
import { UsersModule } from '../src/users/users.module';

describe('Loss Limit Integration Tests (e2e)', () => {
  let app: INestApplication;
  const logger = new Logger('LossLimitE2E');
  let accessToken: string;
  let userId: string;
  let balanceService: BalanceService;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...getDataSourceConfig() }),
          EventEmitterModule.forRoot(),
          AuthModule,
          UsersModule,
          BalanceModule,
          BonusesModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig, mailConfig],
          }),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      // Get the BalanceService instance
      balanceService = app.get<BalanceService>(BalanceService);

      // Register a user for testing
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `loss-limit-test${Date.now()}@example.com`,
          username: `loss-limit-user${Date.now()}`,
          password: 'Secret123',
        });

      accessToken = registerResponse.body.accessToken;

      // Get a user profile to get userId
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

  describe('Loss Limit Integration Tests', () => {
    beforeEach(async () => {
      const dataSource = app.get(DataSource);
      const selfExclusionRepository = dataSource.getRepository(SelfExclusionEntity);
      await selfExclusionRepository.clear();
    });

    it('should allow placing bets when no loss limit is set', async () => {
      // First deposit some funds to the user's account
      const depositResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: `deposit-${Date.now()}`,
        userId,
        amount: new BigNumber('100'),
        asset: AssetTypeEnum.BTC,
      });

      expect(depositResponse).toHaveProperty('success', true);

      // Place a bet
      const betResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: `bet-${Date.now()}`,
        userId,
        amount: new BigNumber('10'),
        asset: AssetTypeEnum.BTC,
      });

      expect(betResponse).toHaveProperty('success', true);
    });

    it('should allow placing bets when loss limit is not reached', async () => {
      // Set a loss limit
      const lossLimitResponse = await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      expect(lossLimitResponse.body).toHaveProperty('type', SelfExclusionTypeEnum.LOSS_LIMIT);
      expect(lossLimitResponse.body).toHaveProperty('period', LimitPeriodEnum.DAILY);
      expect(lossLimitResponse.body).toHaveProperty('limitAmount', 100);

      // Place a bet that doesn't exceed the loss limit
      const betResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: `bet-${Date.now()}`,
        userId,
        amount: new BigNumber('20'),
        asset: AssetTypeEnum.BTC,
      });

      expect(betResponse).toHaveProperty('success', true);
    });

    it('should prevent placing bets when loss limit is reached', async () => {
      // First, deposit some funds to the user's account
      const depositResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: `deposit-${Date.now()}`,
        userId,
        amount: new BigNumber('100'),
        asset: AssetTypeEnum.BTC,
      });

      expect(depositResponse).toHaveProperty('success', true);

      // Set a daily platform loss limit so subsequent bets are validated against it
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 80,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // First, place a bet that doesn't exceed the loss limit
      const betResponse1 = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: `bet-${Date.now()}`,
        userId,
        amount: new BigNumber('30'),
        asset: AssetTypeEnum.BTC,
      });

      expect(betResponse1).toHaveProperty('success', true);

      // Now place a bet that would exceed the loss limit
      let errorThrown = false;
      try {
        await balanceService.updateBalance({
          operation: BalanceOperationEnum.BET,
          operationId: `bet-${Date.now()}`,
          userId,
          amount: new BigNumber('60'),
          asset: AssetTypeEnum.BTC,
        });
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Loss limit');
      }

      // If no error was thrown, fail the test
      if (!errorThrown) {
        throw new Error('Expected an exception to be thrown when loss limit is reached');
      }
    });

    it('should allow placing bets again after winning back some losses', async () => {
      // Simulate a win to reduce losses
      const winResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.WIN,
        operationId: `win-${Date.now()}`,
        userId,
        amount: new BigNumber('40'),
        asset: AssetTypeEnum.BTC,
      });

      expect(winResponse).toHaveProperty('success', true);

      // Now place a bet that should be allowed since we've won back some losses
      const betResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: `bet-${Date.now()}`,
        userId,
        amount: new BigNumber('30'),
        asset: AssetTypeEnum.BTC,
      });

      expect(betResponse).toHaveProperty('success', true);
    });

    it('should respect different period types for loss limits', async () => {
      // First deposit some funds to the user's account
      const depositResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: `deposit-${Date.now()}`,
        userId,
        amount: new BigNumber('100'),
        asset: AssetTypeEnum.BTC,
      });

      expect(depositResponse).toHaveProperty('success', true);

      // Set a session loss limit
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.SESSION,
          limitAmount: 100,
          platformType: PlatformTypeEnum.PLATFORM,
        })
        .expect(201);

      // Place a bet that doesn't exceed the session loss limit
      const betResponse1 = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: `bet-${Date.now()}`,
        userId,
        amount: new BigNumber('20'),
        asset: AssetTypeEnum.BTC,
      });

      expect(betResponse1).toHaveProperty('success', true);

      // Place a bet that would exceed the session loss limit
      let errorThrown = false;
      try {
        await balanceService.updateBalance({
          operation: BalanceOperationEnum.BET,
          operationId: `bet-${Date.now()}`,
          userId,
          amount: new BigNumber('90'),
          asset: AssetTypeEnum.BTC,
        });
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Loss limit');
      }

      // If no error was thrown, fail the test
      if (!errorThrown) {
        throw new Error('Expected an exception to be thrown when loss limit is reached');
      }
    });

    it('should respect platform-specific loss limits', async () => {
      // First deposit some funds to the user's account
      const depositResponse = await balanceService.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: `deposit-${Date.now()}`,
        userId,
        amount: new BigNumber('100'),
        asset: AssetTypeEnum.BTC,
      });

      expect(depositResponse).toHaveProperty('success', true);

      // Set a sports-specific loss limit
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 50,
          platformType: PlatformTypeEnum.SPORTS,
        })
        .expect(201);

      // Set a casino-specific loss limit
      await request(app.getHttpServer())
        .post('/users/self-exclusion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: SelfExclusionTypeEnum.LOSS_LIMIT,
          period: LimitPeriodEnum.DAILY,
          limitAmount: 100,
          platformType: PlatformTypeEnum.CASINO,
        })
        .expect(201);

      // Verify that both limits are active
      const updatedLimitsResponse = await request(app.getHttpServer())
        .get('/users/self-exclusions/active')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const sportsLimit = updatedLimitsResponse.body.find(
        (limit) =>
          limit.type === SelfExclusionTypeEnum.LOSS_LIMIT &&
          limit.platformType === PlatformTypeEnum.SPORTS,
      );

      const casinoLimit = updatedLimitsResponse.body.find(
        (limit) =>
          limit.type === SelfExclusionTypeEnum.LOSS_LIMIT &&
          limit.platformType === PlatformTypeEnum.CASINO,
      );

      expect(sportsLimit).toBeDefined();
      expect(casinoLimit).toBeDefined();
      expect(sportsLimit.limitAmount).toBe('50.00');
      expect(casinoLimit.limitAmount).toBe('100.00');

      // Get gambling limits to verify remaining amounts
      const gamblingLimitsResponse = await request(app.getHttpServer())
        .get('/users/gambling-limits')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(gamblingLimitsResponse.body.lossLimits.length).toBeGreaterThanOrEqual(2);

      // Verify that platform-specific filtering works
      const sportLimitsResponse = await request(app.getHttpServer())
        .get('/users/self-exclusions/active?platformType=SPORTS')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const casinoLimitsResponse = await request(app.getHttpServer())
        .get('/users/self-exclusions/active?platformType=CASINO')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Sports query should return sports limits and platform-wide limits
      const hasSportsLimit = sportLimitsResponse.body.some(
        (limit) =>
          limit.type === SelfExclusionTypeEnum.LOSS_LIMIT &&
          limit.platformType === PlatformTypeEnum.SPORTS,
      );

      // Casino query should return casino limits and platform-wide limits
      const hasCasinoLimit = casinoLimitsResponse.body.some(
        (limit) =>
          limit.type === SelfExclusionTypeEnum.LOSS_LIMIT &&
          limit.platformType === PlatformTypeEnum.CASINO,
      );

      expect(hasSportsLimit).toBe(true);
      expect(hasCasinoLimit).toBe(true);
    });
  });
});
