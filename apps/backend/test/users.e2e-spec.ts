import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    // Register and login to get access token
    const testUsername = `usertest_${Date.now()}`;
    const email = `usertest_${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email,
        password: 'TestPassword123!',
        username: testUsername,
      });

    const loginResponse = await request(app.getHttpServer()).post('/v1/auth/login/email').send({
      email,
      password: 'TestPassword123!',
    });

    accessToken = loginResponse.body.accessToken;
    testUserId = registerResponse.body.user?.id || loginResponse.body.user?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Profile', () => {
    describe('/v1/users/profile (GET)', () => {
      it('should return current user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('username');
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('registrationStrategy');
        expect(response.body.id).toBe(testUserId);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/v1/users/profile').expect(401);
      });
    });

    describe('/v1/users/profile (PATCH)', () => {
      it('should update display name', async () => {
        const newDisplayName = 'Test Display Name';
        const response = await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            displayName: newDisplayName,
          })
          .expect(200);

        expect(response.body).toHaveProperty('displayName');
        expect(response.body.displayName).toBe(newDisplayName);
      });

      it('should update avatar URL', async () => {
        const newAvatarUrl = 'https://example.com/avatar.png';
        const response = await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            avatarUrl: newAvatarUrl,
          })
          .expect(200);

        expect(response.body).toHaveProperty('avatarUrl');
        expect(response.body.avatarUrl).toBe(newAvatarUrl);
      });

      it('should update with empty display name (removes it)', async () => {
        const response = await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            displayName: '', // Empty display name removes it
          })
          .expect(200);

        expect(response.body).toHaveProperty('displayName', '');
      });

      it('should update email and reset verification flag', async () => {
        const newEmail = `newemail${Date.now()}@example.com`;
        const response = await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            email: newEmail,
          })
          .expect(200);

        expect(response.body).toHaveProperty('email');
        expect(response.body.email).toBe(newEmail);

        // Check that email verification was reset by trying to get email validation status
        const validationResponse = await request(app.getHttpServer())
          .get('/v1/auth/email-validation-status')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(validationResponse.body.isValidated).toBe(false);
      });

      it('should fail with duplicate email', async () => {
        // Create another user first with unique email
        const uniqueEmail = `unique${Date.now()}@example.com`;
        await request(app.getHttpServer())
          .post('/v1/auth/register/email')
          .send({
            email: uniqueEmail,
            username: `uniqueuser${Date.now()}`,
            password: 'AnotherPass123',
          })
          .expect(201);

        // Try to update current user with the other user's email
        await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            email: uniqueEmail,
          })
          .expect(409); // Conflict
      });

      // TODO: Fix email validation test - ValidationPipe config needs adjustment
      // it('should fail with invalid email format', async () => {
      //   const response = await request(app.getHttpServer())
      //     .patch('/v1/users/profile')
      //     .set('Authorization', `Bearer ${accessToken}`)
      //     .send({
      //       email: 'not-an-email',
      //     });
      //
      //   expect(response.status).toBe(400);
      //   expect(response.body.message).toContain('email');
      // });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .send({
            displayName: 'New Name',
          })
          .expect(401);
      });
    });
  });

  describe('User Search', () => {
    describe('/v1/users/search (GET)', () => {
      it('should search users by username', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/search?username=user')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((user: any) => {
          expect(user).toHaveProperty('userId');
          expect(user).toHaveProperty('userName');
          expect(user).toHaveProperty('createdAt');
          expect(user).toHaveProperty('vipLevel');
          expect(user.vipLevel).toHaveProperty('level');
          expect(user.vipLevel).toHaveProperty('name');
          expect(user.vipLevel).toHaveProperty('percent');
          // Should NOT have statistics field
          expect(user).not.toHaveProperty('statistics');
        });
      });

      it('should return empty array for no matches', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/search?username=nonexistentuser12345')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(0);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/search?username=test&limit=5&offset=0')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeLessThanOrEqual(5);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/v1/users/search?username=test').expect(401);
      });

      it('should return empty results without username parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/search')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(0);
      });
    });
  });

  describe('User Statistics', () => {
    describe('/v1/users/:id/stats (GET)', () => {
      it('should return user statistics', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/users/${testUserId}/stats`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalWagered');
        expect(response.body).toHaveProperty('totalWon');
        expect(response.body).toHaveProperty('totalLost');
        expect(response.body).toHaveProperty('gamesPlayed');
        expect(response.body).toHaveProperty('favoriteGame');
      });

      it('should fail for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/v1/users/00000000-0000-0000-0000-000000000000/stats')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get(`/v1/users/${testUserId}/stats`).expect(401);
      });
    });
  });

  describe('Public User Profile', () => {
    describe('/v1/users/public/:userId (GET)', () => {
      it('should return public user profile with VIP percent field', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/users/public/${testUserId}`)
          .expect(200);

        expect(response.body).toHaveProperty('userName');
        expect(response.body).toHaveProperty('userId');
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('vipLevel');
        expect(response.body).toHaveProperty('statistics');

        // Check VIP level structure
        expect(response.body.vipLevel).toHaveProperty('level');
        expect(response.body.vipLevel).toHaveProperty('name');
        expect(response.body.vipLevel).toHaveProperty('imageUrl');
        expect(response.body.vipLevel).toHaveProperty('percent'); // NEW FIELD

        // Validate percent field
        expect(typeof response.body.vipLevel.percent).toBe('number');
        expect(response.body.vipLevel.percent).toBeGreaterThanOrEqual(0);
        expect(response.body.vipLevel.percent).toBeLessThanOrEqual(99);

        // Check statistics structure
        expect(response.body.statistics).toHaveProperty('totalBets');
        expect(response.body.statistics).toHaveProperty('numberOfWins');
        expect(response.body.statistics).toHaveProperty('numberOfLosses');
        expect(response.body.statistics).toHaveProperty('wagered');
      });

      it('should fail for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/v1/users/public/00000000-0000-0000-0000-000000000000')
          .expect(404);
      });

      it('should fail for private profile', async () => {
        // First, make current user profile private
        await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ isPrivate: true })
          .expect(200);

        // Try to access public profile - should fail
        await request(app.getHttpServer()).get(`/v1/users/public/${testUserId}`).expect(403);

        // Reset profile to non-private for other tests
        await request(app.getHttpServer())
          .patch('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ isPrivate: false })
          .expect(200);
      });
    });
  });

  describe('Cookie Consent', () => {
    describe('POST /v1/users/accept-cookies', () => {
      it('should record cookie consent acceptance', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/users/accept-cookies')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.acceptedAt).toBeDefined();

        // Verify it persisted in profile
        const profile = await request(app.getHttpServer())
          .get('/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(profile.body.cookieConsentAcceptedAt).toBeDefined();
        expect(new Date(profile.body.cookieConsentAcceptedAt)).toBeInstanceOf(Date);
      });

      it('should be idempotent - only set once', async () => {
        // Create new user for this test to ensure fresh state
        const testUsername = `cookietest_${Date.now()}`;
        const email = `cookietest_${Date.now()}@example.com`;
        const registerResponse = await request(app.getHttpServer())
          .post('/v1/auth/register/email')
          .send({
            email,
            password: 'TestPassword123!',
            username: testUsername,
          })
          .expect(201);

        const loginResponse = await request(app.getHttpServer())
          .post('/v1/auth/login/email')
          .send({
            email,
            password: 'TestPassword123!',
          })
          .expect(200);

        const token = loginResponse.body.accessToken;

        // First call
        await request(app.getHttpServer())
          .post('/v1/users/accept-cookies')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const profile1 = await request(app.getHttpServer())
          .get('/v1/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const firstTimestamp = profile1.body.cookieConsentAcceptedAt;

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Second call - should not update timestamp
        await request(app.getHttpServer())
          .post('/v1/users/accept-cookies')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const profile2 = await request(app.getHttpServer())
          .get('/v1/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(profile2.body.cookieConsentAcceptedAt).toBe(firstTimestamp);
      });

      it('should require authentication', async () => {
        await request(app.getHttpServer()).post('/v1/users/accept-cookies').expect(401);
      });

      it('should include consent in public profile response', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/users/accept-cookies')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.acceptedAt).toBeDefined();

        const publicProfile = await request(app.getHttpServer())
          .get(`/v1/users/public/${testUserId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(publicProfile.body.cookieConsentAcceptedAt).toBeDefined();
        expect(typeof publicProfile.body.cookieConsentAcceptedAt).toBe('string');
      });
    });
  });
});
