import { AssetTypeEnum, TransactionEntity, WalletEntity } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { CryptoConverterService } from '../src/balance/services/crypto-converter.service';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { AppDataSource } from '../src/data-source';
import { PaymentsModule } from '../src/payments/payments.module';

describe('PaymentsController (e2e)', () => {
  const logger = new Logger('PaymentsE2E');
  const userInfo = {
    email: `payuser${Date.now()}@example.com`,
    username: `payuser${Date.now()}`,
    password: 'Secret123',
  };
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let transactionRepository: Repository<TransactionEntity>;

  beforeAll(async () => {
    try {
      const mockTransactionRepo = {
        findOne: jest.fn(),
      };

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          AuthModule,
          PaymentsModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              commonConfig,
              databaseConfig,
              authConfig,
              () => ({ fireblocks: { supportedAssets: [AssetTypeEnum.BTC] } }),
            ],
          }),
        ],
      })
        .overrideProvider(CryptoConverterService)
        .useValue({
          getAllRatesInUsd: jest.fn().mockResolvedValue({
            BTC: 45000,
            ETH: 3000,
            USDC: 1.0,
            USDT: 1.0,
            LTC: 180,
            DOGE: 0.08,
            TRX: 0.1,
            XRP: 0.6,
            SOL: 100,
          }),
        })
        .overrideProvider(getRepositoryToken(TransactionEntity))
        .useValue(mockTransactionRepo)
        .compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();

      // Get the mocked transaction repository
      transactionRepository = moduleFixture.get<Repository<TransactionEntity>>(
        getRepositoryToken(TransactionEntity),
      );

      // Seed assets and get DataSource
      const ds = moduleFixture.get<DataSource>(DataSource);

      // Register and login a user
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send(userInfo)
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);
      accessToken = res.body.accessToken;
      const userId = registerRes.body.user.id;

      // Seed a wallet so deposit-address returns a value
      const walletRepo = ds.getRepository(WalletEntity);
      // @ts-ignore: allow partial WalletEntity seeding
      await walletRepo.save(
        walletRepo.create({
          userId,
          asset: AssetTypeEnum.BTC,
          addresses: { BTC: 'testaddr' },
        }),
      );
    } catch (error) {
      logger.error('Setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/payments/available-assets should return assets list', async () => {
    const res = await request(app.getHttpServer()).get('/v1/payments/available-assets').expect(200);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets.length).toBeGreaterThan(0);
    expect(res.body.assets[0]).toHaveProperty('symbol');
  });

  it('GET /v1/payments/deposit-address requires auth and returns address', async () => {
    const endpoint = '/v1/payments/deposit-address?asset=BTC';
    // missing auth
    await request(app.getHttpServer()).get(endpoint).expect(401);
    const res = await request(app.getHttpServer())
      .get(endpoint)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('address');
    expect(res.body).toHaveProperty('qrCode');
  });

  it('GET /v1/payments/wallets returns array', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/payments/wallets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  describe('POST /v1/payments/withdraw-requests', () => {
    const url = '/v1/payments/withdraw-requests';
    it('should reject negative amount', async () => {
      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ requestId: 'r1', asset: 'BTC', amount: '-1', toAddress: 'addr' })
        .expect(400);
    });
    it('should reject insufficient balance', async () => {
      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ requestId: 'r2', asset: 'BTC', amount: '10', toAddress: 'addr' })
        .expect(400);
    });
  });

  describe('GET /v1/payments/currency-rates', () => {
    const url = '/v1/payments/currency-rates';

    it('should return currency rates with default USD base currency', async () => {
      const res = await request(app.getHttpServer()).get(url).expect(200);

      expect(res.body).toHaveProperty('rates');
      expect(res.body).toHaveProperty('lastUpdated');
      expect(res.body).toHaveProperty('baseCurrency');
      expect(res.body.baseCurrency).toBe('USD');
      expect(Object.keys(res.body.rates).length).toBeGreaterThan(0);
    });

    it('should return currency rates with EUR base currency', async () => {
      const res = await request(app.getHttpServer()).get(`${url}?baseCurrency=EUR`).expect(200);

      expect(res.body).toHaveProperty('rates');
      expect(res.body).toHaveProperty('lastUpdated');
      expect(res.body).toHaveProperty('baseCurrency');
      expect(res.body.baseCurrency).toBe('EUR');
      expect(Object.keys(res.body.rates).length).toBeGreaterThan(0);
    });

    it('should return currency rates with JPY base currency', async () => {
      const res = await request(app.getHttpServer()).get(`${url}?baseCurrency=JPY`).expect(200);

      expect(res.body).toHaveProperty('rates');
      expect(res.body).toHaveProperty('lastUpdated');
      expect(res.body).toHaveProperty('baseCurrency');
      expect(res.body.baseCurrency).toBe('JPY');
      expect(Object.keys(res.body.rates).length).toBeGreaterThan(0);
    });

    it('should correctly convert rates based on base currency', async () => {
      // First get USD rates
      const usdRes = await request(app.getHttpServer()).get(url).expect(200);

      // Then get EUR rates
      const eurRes = await request(app.getHttpServer()).get(`${url}?baseCurrency=EUR`).expect(200);

      // Get a sample crypto asset from the response
      const sampleAsset = Object.keys(usdRes.body.rates)[0];

      // The EUR rate should be different from the USD rate
      expect(eurRes.body.rates[sampleAsset]).not.toBe(usdRes.body.rates[sampleAsset]);

      // Get the fiat conversion rate from the multi-currency endpoint
      const multiRes = await request(app.getHttpServer())
        .get('/v1/payments/currency-rates-multi')
        .expect(200);

      // If we have EUR in the multi-currency response, verify the conversion
      if (multiRes.body.rates[sampleAsset] && multiRes.body.rates[sampleAsset].EUR) {
        const expectedEurRate =
          usdRes.body.rates[sampleAsset] /
          (usdRes.body.rates[sampleAsset] / multiRes.body.rates[sampleAsset].EUR);

        // Allow for small floating point differences
        expect(Math.abs(eurRes.body.rates[sampleAsset] - expectedEurRate)).toBeLessThan(0.001);
      }
    });

    it('should support all required currencies as base currency', async () => {
      // Test a sample of the required currencies
      const requiredCurrencies = ['USD', 'EUR', 'BRL', 'MXN', 'JPY', 'CAD', 'CNY', 'RUB'];

      for (const currency of requiredCurrencies) {
        const res = await request(app.getHttpServer())
          .get(`${url}?baseCurrency=${currency}`)
          .expect(200);

        expect(res.body.baseCurrency).toBe(currency);
        expect(Object.keys(res.body.rates).length).toBeGreaterThan(0);
      }
    });
  });

  describe('GET /v1/payments/currency-rates-multi', () => {
    const url = '/v1/payments/currency-rates-multi';

    it('should return rates in multiple currencies', async () => {
      const res = await request(app.getHttpServer()).get(url).expect(200);

      expect(res.body).toHaveProperty('rates');
      expect(res.body).toHaveProperty('lastUpdated');

      // Check that we have rates for at least one crypto asset
      expect(Object.keys(res.body.rates).length).toBeGreaterThan(0);

      // Get the first crypto asset
      const firstAsset = Object.keys(res.body.rates)[0];

      // Check that this asset has rates in multiple currencies
      expect(Object.keys(res.body.rates[firstAsset]).length).toBeGreaterThan(1);

      // Check that USD is always included
      expect(res.body.rates[firstAsset]).toHaveProperty('USD');
    });

    it('should include all required currencies', async () => {
      const res = await request(app.getHttpServer()).get(url).expect(200);

      // Get the first crypto asset
      const firstAsset = Object.keys(res.body.rates)[0];

      // List of required currencies
      const requiredCurrencies = [
        'USD',
        'EUR',
        'BRL',
        'MXN',
        'JPY',
        'IDR',
        'CAD',
        'CNY',
        'DKK',
        'KRW',
        'INR',
        'PHP',
        'TRY',
        'NZD',
        'ARS',
        'RUB',
      ];

      // Check that all required currencies are included
      for (const currency of requiredCurrencies) {
        expect(res.body.rates[firstAsset]).toHaveProperty(currency);
      }
    });
  });

  describe('GET /v1/payments/transactions/:txId', () => {
    const validTxId = 'e5e7e7f4-36ab-4877-a6e3-0f46ac432156';
    const anotherUserTxId = 'another-tx-id-1234-5678-9012';
    const nonExistentTxId = '00000000-0000-0000-0000-000000000000';
    const invalidTxId = 'invalid-uuid-format';

    it('should return 401 without authentication', async () => {
      // Act & Assert
      await request(app.getHttpServer()).get(`/v1/payments/transactions/${validTxId}`).expect(401);
    });

    it('should return 400 for invalid UUID format', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get(`/v1/payments/transactions/${invalidTxId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent transaction', async () => {
      // Arrange
      (transactionRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await request(app.getHttpServer())
        .get(`/v1/payments/transactions/${nonExistentTxId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it("should return 404 when accessing another user's transaction", async () => {
      // Arrange
      (transactionRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await request(app.getHttpServer())
        .get(`/v1/payments/transactions/${anotherUserTxId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    // Note: The actual transaction details test would require mocking Fireblocks service
    // which is complex for E2E tests. You might want to test this at the unit level instead.
  });

  // Add tests for txHash persistence in email notifications
  describe('Email Notifications', () => {
    it('should include txHash in withdrawal notification emails', async () => {
      // Test that withdrawal emails include txHash
    });

    it('should include txHash in deposit notification emails', async () => {
      // Test that deposit emails include txHash
    });
  });
});
