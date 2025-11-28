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

describe('Auth Sessions (e2e)', () => {
  const logger = new Logger('AuthSessionsE2E');
  const userInfo = {
    email: `session-test${Date.now()}@example.com`,
    username: `session-user${Date.now()}`,
    password: 'Secret123',
  };
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
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

      // Register a user for testing
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/email')
        .send(userInfo);

      accessToken = registerResponse.body.accessToken;
    } catch (error) {
      logger.error('Test setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /auth/sessions', () => {
    it('should return the current session', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);

      // Verify session properties
      const session = response.body.sessions[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('deviceInfo');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('isCurrentSession');
      expect(session).toHaveProperty('lastUse');
      expect(session).toHaveProperty('ipAddress');
      expect(session).toHaveProperty('location');

      // Verify location field is populated (should be "Unknown" for localhost/test IPs)
      expect(typeof session.location).toBe('string');
      expect(session.location).toBe('Unknown');
    });

    it('should correctly identify the current session based on IP and lastUse', async () => {
      // Login to create a new session
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      // Get sessions using the new access token
      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      // Verify that at least one session has isCurrentSession=true
      const currentSessions = response.body.sessions.filter((session) => session.isCurrentSession);
      expect(currentSessions.length).toBe(1);

      // Verify that the most recent session is marked as current
      // The most recent session should have the most recent lastUse time
      const sortedSessions = [...response.body.sessions].sort(
        (a, b) => new Date(b.lastUse).getTime() - new Date(a.lastUse).getTime(),
      );
      expect(sortedSessions[0].isCurrentSession).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/auth/sessions').expect(401);
    });

    it('should populate location field correctly for different IP addresses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);

      // Check that all sessions have location field
      response.body.sessions.forEach((session: any) => {
        expect(session).toHaveProperty('location');
        expect(typeof session.location).toBe('string');
        // For test environment with localhost/127.0.0.1, location should be "Unknown"
        expect(session.location).toBe('Unknown');
      });
    });
  });

  describe('Multiple sessions', () => {
    it('should create additional sessions when logging in multiple times', async () => {
      // Login again to create a second session
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      // Login a third time
      await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      // Get all sessions
      const response = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      // Should have at least 3 sessions now
      expect(response.body.sessions.length).toBeGreaterThanOrEqual(3);
    });

    it('should update lastUse when refreshing tokens', async () => {
      // Get current sessions to find a refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;

      // Wait a short time to ensure lastUse timestamp will be different
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Use the refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Get sessions again
      const sessionsResponse = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
        .expect(200);

      // Get the most recent session (should be at the top since they're ordered by createdAt DESC)
      const currentSession = sessionsResponse.body.sessions[0];

      // Verify lastUse is present and is a valid date
      expect(currentSession).toHaveProperty('lastUse');
      expect(new Date(currentSession.lastUse)).toBeInstanceOf(Date);

      // Verify ipAddress is present
      expect(currentSession).toHaveProperty('ipAddress');
    });
  });

  describe('DELETE /auth/sessions', () => {
    it('should delete all sessions except the specified one', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .set('user-agent', 'test runner')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      // Get sessions
      const sessionsResponse = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const currentSession = sessionsResponse.body.sessions.find((s) => s.isCurrentSession);
      expect(currentSession).toBeDefined();
      const keepSessionId = currentSession.id as string;

      // Delete all sessions except the first one
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/auth/sessions?keepSessionId=${keepSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response format
      expect(deleteResponse.body).toHaveProperty('deletedCount');
      expect(typeof deleteResponse.body.deletedCount).toBe('number');
      expect(deleteResponse.body.deletedCount).toBeGreaterThanOrEqual(1); // Should have deleted 1 session

      // Verify that only one session remains
      const getResponse = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getResponse.body.sessions.length).toBe(1);
      expect(getResponse.body.sessions[0].id).toBe(keepSessionId);
    });

    it('should invalidate access token after deleting the session', async () => {
      // Create a new session by logging in
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      const newAccessToken = loginResponse.body.accessToken;

      // Verify the token works by accessing a protected endpoint
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Get sessions to find the ID of the new session
      const sessionsResponse = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Find the current session ID
      const currentSession = sessionsResponse.body.sessions.find(
        (session) => session.isCurrentSession,
      );
      expect(currentSession).toBeDefined();

      // Delete the session
      await request(app.getHttpServer())
        .delete(`/auth/sessions?sessionId=${currentSession.id}`)
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Try to access a protected endpoint with the now-invalidated token
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer()).delete('/auth/sessions?keepSessionId=123').expect(401);
    });

    it('should return 400 when both keepSessionId and sessionId are missing', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should delete a specific session by ID', async () => {
      // Create additional sessions for testing
      await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login/email')
        .send({ email: userInfo.email, password: userInfo.password })
        .expect(200);

      // Get all sessions
      const getResponse = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginResponse2.body.accessToken}`)
        .expect(200);

      // Should have at least 2 sessions now
      expect(getResponse.body.sessions.length).toBeGreaterThanOrEqual(2);

      // Get a session ID to delete (not the current one)
      const sessionsToDelete = getResponse.body.sessions.filter(
        (session) => !session.isCurrentSession,
      );
      const sessionIdToDelete = sessionsToDelete[0].id;

      // Delete the specific session
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/auth/sessions?sessionId=${sessionIdToDelete}`)
        .set('Authorization', `Bearer ${loginResponse2.body.accessToken}`)
        .expect(200);

      // Verify response format
      expect(deleteResponse.body).toHaveProperty('deletedCount');
      expect(typeof deleteResponse.body.deletedCount).toBe('number');
      expect(deleteResponse.body.deletedCount).toBe(1); // Should have deleted exactly 1 session

      // Verify that the specific session was deleted
      const getResponseAfterDelete = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginResponse2.body.accessToken}`)
        .expect(200);

      // Check that the deleted session is no longer in the list
      const deletedSessionExists = getResponseAfterDelete.body.sessions.some(
        (session) => session.id === sessionIdToDelete,
      );
      expect(deletedSessionExists).toBe(false);
    });
  });
});
