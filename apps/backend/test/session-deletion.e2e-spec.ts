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

describe('Session Deletion (e2e)', () => {
  let app: INestApplication;
  const logger = new Logger('SessionDeletionE2E');
  let tokens: { accessToken: string; refreshToken: string; tokenId: string };
  let sessionId: number;

  beforeAll(async () => {
    // Set required env vars for tests
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

  afterAll(async () => {
    await app.close();
  });

  describe('Session deletion test', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send({
          email: `session-test${Date.now()}@example.com`,
          username: `sessionuser${Date.now()}`,
          password: 'Secret123',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('tokenId');

      tokens = res.body;
    });

    it('should be able to access protected endpoint with valid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
    });

    it('should get user sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('sessions');
      expect(res.body.sessions.length).toBeGreaterThan(0);
      expect(res.body.sessions[0]).toHaveProperty('id');

      // Store the session ID for later deletion
      sessionId = res.body.sessions[0].id;
    });

    it('should delete the session', async () => {
      await request(app.getHttpServer())
        .delete(`/auth/sessions?sessionId=${sessionId}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);
    });

    it('should return 401 when trying to access protected endpoint after session deletion', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(401);
    });

    it('should return 401 when trying to refresh token after session deletion', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });
});
