import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationService } from '../src/websocket/services/notification.service';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let secondAccessToken: string;
  let secondUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    // Register first test user
    const testUsername1 = `notificationuser1_${Date.now()}`;
    const registerResponse1 = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `notificationtest1_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername1,
      });

    accessToken = registerResponse1.body.accessToken;
    userId = registerResponse1.body.user.id;

    // Register second test user
    const testUsername2 = `notificationuser2_${Date.now()}`;
    const registerResponse2 = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `notificationtest2_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername2,
      });

    secondAccessToken = registerResponse2.body.accessToken;
    secondUserId = registerResponse2.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/notifications', () => {
    it('should return empty notifications list for new user', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('unreadCount');

      expect(response.body.notifications).toBeInstanceOf(Array);
      expect(response.body.notifications.length).toBe(0);
      expect(response.body.total).toBe(0);
      expect(response.body.page).toBe(1);
      expect(response.body.totalPages).toBe(0);
      expect(response.body.unreadCount).toBe(0);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .query({ page: 2, limit: 5 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.page).toBe(2);
    });

    it('should validate pagination parameters', async () => {
      await request(app.getHttpServer())
        .get('/v1/notifications')
        .query({ page: 0 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/v1/notifications')
        .query({ limit: 101 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/v1/notifications')
        .query({ page: 'invalid' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/v1/notifications').expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /v1/notifications/:id/read', () => {
    it('should return 404 for non-existent notification', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';
      await request(app.getHttpServer())
        .patch(`/v1/notifications/${nonExistentId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should validate UUID format', async () => {
      await request(app.getHttpServer())
        .patch('/v1/notifications/invalid-uuid/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      const validId = '12345678-1234-1234-1234-123456789012';
      await request(app.getHttpServer()).patch(`/v1/notifications/${validId}/read`).expect(401);
    });
  });

  describe('PATCH /v1/notifications/read-all', () => {
    it('should mark all notifications as read successfully', async () => {
      await request(app.getHttpServer())
        .patch('/v1/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).patch('/v1/notifications/read-all').expect(401);
    });
  });

  describe('DELETE /v1/notifications/:id', () => {
    it('should return 404 for non-existent notification', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';
      await request(app.getHttpServer())
        .delete(`/v1/notifications/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should validate UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/v1/notifications/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      const validId = '12345678-1234-1234-1234-123456789012';
      await request(app.getHttpServer()).delete(`/v1/notifications/${validId}`).expect(401);
    });
  });

  describe('DELETE /v1/notifications', () => {
    it('should mark all notifications as deleted successfully', async () => {
      await request(app.getHttpServer())
        .delete('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).delete('/v1/notifications').expect(401);
    });
  });

  describe('Notification Service Integration', () => {
    let notificationService: any;

    beforeAll(async () => {
      notificationService = app.get(NotificationService);
    });

    it('should save notification to database and send via WebSocket', async () => {
      const notification = {
        type: 'deposit',
        title: 'Deposit Successful',
        message: 'Your deposit of $100 has been processed successfully.',
        data: {
          amount: 100,
          currency: 'USD',
          transactionId: 'tx_123456789',
        },
      };

      // Call sendToUserAndSave method
      await notificationService.sendToUserAndSave(userId, notification);

      // Verify notification was saved by fetching user notifications
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.notifications.length).toBeGreaterThan(0);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.unreadCount).toBeGreaterThan(0);

      const savedNotification = response.body.notifications[0];
      expect(savedNotification).toHaveProperty('id');
      expect(savedNotification.type).toBe(notification.type);
      expect(savedNotification.title).toBe(notification.title);
      expect(savedNotification.message).toBe(notification.message);
      expect(savedNotification.data).toEqual(notification.data);
      expect(savedNotification.isRead).toBe(false);
      expect(savedNotification.isDeleted).toBe(false);
      expect(savedNotification).toHaveProperty('createdAt');
    });

    it('should handle withdrawal notifications', async () => {
      const notification = {
        type: 'withdrawal',
        title: 'Withdrawal Processing',
        message: 'Your withdrawal request is being processed.',
        data: {
          amount: 50,
          currency: 'USD',
          transactionId: 'tx_987654321',
        },
      };

      await notificationService.sendToUserAndSave(userId, notification);

      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const withdrawalNotification = response.body.notifications.find(
        (n: any) => n.type === 'withdrawal',
      );
      expect(withdrawalNotification).toBeDefined();
      expect(withdrawalNotification.title).toBe(notification.title);
    });

    it('should isolate notifications between users', async () => {
      const notification = {
        type: 'bonus',
        title: 'Bonus Awarded',
        message: 'You have received a bonus!',
        data: { bonusAmount: 25 },
      };

      // Send notification to second user
      await notificationService.sendToUserAndSave(secondUserId, notification);

      // First user should not see second user's notification
      const firstUserResponse = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const bonusNotifications = firstUserResponse.body.notifications.filter(
        (n: any) => n.type === 'bonus',
      );
      expect(bonusNotifications.length).toBe(0);

      // Second user should see their notification
      const secondUserResponse = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);

      const secondUserBonusNotifications = secondUserResponse.body.notifications.filter(
        (n: any) => n.type === 'bonus',
      );
      expect(secondUserBonusNotifications.length).toBe(1);
    });
  });

  describe('Notification Management Workflow', () => {
    let testNotificationId: string;

    beforeAll(async () => {
      // Create a test notification
      const notification = {
        type: 'system',
        title: 'System Maintenance',
        message: 'Scheduled maintenance will occur tonight.',
        data: { maintenanceTime: '2024-01-01T02:00:00Z' },
      };

      const { NotificationService } = await import(
        '../src/websocket/services/notification.service'
      );
      const notificationService = app.get(NotificationService);
      await notificationService.sendToUserAndSave(userId, notification);

      // Get the notification ID
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const systemNotification = response.body.notifications.find((n: any) => n.type === 'system');
      testNotificationId = systemNotification.id;
    });

    it('should mark specific notification as read', async () => {
      // Mark notification as read
      await request(app.getHttpServer())
        .patch(`/v1/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify it's marked as read
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const readNotification = response.body.notifications.find(
        (n: any) => n.id === testNotificationId,
      );
      expect(readNotification.isRead).toBe(true);
      expect(readNotification).toHaveProperty('readAt');
    });

    it('should mark specific notification as deleted', async () => {
      // Mark notification as deleted
      await request(app.getHttpServer())
        .delete(`/v1/notifications/${testNotificationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify it's no longer in the list (excluded deleted ones)
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deletedNotification = response.body.notifications.find(
        (n: any) => n.id === testNotificationId,
      );
      expect(deletedNotification).toBeUndefined();
    });

    it('should handle marking non-existent notification as read after deletion', async () => {
      // Try to mark deleted notification as read
      await request(app.getHttpServer())
        .patch(`/v1/notifications/${testNotificationId}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Bulk Operations', () => {
    beforeAll(async () => {
      // Create multiple test notifications
      const { NotificationService } = await import(
        '../src/websocket/services/notification.service'
      );
      const notificationService = app.get(NotificationService);

      for (let i = 0; i < 5; i++) {
        await notificationService.sendToUserAndSave(userId, {
          type: 'test',
          title: `Test Notification ${i + 1}`,
          message: `This is test notification number ${i + 1}`,
          data: { testIndex: i + 1 },
        });
      }
    });

    it('should mark all notifications as read', async () => {
      // Mark all as read
      await request(app.getHttpServer())
        .patch('/v1/notifications/read-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify all are read
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.unreadCount).toBe(0);
      response.body.notifications.forEach((notification: any) => {
        expect(notification.isRead).toBe(true);
      });
    });

    it('should mark all notifications as deleted', async () => {
      // Mark all as deleted
      await request(app.getHttpServer())
        .delete('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify list is empty (deleted ones are excluded)
      const response = await request(app.getHttpServer())
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.notifications.length).toBe(0);
      expect(response.body.total).toBe(0);
      expect(response.body.unreadCount).toBe(0);
    });
  });
});
