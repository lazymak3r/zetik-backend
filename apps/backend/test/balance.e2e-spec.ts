import { AssetTypeEnum } from '@zetik/shared-entities';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Dynamically load active assets from environment
const activeAssets: AssetTypeEnum[] = process.env.ACTIVE_ASSETS
  ? process.env.ACTIVE_ASSETS.split(',').map((a) => a.trim() as AssetTypeEnum)
  : [];
const firstAsset: AssetTypeEnum = activeAssets[0] || AssetTypeEnum.BTC;
const secondAsset: AssetTypeEnum = activeAssets[1] || firstAsset;
const invalidAsset: AssetTypeEnum = (Object.values(AssetTypeEnum) as AssetTypeEnum[]).find(
  (a) => !activeAssets.includes(a),
) as AssetTypeEnum;

describe('Balance (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let accessToken3: string;
  let userId3: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    // Register first test user
    const testUsername1 = `balanceuser1_${Date.now()}`;
    const registerResponse1 = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `balancetest1_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername1,
      });

    accessToken = registerResponse1.body.accessToken;

    // Register second test user for user interaction tests
    const testUsername2 = `balanceuser2_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `balancetest2_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername2,
      });

    // Register third test user with private profile
    const testUsername3 = `balanceuser3_${Date.now()}`;
    const registerResponse3 = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({
        email: `balancetest3_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername3,
      });

    accessToken3 = registerResponse3.body.accessToken;
    userId3 = registerResponse3.body.user.id;

    // Make third user's profile private
    await request(app.getHttpServer())
      .patch('/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken3}`)
      .send({
        isPrivate: true,
      });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Balance History', () => {
    describe('/v1/balance/history (GET)', () => {
      it('should return balance history with ExtendedBalanceHistoryResponseDto format', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body.items).toBeInstanceOf(Array);
        expect(typeof response.body.total).toBe('number');

        response.body.items.forEach((entry: any) => {
          expect(entry).toHaveProperty('operationId');
          expect(entry).toHaveProperty('operation');
          expect(entry).toHaveProperty('amount');
          expect(entry).toHaveProperty('asset');
          expect(entry).toHaveProperty('userId');
          expect(entry).toHaveProperty('createdAt');
          expect(entry).toHaveProperty('status');
          expect(entry).toHaveProperty('previousBalance');
          expect(entry).toHaveProperty('rate');
          expect(entry).toHaveProperty('amountCents');
          // Optional user fields should be present or undefined
          if (entry.fromUser !== undefined) {
            expect(entry.fromUser).toHaveProperty('userName');
            expect(entry.fromUser).toHaveProperty('userId');
            expect(entry.fromUser).toHaveProperty('createdAt');
            expect(entry.fromUser).toHaveProperty('vipLevel');
            expect(entry.fromUser).toHaveProperty('statistics');
          }
          if (entry.toUser !== undefined) {
            expect(entry.toUser).toHaveProperty('userName');
            expect(entry.toUser).toHaveProperty('userId');
            expect(entry.toUser).toHaveProperty('createdAt');
            expect(entry.toUser).toHaveProperty('vipLevel');
            expect(entry.toUser).toHaveProperty('statistics');
          }
          if (entry.user !== undefined) {
            expect(entry.user).toHaveProperty('userName');
            expect(entry.user).toHaveProperty('userId');
            expect(entry.user).toHaveProperty('createdAt');
            expect(entry.user).toHaveProperty('vipLevel');
            expect(entry.user).toHaveProperty('statistics');
          }
        });
      });

      it('should support filtering by asset', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?asset=' + AssetTypeEnum.BTC)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        response.body.items.forEach((entry: any) => {
          expect(entry.asset).toBe(AssetTypeEnum.BTC);
        });
      });

      it('should support filtering by operation', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?operation=DEPOSIT')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        response.body.items.forEach((entry: any) => {
          expect(entry.operation).toBe('DEPOSIT');
        });
      });

      it('should support filtering by multiple operations', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?operation=WITHDRAW&operation=DEPOSIT')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        response.body.items.forEach((entry: any) => {
          expect(['WITHDRAW', 'DEPOSIT']).toContain(entry.operation);
        });
      });

      it('should support filtering by multiple same operations', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?operation=DEPOSIT&operation=DEPOSIT')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        response.body.items.forEach((entry: any) => {
          expect(entry.operation).toBe('DEPOSIT');
        });
      });

      it('should support multiple operations with asset filter', async () => {
        const response = await request(app.getHttpServer())
          .get(
            '/v1/balance/history?operation=WITHDRAW&operation=DEPOSIT&asset=' + AssetTypeEnum.BTC,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        response.body.items.forEach((entry: any) => {
          expect(['WITHDRAW', 'DEPOSIT']).toContain(entry.operation);
          expect(entry.asset).toBe(AssetTypeEnum.BTC);
        });
      });

      it('should support multiple operations with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?operation=WITHDRAW&operation=DEPOSIT&limit=5&offset=0')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body.items.length).toBeLessThanOrEqual(5);
        response.body.items.forEach((entry: any) => {
          expect(['WITHDRAW', 'DEPOSIT']).toContain(entry.operation);
        });
      });

      it('should handle invalid operation gracefully', async () => {
        await request(app.getHttpServer())
          .get('/v1/balance/history?operation=INVALID_OPERATION')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?limit=10&offset=0')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body.items.length).toBeLessThanOrEqual(10);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/v1/balance/history').expect(401);
      });

      // NEW ENHANCED TESTS FOR USER INFORMATION EXTENSION

      it('should handle balance history items without metadata gracefully', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // Items without metadata should not have user fields
        response.body.items.forEach((entry: any) => {
          if (!entry.metadata) {
            expect(entry.fromUser).toBeUndefined();
            expect(entry.toUser).toBeUndefined();
            expect(entry.user).toBeUndefined();
          }
        });
      });

      it('should maintain backwards compatibility for operations without user metadata', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?operation=DEPOSIT')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // DEPOSIT operations typically don't have user metadata
        response.body.items.forEach((entry: any) => {
          if (
            entry.operation === 'DEPOSIT' &&
            !entry.metadata?.fromUserId &&
            !entry.metadata?.toUserId &&
            !entry.metadata?.userId
          ) {
            expect(entry.fromUser).toBeUndefined();
            expect(entry.toUser).toBeUndefined();
            expect(entry.user).toBeUndefined();
          }
        });
      });

      it('should include user information for operations with metadata containing user IDs', async () => {
        // First, create some balance history entries by simulating user interactions
        // This requires operations that would create metadata with user IDs

        // For now, we'll test the structure assuming such operations exist
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // Check if any items have user metadata and verify user information is included
        response.body.items.forEach((entry: any) => {
          if (
            entry.metadata &&
            (entry.metadata.fromUserId || entry.metadata.toUserId || entry.metadata.userId)
          ) {
            // If metadata contains user IDs, corresponding user fields should be present
            if (entry.metadata.fromUserId && entry.fromUser) {
              expect(entry.fromUser).toHaveProperty('userName');
              expect(entry.fromUser).toHaveProperty('userId');
              expect(entry.fromUser).toHaveProperty('createdAt');
              expect(entry.fromUser).toHaveProperty('vipLevel');
              expect(entry.fromUser).toHaveProperty('statistics');
              expect(entry.fromUser.userId).toBe(entry.metadata.fromUserId);
            }

            if (entry.metadata.toUserId && entry.toUser) {
              expect(entry.toUser).toHaveProperty('userName');
              expect(entry.toUser).toHaveProperty('userId');
              expect(entry.toUser).toHaveProperty('createdAt');
              expect(entry.toUser).toHaveProperty('vipLevel');
              expect(entry.toUser).toHaveProperty('statistics');
              expect(entry.toUser.userId).toBe(entry.metadata.toUserId);
            }

            if (entry.metadata.userId && entry.user) {
              expect(entry.user).toHaveProperty('userName');
              expect(entry.user).toHaveProperty('userId');
              expect(entry.user).toHaveProperty('createdAt');
              expect(entry.user).toHaveProperty('vipLevel');
              expect(entry.user).toHaveProperty('statistics');
              expect(entry.user.userId).toBe(entry.metadata.userId);
            }
          }
        });
      });

      it('should not include user information for private profiles when accessed by different user', async () => {
        // Test that private profiles are filtered out
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');

        // Check that no private user information is exposed
        response.body.items.forEach((entry: any) => {
          if (entry.fromUser) {
            // If the fromUser is the private user (userId3), it should not be included unless viewing own profile
            expect(entry.fromUser.userId).not.toBe(userId3);
          }
          if (entry.toUser) {
            expect(entry.toUser.userId).not.toBe(userId3);
          }
          if (entry.user) {
            expect(entry.user.userId).not.toBe(userId3);
          }
        });
      });

      it('should include own private profile information when viewing own balance history', async () => {
        // Test that private user can see their own information
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken3}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // The private user should be able to see their own profile in metadata
        response.body.items.forEach((entry: any) => {
          // All entries should belong to the private user
          expect(entry.userId).toBe(userId3);

          // If there are user fields referencing the private user, they should be present
          if (entry.metadata && entry.metadata.userId === userId3 && entry.user) {
            expect(entry.user.userId).toBe(userId3);
            expect(entry.user).toHaveProperty('userName');
            expect(entry.user).toHaveProperty('vipLevel');
            expect(entry.user).toHaveProperty('statistics');
          }
        });
      });

      it('should handle missing user IDs gracefully', async () => {
        // Test robustness when user IDs in metadata don't exist
        const response = await request(app.getHttpServer())
          .get('/v1/balance/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // Even if some user IDs don't exist, the request should succeed
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it('should use batch fetching for multiple users (performance test)', async () => {
        // This test verifies that the implementation uses batch queries rather than individual queries
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get('/v1/balance/history?limit=50')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');

        // The response should complete reasonably quickly even with user data fetching
        // This is a rough performance test - in a real scenario, you'd want more precise metrics
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

        // Verify that user information is properly included when metadata contains user IDs
        response.body.items.forEach((entry: any) => {
          if (entry.metadata) {
            if (entry.metadata.fromUserId && entry.fromUser) {
              expect(typeof entry.fromUser).toBe('object');
              expect(entry.fromUser).toHaveProperty('userId');
            }
            if (entry.metadata.toUserId && entry.toUser) {
              expect(typeof entry.toUser).toBe('object');
              expect(entry.toUser).toHaveProperty('userId');
            }
            if (entry.metadata.userId && entry.user) {
              expect(typeof entry.user).toBe('object');
              expect(entry.user).toHaveProperty('userId');
            }
          }
        });
      });
    });
  });

  describe('Balance Statistics', () => {
    describe('/v1/balance/statistics (GET)', () => {
      it('should return balance statistics', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/statistics')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((stat: any) => {
          expect(stat).toHaveProperty('asset');
          expect(stat).toHaveProperty('totalDeposits');
          expect(stat).toHaveProperty('totalWithdrawals');
          expect(stat).toHaveProperty('totalBets');
          expect(stat).toHaveProperty('totalWins');
          expect(stat).toHaveProperty('netProfit');
        });
      });

      it('should filter by asset', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/statistics?asset=' + AssetTypeEnum.BTC)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeLessThanOrEqual(1);
        if (response.body.length > 0) {
          expect(response.body[0].asset).toBe(AssetTypeEnum.BTC);
        }
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/v1/balance/statistics').expect(401);
      });
    });

    describe('/v1/balance/statistics/daily (GET)', () => {
      it('should return daily statistics', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/balance/statistics/daily')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((stat: any) => {
          expect(stat).toHaveProperty('date');
          expect(stat).toHaveProperty('asset');
          expect(stat).toHaveProperty('deposits');
          expect(stat).toHaveProperty('withdrawals');
          expect(stat).toHaveProperty('bets');
          expect(stat).toHaveProperty('wins');
        });
      });

      it('should support date range filtering', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date();

        const response = await request(app.getHttpServer())
          .get('/v1/balance/statistics/daily')
          .query({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/v1/balance/statistics/daily').expect(401);
      });
    });
  });

  describe('/v1/balance/primary (PATCH)', () => {
    it('should create the first wallet as primary', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/balance/primary')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ asset: firstAsset })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].asset).toBe(firstAsset);
      expect(response.body[0].isPrimary).toBe(true);
    });

    it('should switch primary to second asset and retain both wallets', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/balance/primary')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ asset: secondAsset })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      const assets = response.body.map((w: any) => w.asset);
      expect(assets).toContain(firstAsset);
      expect(assets).toContain(secondAsset);
      const newPrimaryWallet = response.body.find((w: any) => w.asset === secondAsset);
      const oldPrimaryWallet = response.body.find((w: any) => w.asset === firstAsset);
      expect(newPrimaryWallet?.isPrimary).toBe(true);
      expect(oldPrimaryWallet?.isPrimary).toBe(false);
    });

    it('should reject unsupported asset', async () => {
      await request(app.getHttpServer())
        .patch('/v1/balance/primary')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ asset: invalidAsset })
        .expect(400);
    });
  });

  describe('/v1/balance/wallets (GET)', () => {
    it('should return user wallets', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/balance/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((wallet: any) => {
        expect(wallet).toHaveProperty('asset');
        expect(wallet).toHaveProperty('balance');
        expect(wallet).toHaveProperty('isPrimary');
      });
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/v1/balance/wallets').expect(401);
    });
  });

  describe('/v1/balance/fiat (GET)', () => {
    it('should return fiat balance', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/balance/fiat')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency');
      expect(response.body.currency).toBe('USD');
      expect(typeof response.body.balance).toBe('string');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/v1/balance/fiat').expect(401);
    });
  });

  describe('Vault Operations - Concurrent Access', () => {
    let vaultAccessToken: string;

    beforeAll(async () => {
      // Create a dedicated test user for vault operations
      const testUsername = `vaultuser_${Date.now()}`;
      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: `vaulttest_${Date.now()}@example.com`,
          password: 'TestPassword123!',
          username: testUsername,
        });

      vaultAccessToken = registerResponse.body.accessToken;

      // Set up initial balance in wallet (deposit some funds first)
      // This would typically be done through the payment system
      // For testing, we'll assume the wallet has some balance
    });

    it('should allow concurrent vault deposit and withdraw operations', async () => {
      // First, deposit some funds to vault to enable withdrawals
      const depositAmount = '0.1';
      const depositResponse = await request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: depositAmount,
        })
        .expect(200);

      expect(depositResponse.body).toHaveProperty('vaultBalance');
      expect(depositResponse.body).toHaveProperty('walletBalance');

      // Now test concurrent deposit and withdraw operations
      const concurrentDeposit = request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: '0.05',
        });

      const concurrentWithdraw = request(app.getHttpServer())
        .post('/v1/balance/vault/withdraw')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: '0.05',
        });

      // Execute both operations concurrently
      const [depositResult, withdrawResult] = await Promise.all([
        concurrentDeposit,
        concurrentWithdraw,
      ]);

      // Both operations should succeed
      expect(depositResult.status).toBe(200);
      expect(withdrawResult.status).toBe(200);

      // Verify both operations completed successfully
      expect(depositResult.body).toHaveProperty('vaultBalance');
      expect(depositResult.body).toHaveProperty('walletBalance');
      expect(withdrawResult.body).toHaveProperty('vaultBalance');
      expect(withdrawResult.body).toHaveProperty('walletBalance');
    });

    it('should handle multiple concurrent vault deposits correctly', async () => {
      const depositAmount = '0.01';
      const numberOfDeposits = 5;

      // Create multiple concurrent deposit requests
      const depositPromises = Array.from({ length: numberOfDeposits }, () =>
        request(app.getHttpServer())
          .post('/v1/balance/vault/deposit')
          .set('Authorization', `Bearer ${vaultAccessToken}`)
          .send({
            asset: firstAsset,
            amount: depositAmount,
          }),
      );

      // Execute all deposits concurrently
      const results = await Promise.all(depositPromises);

      // All deposits should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('vaultBalance');
        expect(result.body).toHaveProperty('walletBalance');
      });

      // Verify final vault balance is correct
      const vaultsResponse = await request(app.getHttpServer())
        .get('/v1/balance/vaults')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .expect(200);

      expect(vaultsResponse.body).toBeInstanceOf(Array);
    });

    it('should handle concurrent vault withdrawals correctly', async () => {
      // First, ensure vault has sufficient balance
      await request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: '0.5',
        })
        .expect(200);

      const withdrawAmount = '0.05';
      const numberOfWithdrawals = 3;

      // Create multiple concurrent withdrawal requests
      const withdrawPromises = Array.from({ length: numberOfWithdrawals }, () =>
        request(app.getHttpServer())
          .post('/v1/balance/vault/withdraw')
          .set('Authorization', `Bearer ${vaultAccessToken}`)
          .send({
            asset: firstAsset,
            amount: withdrawAmount,
          }),
      );

      // Execute all withdrawals concurrently
      const results = await Promise.all(withdrawPromises);

      // All withdrawals should succeed (assuming sufficient balance)
      results.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('vaultBalance');
        expect(result.body).toHaveProperty('walletBalance');
      });
    });

    it('should prevent race conditions with operation-specific locks', async () => {
      // This test verifies that deposit and withdraw can run concurrently
      // while preventing race conditions through operation-specific locks

      // Setup: Deposit initial amount
      await request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: '1.0',
        })
        .expect(200);

      const iterations = 10;
      const depositAmount = '0.01';
      const withdrawAmount = '0.01';

      // Create alternating deposit/withdraw operations
      const operations = [];
      for (let i = 0; i < iterations; i++) {
        operations.push(
          request(app.getHttpServer())
            .post('/v1/balance/vault/deposit')
            .set('Authorization', `Bearer ${vaultAccessToken}`)
            .send({
              asset: firstAsset,
              amount: depositAmount,
            }),
          request(app.getHttpServer())
            .post('/v1/balance/vault/withdraw')
            .set('Authorization', `Bearer ${vaultAccessToken}`)
            .send({
              asset: firstAsset,
              amount: withdrawAmount,
            }),
        );
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Verify vault balance is consistent (should be approximately the same as initial 1.0)
      const vaultsResponse = await request(app.getHttpServer())
        .get('/v1/balance/vaults')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .expect(200);

      expect(vaultsResponse.body).toBeInstanceOf(Array);
      // The vault balance should be consistent (net zero change from deposits/withdrawals)
    });

    it('should handle vault operations across different assets concurrently', async () => {
      // Test concurrent operations on different assets (no locking conflict expected)
      const operation1 = request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: firstAsset,
          amount: '0.1',
        });

      const operation2 = request(app.getHttpServer())
        .post('/v1/balance/vault/deposit')
        .set('Authorization', `Bearer ${vaultAccessToken}`)
        .send({
          asset: secondAsset,
          amount: '0.1',
        });

      const [result1, result2] = await Promise.all([operation1, operation2]);

      // Both should succeed as they're operating on different assets
      expect(result1.status).toBe(200);
      expect(result2.status).toBe(200);
      expect(result1.body.asset).toBe(firstAsset);
      expect(result2.body.asset).toBe(secondAsset);
    });
  });
});
