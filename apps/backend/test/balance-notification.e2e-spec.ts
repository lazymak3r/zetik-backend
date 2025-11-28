import { AssetTypeEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BigNumber } from 'bignumber.js';
import { io, Socket } from 'socket.io-client';
import { BalanceModule } from '../src/balance/balance.module';
import { BalanceService } from '../src/balance/balance.service';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { AppDataSource } from '../src/data-source';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';
import { WebSocketModule } from '../src/websocket/websocket.module';

describe('Balance Notifications (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let socket: Socket;
  let accessToken: string;
  const logger = new Logger('BalanceNotificationE2E');

  // Test user
  const testUser = {
    id: '',
    email: `balance-notification-test${Date.now()}@example.com`,
    username: `balance-notification-tester${Date.now()}`,
    password: 'Secret123',
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig],
          }),
          UsersModule,
          BalanceModule,
          WebSocketModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();
      await app.listen(0); // Use a random port

      // Get the JWT service to create tokens
      jwtService = app.get<JwtService>(JwtService);

      // Get the UsersService to create a test user
      const usersService = app.get<UsersService>(UsersService);

      // Create a test user
      const user = await usersService.createWithEmail(
        testUser.email,
        testUser.username,
        testUser.password,
      );

      testUser.id = user.id;

      // Create a JWT token for the test user
      accessToken = jwtService.sign(
        { sub: testUser.id, email: testUser.email },
        { secret: authConfig().secret, expiresIn: '1h' },
      );

      logger.log('Test setup complete');
    } catch (error) {
      logger.error('Test setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  beforeEach((done) => {
    const port = app.getHttpServer().address().port;
    socket = io(`http://localhost:${port}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('connected', (data) => {
      expect(data).toBeDefined();
      expect(data.userId).toBe(testUser.id);
      socket.removeAllListeners('error');
      done();
    });

    socket.on('error', (err) => {
      done(`Connection failed: ${JSON.stringify(err)}`);
    });
  });

  afterEach(() => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  it('should receive a notification when a deposit is made', (done) => {
    // Listen for the notification event
    socket.on('notification', (notification) => {
      try {
        expect(notification).toBeDefined();
        expect(notification.type).toBe('notification');
        expect(notification.data).toBeDefined();
        expect(notification.data.type).toBe('balance_update');
        expect(notification.data.data).toBeDefined();
        expect(notification.data.data.operation).toBe(BalanceOperationEnum.DEPOSIT);
        expect(notification.data.data.asset).toBe(AssetTypeEnum.BTC);
        expect(notification.data.data.amount).toBe('100');
        expect(notification.data.data.newBalance).toBeDefined();
        done();
      } catch (error) {
        done(`Error: ${error}`);
      }
    });

    // Get the BalanceService from the application
    const balanceService = app.get<BalanceService>(BalanceService);

    // Make a deposit by calling updateBalance directly
    balanceService
      .updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: `test-deposit-${Date.now()}`,
        userId: testUser.id,
        amount: new BigNumber(100),
        asset: AssetTypeEnum.BTC,
        description: 'Test deposit for WebSocket notification',
      })
      .then((result) => {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      })
      .catch((error) => {
        done(`Failed to make deposit: ${error}`);
      });
  });

  it('should handle ping/pong for connection keep-alive', (done) => {
    socket.emit('ping');

    socket.on('pong', (data) => {
      try {
        expect(data).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(data.userId).toBe(testUser.id);
        done();
      } catch (error) {
        done(`Error: ${error}`);
      }
    });

    socket.on('error', (err) => {
      done(`Ping/pong failed: ${JSON.stringify(err)}`);
    });
  });
});
