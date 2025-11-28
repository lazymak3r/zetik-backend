import { SignatureUtils } from '@zetik/common';
import { AssetTypeEnum, BalanceHistoryEntity, BalanceOperationEnum } from '@zetik/shared-entities';
import { CallHandler, ExecutionContext, INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { BalanceModule } from '../src/balance/balance.module';
import { BalanceService } from '../src/balance/balance.service';
import { CryptoConverterService } from '../src/balance/services/crypto-converter.service';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { providerGamesConfig } from '../src/config/provider-games.config';
import { AppDataSource } from '../src/data-source';
import { St8ResponseStatusEnum } from '../src/provider-games/enums/st8.enum';
import { St8SignatureInterceptor } from '../src/provider-games/interceptors/st8-signature.interceptor';
import { ProviderGamesModule } from '../src/provider-games/provider-games.module';
import { UsersService } from '../src/users/users.service';
import { defaultTestData, seedTestDatabase } from './utils/test-utils';

class MockSt8SignatureInterceptor extends St8SignatureInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle();
  }
}

class MockCryptoConverterService extends CryptoConverterService {
  getRate(): string {
    return '1';
  }
}

describe('St8Controller (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersService: UsersService;
  let balanceService: BalanceService;
  let testLogger: Logger;
  let testUserId: string;
  const userInfo = {
    username: `st8player1${Date.now()}`,
    email: `st8player1${Date.now()}@test.com`,
    password: 'TestPassword123!',
    balance: {
      [AssetTypeEnum.USDT]: '1000.00000000',
      [AssetTypeEnum.BTC]: '0.10000000',
      [AssetTypeEnum.ETH]: '1.00000000',
    },
  };
  const token = randomUUID();

  beforeAll(async () => {
    testLogger = new Logger('St8ControllerTest');

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          BalanceModule,
          ProviderGamesModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, providerGamesConfig],
          }),
        ],
      })
        .overrideInterceptor(St8SignatureInterceptor)
        .useClass(MockSt8SignatureInterceptor)
        .overrideProvider(CryptoConverterService)
        .useClass(MockCryptoConverterService)
        .compile();

      app = moduleFixture.createNestApplication({
        rawBody: true,
      });
      await app.init();

      dataSource = moduleFixture.get<DataSource>(DataSource);
      usersService = moduleFixture.get<UsersService>(UsersService);
      balanceService = moduleFixture.get<BalanceService>(BalanceService);

      // Seed test data for games, developers, categories
      await seedTestDatabase(
        dataSource,
        defaultTestData.categories,
        defaultTestData.developers,
        defaultTestData.games,
      );

      await usersService.createWithEmail(userInfo.email, userInfo.username, userInfo.password);

      // Add balance to test user
      const user = await usersService.findByEmail(userInfo.email);
      if (user) {
        testUserId = user.id; // Store the user ID for use in tests
        await balanceService.updateBalance({
          operation: BalanceOperationEnum.DEPOSIT,
          operationId: `initial-balance-${Date.now()}`,
          userId: user.id,
          amount: new BigNumber(userInfo.balance[AssetTypeEnum.USDT]),
          asset: AssetTypeEnum.USDT,
          description: 'Initial balance for testing',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      testLogger.error(`Error setting up test environment: ${errorMessage}`);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    const initBalance = parseFloat(userInfo.balance[AssetTypeEnum.USDT]);
    const balance = parseFloat(await balanceService.getBalance(testUserId, AssetTypeEnum.USDT));
    if (balance != initBalance) {
      const newBalance = await balanceService.updateBalance({
        operation:
          balance > initBalance ? BalanceOperationEnum.WITHDRAW : BalanceOperationEnum.DEPOSIT,
        operationId: `revert-balance-${Date.now()}`,
        userId: testUserId,
        amount: new BigNumber(Math.abs(initBalance - balance)),
        asset: AssetTypeEnum.USDT,
      });
      expect(parseFloat(newBalance.balance)).toBe(initBalance);
    }
  });

  const signRequest = (body: any): string => {
    const payload = JSON.stringify(body);
    return SignatureUtils.createSignature(
      Buffer.from(providerGamesConfig().st8.localPrivateKey, 'base64').toString(),
      payload,
    );
  };

  describe('POST /provider-games/st8/player_profile', () => {
    it('should return player profile', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/player_profile')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('jurisdiction');
      expect(response.body).toHaveProperty('default_currency');
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/player_profile')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('POST /provider-games/st8/balance', () => {
    it('should return balance', async () => {
      let requestBody = {
        player: testUserId,
        currency: 'USD',
        site: 'test-site',
        token,
      };

      const { body } = await request(app.getHttpServer())
        .post('/provider-games/st8/balance')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(body).toEqual({ status: 'ok', balance: '1000.00', currency: 'USD' });
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        currency: 'USD',
        site: 'test-site',
        token,
        extraParam: 'should-be-ignored',
      };

      const { body } = await request(app.getHttpServer())
        .post('/provider-games/st8/balance')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(body).toEqual({ status: 'ok', balance: '1000.00', currency: 'USD' });
    });
  });

  describe('POST /provider-games/st8/debit', () => {
    it('should process debit transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `debit-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '10.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-debit-${Date.now()}`,
          amount: '10.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '990.00', currency: 'USD' });
    });

    it('should not go to minus with` normal debit transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `debit-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '1001.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-debit-${Date.now()}`,
          amount: '1001.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: St8ResponseStatusEnum.NOT_ENOUGH_MONEY });
    });

    it('should go to minus with correction debit transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `correction-debit-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '1001.00',
        currency: 'USD',
        provider_kind: 'correction_debit',
        provider: {
          transaction_id: `provider-correction-debit-${Date.now()}`,
          amount: '1001.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '-1.00', currency: 'USD' });
    });

    it('should be idempotent - return same result for repeated calls', async () => {
      const transactionId = `idempotent-debit-${Date.now()}`;
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: transactionId,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '5.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-${transactionId}`,
          amount: '5.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      // First call
      const firstResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(firstResponse.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(firstResponse.body).toHaveProperty('balance');
      expect(firstResponse.body).toHaveProperty('currency', 'USD');

      const firstBalance = firstResponse.body.balance;

      // Second call with the same transaction ID
      const secondResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(secondResponse.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(secondResponse.body).toHaveProperty('balance');
      expect(secondResponse.body).toHaveProperty('currency', 'USD');
      expect(secondResponse.body.balance).toBe(firstBalance);
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `debit-extra-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '10.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-debit-extra-${Date.now()}`,
          amount: '10.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });

  describe('POST /provider-games/st8/credit', () => {
    it('should process credit transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `credit-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '20.00',
        currency: 'USD',
        provider_kind: 'credit',
        provider: {
          transaction_id: `provider-credit-${Date.now()}`,
          amount: '20.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/credit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '1020.00', currency: 'USD' });
    });

    it('should be idempotent - return same result for repeated calls', async () => {
      const transactionId = `idempotent-credit-${Date.now()}`;
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: transactionId,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '15.00',
        currency: 'USD',
        provider_kind: 'credit',
        provider: {
          transaction_id: `provider-${transactionId}`,
          amount: '15.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      // First call
      const firstResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/credit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(firstResponse.body).toEqual({ status: 'ok', balance: '1015.00', currency: 'USD' });

      // Second call with the same transaction ID
      const secondResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/credit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `credit-extra-${Date.now()}`,
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '20.00',
        currency: 'USD',
        provider_kind: 'credit',
        provider: {
          transaction_id: `provider-credit-extra-${Date.now()}`,
          amount: '20.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/credit')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });

  describe('POST /provider-games/st8/cancel', () => {
    it('should process cancel with base DTO', async () => {
      let debitBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `cancel-debit-${Date.now()}`,
        round: 'test-round',
        round_closed: false,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '15.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-cancel-debit-${Date.now()}`,
          amount: '15.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const debitResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(debitBody))
        .send(debitBody)
        .expect(200);

      expect(debitResponse.body).toEqual({ status: 'ok', balance: '985.00', currency: 'USD' });

      // Now cancel the transaction
      const cancelId = `cancel-id-${Date.now()}`;
      let requestBody = {
        player: testUserId,
        cancel_id: cancelId,
        transaction_id: debitBody.transaction_id,
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '15.00',
        currency: 'USD',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '1000.00', currency: 'USD' });
      const historyRepo = dataSource.getRepository(BalanceHistoryEntity);
      const historyRecord = await historyRepo.findOne({
        where: {
          operationId: cancelId,
          operation: BalanceOperationEnum.REFUND,
        },
      });

      expect(historyRecord).toBeDefined();
    });

    it('should cancel both debit and credit', async () => {
      let debitBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `cancel-debit-${Date.now()}`,
        round: 'test-round',
        round_closed: false,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-cancel-debit-${Date.now()}`,
          amount: '100.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const debitResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(debitBody))
        .send(debitBody)
        .expect(200);

      expect(debitResponse.body).toEqual({ status: 'ok', balance: '900.00', currency: 'USD' });

      let creditBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `cancel-credit-${Date.now()}`,
        round: 'test-round',
        round_closed: false,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '500.00',
        currency: 'USD',
        provider_kind: 'credit',
        provider: {
          transaction_id: `provider-cancel-credit-${Date.now()}`,
          amount: '500.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const creditResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/credit')
        .set(providerGamesConfig().signatureHeader, signRequest(creditBody))
        .send(creditBody)
        .expect(200);

      expect(creditResponse.body).toEqual({ status: 'ok', balance: '1400.00', currency: 'USD' });

      // Now cancel the debit transaction
      const debitCancelId = `debit-cancel-id-${Date.now()}`;
      const cancelDebitBody = {
        player: testUserId,
        cancel_id: debitCancelId,
        transaction_id: debitBody.transaction_id,
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: 'USD',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(cancelDebitBody))
        .send(cancelDebitBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '1500.00', currency: 'USD' });
      const historyRepo = dataSource.getRepository(BalanceHistoryEntity);
      const cancelDebitHistoryRecord = await historyRepo.findOne({
        where: {
          operationId: debitCancelId,
          operation: BalanceOperationEnum.REFUND,
        },
      });
      expect(cancelDebitHistoryRecord).toBeDefined();

      // Now cancel the credit transaction
      const creditCancelId = `credit-cancel-id-${Date.now()}`;
      const cancelCreditBody = {
        player: testUserId,
        cancel_id: creditCancelId,
        transaction_id: creditBody.transaction_id,
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '500.00',
        currency: 'USD',
      };

      const cancelCreditResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(cancelCreditBody))
        .send(cancelCreditBody)
        .expect(200);

      expect(cancelCreditResponse.body).toEqual({
        status: 'ok',
        balance: '1000.00',
        currency: 'USD',
      });
      const historyRecord = await historyRepo.findOne({
        where: {
          operationId: creditCancelId,
          operation: BalanceOperationEnum.REFUND,
        },
      });
      expect(historyRecord).toBeDefined();
    });

    it('should be idempotent - return same result for repeated calls', async () => {
      // First create a transaction to cancel
      const debitTransactionId = `idempotent-cancel-debit-${Date.now()}`;
      let debitBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: debitTransactionId,
        round: 'test-round',
        round_closed: false,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '8.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-${debitTransactionId}`,
          amount: '8.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(debitBody))
        .send(debitBody)
        .expect(200);

      // Now cancel the transaction with a fixed cancel_id
      const cancelId = `idempotent-cancel-id-${Date.now()}`;
      let requestBody = {
        player: testUserId,
        cancel_id: cancelId,
        transaction_id: debitBody.transaction_id,
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '8.00',
        currency: 'USD',
      };

      // First call
      const firstResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(firstResponse.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(firstResponse.body).toHaveProperty('balance');
      expect(firstResponse.body).toHaveProperty('currency', 'USD');

      const firstBalance = firstResponse.body.balance;

      // Second call with the same cancel_id
      const secondResponse = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(secondResponse.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(secondResponse.body).toHaveProperty('balance');
      expect(secondResponse.body).toHaveProperty('currency', 'USD');
      expect(secondResponse.body.balance).toBe(firstBalance);
    });

    it('should ignore additional parameters', async () => {
      // First create a transaction to cancel
      let debitBody = {
        player: testUserId,
        site: 'test-site',
        token,
        transaction_id: `cancel-extra-debit-${Date.now()}`,
        round: 'test-round',
        round_closed: false,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '15.00',
        currency: 'USD',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-cancel-extra-debit-${Date.now()}`,
          amount: '15.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      await request(app.getHttpServer())
        .post('/provider-games/st8/debit')
        .set(providerGamesConfig().signatureHeader, signRequest(debitBody))
        .send(debitBody)
        .expect(200);

      // Now cancel the transaction with extra parameters
      let requestBody = {
        player: testUserId,
        cancel_id: `cancel-extra-id-${Date.now()}`,
        transaction_id: debitBody.transaction_id,
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '15.00',
        currency: 'USD',
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/cancel')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });

  describe('POST /provider-games/st8/buyin', () => {
    it('should process buyin transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `buyin-${Date.now()}`,
        amount: '30.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-buyin-${Date.now()}`,
          amount: '30.00',
          currency: 'USD',
          player: testUserId,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/buyin')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '970.00', currency: 'USD' });
    });

    it('should not go to minus with buyin transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `minus-buyin-${Date.now()}`,
        amount: '1030.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-buyin-${Date.now()}`,
          amount: '30.00',
          currency: 'USD',
          player: testUserId,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/buyin')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: St8ResponseStatusEnum.NOT_ENOUGH_MONEY });
    });

    it('should go to minus with correction buyin transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `minus-buyin-${Date.now()}`,
        amount: '1030.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'correction_debit',
        provider: {
          transaction_id: `provider-buyin-${Date.now()}`,
          amount: '30.00',
          currency: 'USD',
          player: testUserId,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/buyin')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', balance: '-30.00', currency: 'USD' });
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `buyin-extra-${Date.now()}`,
        amount: '30.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-buyin-extra-${Date.now()}`,
          amount: '30.00',
          currency: 'USD',
          player: testUserId,
        },
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/buyin')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });

  describe('POST /provider-games/st8/payout', () => {
    it('should process payout transaction', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `payout-${Date.now()}`,
        amount: '40.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-payout-${Date.now()}`,
          amount: '40.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/payout')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });

    it('should ignore additional parameters', async () => {
      let requestBody = {
        player: testUserId,
        site: 'test-site',
        transaction_id: `payout-extra-${Date.now()}`,
        amount: '40.00',
        currency: 'USD',
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: 'debit',
        provider: {
          transaction_id: `provider-payout-extra-${Date.now()}`,
          amount: '40.00',
          currency: 'USD',
          player: testUserId,
        },
        bonus: null,
        extraParam: 'should-be-ignored',
      };

      const response = await request(app.getHttpServer())
        .post('/provider-games/st8/payout')
        .set(providerGamesConfig().signatureHeader, signRequest(requestBody))
        .send(requestBody)
        .expect(200);

      expect(response.body).toHaveProperty('status', St8ResponseStatusEnum.OK);
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });
});
