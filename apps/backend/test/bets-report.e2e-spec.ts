import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * E2E tests for bets archive and export endpoints
 */
describe('Bets Report (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

  // Seeded data
  const betIds = [randomUUID(), randomUUID(), randomUUID()];
  const now = new Date();
  const day2 = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0, 0),
  );
  const day1 = new Date(day2);
  day1.setUTCDate(day2.getUTCDate() - 1);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Align with other e2e tests
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

    // 1) Register a user to get JWT
    const email = `bets-report-${Date.now()}@example.com`;
    const username = `bets_report_user_${Date.now()}`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register/email')
      .send({ email, password: 'TestPassword123!', username })
      .expect(201);

    expect(registerResponse.body).toHaveProperty('accessToken');
    accessToken = registerResponse.body.accessToken;

    // 2) Get created user id from DB
    const dataSource = app.get('DataSource');
    const users = await dataSource.query('SELECT id FROM users.users WHERE email = $1', [email]);
    userId = users[0].id;

    // 3) Seed games.user_bets rows with two on day1 and one on day2
    // Use BTC asset and DICE game to match enums
    // Row 1 (day1)
    await dataSource.query(
      `INSERT INTO games.user_bets 
        (game, "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        'DICE',
        'Dice',
        betIds[0],
        userId,
        '10.00000000',
        'BTC',
        '2.50',
        '25.00000000',
        '500000.0000',
        '1250000.0000',
        day1.toISOString(),
        day1.toISOString(),
      ],
    );

    // Row 2 (day1)
    await dataSource.query(
      `INSERT INTO games.user_bets 
        (game, "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        'DICE',
        'Dice',
        betIds[1],
        userId,
        '5.00000000',
        'BTC',
        '1.00',
        '0.00000000',
        '250000.0000',
        '0.0000',
        new Date(day1.getTime() + 60_000).toISOString(),
        new Date(day1.getTime() + 60_000).toISOString(),
      ],
    );

    // Row 3 (day2)
    await dataSource.query(
      `INSERT INTO games.user_bets 
        (game, "gameName", "betId", "userId", "betAmount", asset, multiplier, payout, "betAmountUsd", "payoutUsd", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        'DICE',
        'Dice',
        betIds[2],
        userId,
        '1.00000000',
        'BTC',
        '3.00',
        '3.00000000',
        '50000.0000',
        '150000.0000',
        day2.toISOString(),
        day2.toISOString(),
      ],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /games/bets/archive', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).get('/games/bets/archive').expect(401);
    });

    it('should return counts by day for a given date range', async () => {
      const from = new Date(day1);
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(day2);
      to.setUTCHours(23, 59, 59, 999);

      const res = await request(app.getHttpServer())
        .get('/games/bets/archive')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ from: formatYMD(day1), to: formatYMD(day2) })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      const d1 = formatYMD(day1);
      const d2 = formatYMD(day2);
      const item1 = res.body.find((r: any) => r.date === d1);
      const item2 = res.body.find((r: any) => r.date === d2);
      expect(item1).toBeDefined();
      expect(item1.count).toBe(2);
      expect(item2).toBeDefined();
      expect(item2.count).toBe(1);
    });

    it('should support days parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/games/bets/archive')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ days: 2 })
        .expect(200);

      const d1 = formatYMD(day1);
      const d2 = formatYMD(day2);
      const item1 = res.body.find((r: any) => r.date === d1);
      const item2 = res.body.find((r: any) => r.date === d2);
      expect(item1).toBeDefined();
      expect(item2).toBeDefined();
    });
  });

  describe('GET /games/bets/export', () => {
    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).get('/games/bets/export').expect(401);
    });

    it('should return a downloadable JSON file with detailed bets', async () => {
      const res = await request(app.getHttpServer())
        .get('/games/bets/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ from: formatYMD(day1), to: formatYMD(day2), limit: 10 })
        .expect(200);

      // Headers
      expect(res.header['content-type']).toMatch(/application\/json/);
      expect(res.header['content-disposition']).toMatch(/attachment; filename="bets-export-/);

      // Body
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      // First record should match first inserted row (ordered by createdAt ASC)
      const first = res.body[0];
      expect(first.id).toBe(betIds[0]);
      expect(first.user_id).toBe(userId);
      expect(first.data).toBeDefined();
      expect(first.data.amount).toBe(10);
      expect(first.data.payout).toBe(25);
      expect(first.data.currency).toBe('btc');
      expect(first.data.gameName).toBe('dice');
      expect(first.data.payoutMultiplier).toBe(2.5);
      expect(first.data.expectedAmount).toBe(25);
      expect(typeof first.data.createdAt).toBe('number');
      expect(typeof first.data.updatedAt).toBe('number');

      // Ensure last record corresponds to day2 insert
      const last = res.body[res.body.length - 1];
      expect([betIds[2]]).toContain(last.id);
    });
  });
});

function pad(num: number) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatYMD(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
