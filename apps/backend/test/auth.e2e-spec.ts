import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { mailConfig } from '../src/config/mail.config';
import { AppDataSource } from '../src/data-source';

// Mock Mailgun SDK for e2e tests
const mailgunCreateMock = jest.fn();
jest.mock('mailgun.js', () =>
  jest.fn().mockImplementation(() => ({
    client: () => ({ messages: { create: mailgunCreateMock } }),
  })),
);

describe('AuthController (e2e)', () => {
  const logger = new Logger('AuthE2E');
  const user1 = {
    email: `user${Date.now()}@example.com`,
    username: `userOne${Date.now()}`,
    password: 'Secret123',
  };
  const user2 = {
    email: `usertwo${Date.now()}@example.com`,
    username: `userTwo${Date.now()}`,
    password: 'Secret123',
  };
  let app: INestApplication;
  let tokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    // Set required MAIL env vars for tests
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'test.mailgun.org';
    process.env.MAILGUN_FROM = 'no-reply@test.mailgun.org';
    process.env.MAILGUN_BASE_URL = 'https://api.mailgun.net';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.EMAIL_VERIFICATION_EXPIRATION = '3600';
    process.env.PASSWORD_RESET_EXPIRATION = '900';
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          AuthModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig, mailConfig],
          }),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      logger.error('Test setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(() => {
    // no-op cleanup
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register/email', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send(user1)
        .expect(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 409 when email already exists', async () => {
      await request(app.getHttpServer()).post('/auth/register/email').send(user1).expect(409);
    });
  });

  describe('POST /auth/login/email', () => {
    it('should login successfully with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: user1.email, password: user1.password })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      tokens = res.body;
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: user1.email, password: 'WrongPass' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200)
        .expect({ success: true, message: 'Logged out successfully' });
    });

    it('should reject refresh after logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/verify-email/request', () => {
    beforeAll(() => {
      mailgunCreateMock.mockReset();
      mailgunCreateMock.mockResolvedValue({ id: 'test', message: 'Queued. Thank you.' });
    });

    it('should send verification email', async () => {
      await request(app.getHttpServer()).post('/auth/register/email').send(user2).expect(201);
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email/request')
        .send({ email: user2.email })
        .expect(201);
      expect(res.body).toEqual({ message: 'Verification email sent' });
      expect(mailgunCreateMock).toHaveBeenCalled();
    });

    it('should return 403 Access denied when Mailgun forbidden', async () => {
      mailgunCreateMock.mockRejectedValue({
        status: 401,
        message: 'Unauthorized',
        details: 'Forbidden',
      });
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email/request')
        .send({ email: user2.email })
        .expect(401);
      expect(res.body).toEqual({ status: 401, message: 'Unauthorized', details: 'Forbidden' });
    });
  });

  describe('POST /auth/password-reset/request', () => {
    beforeAll(() => {
      mailgunCreateMock.mockReset();
      mailgunCreateMock.mockResolvedValue({ id: 'reset', message: 'Queued. Thank you.' });
    });
    it('should send password reset email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/password-reset/request')
        .send({ email: user1.email })
        .expect(201);
      expect(res.body).toEqual({ message: 'Password reset email sent' });
      expect(mailgunCreateMock).toHaveBeenCalled();
    });

    it('should return 403 Access denied when Mailgun forbidden', async () => {
      mailgunCreateMock.mockRejectedValue({
        status: 401,
        message: 'Unauthorized',
        details: 'Forbidden',
      });
      const res = await request(app.getHttpServer())
        .post('/auth/password-reset/request')
        .send({ email: user1.email })
        .expect(401);
      expect(res.body).toEqual({ status: 401, message: 'Unauthorized', details: 'Forbidden' });
    });
  });
});
