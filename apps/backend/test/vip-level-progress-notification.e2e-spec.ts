/* eslint-disable */
// E2E test: vip_level_progress notification and correct progress percentage

import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';

import BigNumber from 'bignumber.js';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { authConfig } from '../src/config/auth.config';
import { AppDataSource } from '../src/data-source';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';
import { WebSocketModule } from '../src/websocket/websocket.module';

describe('VIP Level Progress Notification (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let usersService: UsersService;
  let socket: Socket;
  let accessToken: string;
  let userId: string;
  const logger = new Logger('VipLevelProgressE2E');

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          ConfigModule.forRoot({ isGlobal: true, load: [authConfig] }),
          UsersModule,
          WebSocketModule,
          BonusesModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();
      await app.listen(0);

      jwtService = app.get<JwtService>(JwtService);
      usersService = app.get<UsersService>(UsersService);

      // Create a test user and JWT
      const user = await usersService.createWithEmail(
        `vip-progress${Date.now()}@example.com`,
        `vip-progress-user${Date.now()}`,
        'Secret123',
      );
      userId = user.id;

      accessToken = jwtService.sign(
        { sub: userId, email: user.email },
        { secret: authConfig().secret, expiresIn: '1h' },
      );
    } catch (error) {
      logger.error('Setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  const connectSocket = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const port = app.getHttpServer().address().port;
      socket = io(`http://localhost:${port}/notifications`, {
        auth: { token: accessToken },
        transports: ['websocket'],
        forceNew: true,
      });

      socket.on('connected', () => resolve());
      socket.on('connect_error', (err) => reject(err));
      socket.on('error', (err) => reject(err));
    });
  };

  it('should send vip_level_progress with correct progress percentage', async () => {
    await connectSocket();

    // Fetch tiers to compute next requirement from current level 0
    const tiersRes = await request(app.getHttpServer()).get('/v1/bonus/vip-tiers').expect(200);
    const tiers: Array<{ level: number; wagerRequirement: string }> = tiersRes.body;
    expect(Array.isArray(tiers)).toBe(true);
    // Find the first tier above level 0 (i.e., level 1)
    const nextTier = tiers.find((t) => t.level > 0);
    expect(nextTier).toBeDefined();

    // API returns wagerRequirement in dollars as string; convert to cents (integer)
    const nextReqCents = new BigNumber(nextTier!.wagerRequirement).multipliedBy(100);

    // Choose a bet amount smaller than the next requirement (e.g., ~25% of requirement)
    const betCents = nextReqCents.multipliedBy(0.25).integerValue(BigNumber.ROUND_FLOOR);
    // Ensure at least 1 cent
    const betAmountStr = betCents.isGreaterThan(0) ? betCents.toFixed(0) : '1';

    // Prepare to capture the specific notification
    const notificationPromise: Promise<any> = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Notification timeout')), 5000);
      socket.on('notification', (envelope: any) => {
        try {
          // Envelope has shape { type: 'notification', data: { type, title, message, data }, ... }
          const n = envelope?.data;
          if (n?.type === 'vip_level_progress') {
            clearTimeout(timeout);
            resolve(n);
          }
        } catch (e) {
          // ignore and continue
        }
      });
    });

    // Emit bet.confirmed via controller
    await request(app.getHttpServer())
      .post('/v1/bonus/test/bet-confirmed')
      .send({
        userId,
        betAmount: betAmountStr,
        refundAmount: '0',
        operationId: `test-bet-${Date.now()}`,
      })
      .expect(201);

    const notification = await notificationPromise;
    expect(notification).toBeDefined();

    // Calculate expected percentage: (currentWager - prevReq) / (nextReq - prevReq) * 100, here prevReq=0
    const expectedPercent = betCents.dividedBy(nextReqCents).multipliedBy(100).toFixed(2);

    expect(notification.data).toBeDefined();
    expect(notification.data.progressPercents).toBe(expectedPercent);
  });
});
