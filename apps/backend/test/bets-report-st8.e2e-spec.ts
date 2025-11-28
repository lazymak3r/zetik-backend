import { BalanceOperationEnum } from '@zetik/shared-entities';
import { CallHandler, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BalanceService } from '../src/balance/balance.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { St8SignatureInterceptor } from '../src/provider-games/interceptors/st8-signature.interceptor';

class MockSt8SignatureInterceptor extends St8SignatureInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle();
  }
}

/**
 * E2E test to verify provider (ST8) bets are saved and visible via bets report endpoints
 */
describe('Bets Report with ST8 provider (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let balanceService: BalanceService;

  const now = new Date();
  function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
  }
  function formatYMD(d: Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  // ST8 transaction data
  const developer_code = 'testdev';
  const game_code = 'testgame';
  const round = `round-${Date.now()}`;
  const transaction_id = randomUUID();
  const provider_transaction_id = randomUUID();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideInterceptor(St8SignatureInterceptor)
      .useClass(MockSt8SignatureInterceptor)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.enableCors();

    await app.init();

    // Register a user to get JWT
    const email = `bets-st8-${Date.now()}@example.com`;
    const username = `bets_st8_user_${Date.now()}`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register/email')
      .send({ email, password: 'TestPassword123!', username })
      .expect(201);

    expect(registerResponse.body).toHaveProperty('accessToken');
    accessToken = registerResponse.body.accessToken;

    // Fetch user id via DataSource alias
    const dataSource = app.get('DataSource');
    const users = await dataSource.query('SELECT id FROM users.users WHERE email = $1', [email]);
    userId = users[0].id;

    // Seed fiat balance so debit can succeed
    balanceService = app.get(BalanceService);

    // Ensure primary wallet exists for fiat operations
    await dataSource.query(
      'INSERT INTO balance.wallets("userId", asset, balance, "isPrimary") VALUES ($1,$2,$3,$4) ON CONFLICT ("userId", asset) DO NOTHING',
      [userId, 'USDT', '0', true],
    );

    await balanceService.updateFiatBalance({
      userId,
      operation: BalanceOperationEnum.DEPOSIT as any,
      operationId: `fiat-deposit-${Date.now()}`,
      amount: '500000', // $5,000.00 in cents
      currency: 'USD' as any,
      description: 'Seed fiat balance for ST8 tests',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should record ST8 debit/credit into games.user_bets and expose via /games/bets/export', async () => {
    // 1) Perform ST8 debit (bet)
    const debitBody = {
      player: userId,
      site: 'test-site',
      token: randomUUID(),
      transaction_id,
      round,
      round_closed: false,
      game_code,
      developer_code,
      amount: '10.00',
      currency: 'USD',
      provider_kind: 'debit',
      provider: {
        transaction_id: provider_transaction_id,
        amount: '10.00',
        currency: 'USD',
        player: userId,
        round,
      },
      bonus: null,
    };

    const debitRes = await request(app.getHttpServer())
      .post('/provider-games/st8/debit')
      .send(debitBody)
      .expect(200);

    expect(debitRes.body?.status).toBe('ok');

    // 2) Perform ST8 credit (win)
    const creditBody = {
      ...debitBody,
      transaction_id: randomUUID(),
      provider_kind: 'credit',
      amount: '25.00',
      provider: {
        ...debitBody.provider,
        transaction_id: provider_transaction_id,
        amount: '25.00',
      },
    };

    const creditRes = await request(app.getHttpServer())
      .post('/provider-games/st8/credit')
      .send(creditBody)
      .expect(200);

    expect(creditRes.body?.status).toBe('ok');

    // 3) Export bets and validate provider row
    const res = await request(app.getHttpServer())
      .get('/games/bets/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from: formatYMD(now), to: formatYMD(now), limit: 50 })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    // Find provider bet by gameName
    const expectedGameName = `${developer_code}:${game_code}`.toLowerCase();
    const providerBet = res.body.find(
      (r: any) => r.data?.gameName === expectedGameName && r.user_id === userId,
    );

    expect(providerBet).toBeDefined();
    expect(providerBet.data.currency).toBe('usdt'); // stored as USDT in user_bets
    expect(providerBet.data.amount).toBe(10);
    expect(providerBet.data.payout).toBe(25);
    expect(providerBet.data.payoutMultiplier).toBeCloseTo(2.5, 5);
    expect(providerBet.data.expectedAmount).toBeCloseTo(25, 5);
  });

  it('should include provider bet in the archive counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/games/bets/archive')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ from: formatYMD(now), to: formatYMD(now) })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const item = res.body.find((i: any) => i.date === formatYMD(now));
    expect(item).toBeDefined();
    expect(item.count).toBeGreaterThanOrEqual(1);
  });
});
