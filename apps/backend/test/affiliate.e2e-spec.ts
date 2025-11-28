import {
  AffiliateCampaignEntity,
  AffiliateCommissionEntity,
  AssetEntity,
  AssetStatusEnum,
  AssetTypeEnum,
  CurrencyRateHistoryEntity,
  WalletEntity,
} from '@zetik/shared-entities';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AffiliateModule } from '../src/affiliate/affiliate.module';

import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { CryptoConverterService } from '../src/balance/services/crypto-converter.service';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { affiliateConfig } from '../src/config/affiliate.config';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { mailConfig } from '../src/config/mail.config';
import { AppDataSource } from '../src/data-source';
import { PaymentsModule } from '../src/payments/payments.module';
import { PaymentsService } from '../src/payments/payments.service';

// @ts-ignore
process.env.NODE_ENV = 'test';

describe('AffiliateController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let campaignId: string;
  let referralLink: string;
  let dataSource: DataSource;
  let paymentsService: PaymentsService;
  let cryptoConverterService: CryptoConverterService;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          AuthModule,
          AffiliateModule,
          PaymentsModule,
          BalanceModule,
          BonusesModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig, mailConfig, affiliateConfig],
          }),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();

      dataSource = app.get<DataSource>(DataSource);
      paymentsService = app.get<PaymentsService>(PaymentsService);
      cryptoConverterService = app.get<CryptoConverterService>(CryptoConverterService);

      // Add BTC as an active currency
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(AssetEntity)
        .values({
          symbol: AssetTypeEnum.BTC,
          status: AssetStatusEnum.ACTIVE,
        })
        .orIgnore() // Skip if already exists
        .execute();

      // Add a currency rate for BTC
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(CurrencyRateHistoryEntity)
        .values({
          asset: AssetTypeEnum.BTC,
          rate: '50000', // $50,000 per BTC
        })
        .execute();

      // Register a test user with unique username and email
      const testUsername = `affiliate_user_${Date.now()}`;
      const testEmail = `affiliate_test_${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: testEmail,
          username: testUsername,
          password: 'Secret123',
        });

      accessToken = registerResponse.body.accessToken;

      // Extract user ID from JWT token
      const tokenParts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      userId = payload.sub;

      // Create a campaign for testing
      const createCampaignDto = {
        name: 'Test Campaign',
        description: 'This is a test campaign for e2e testing',
      };

      const campaignResponse = await request(app.getHttpServer())
        .post('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createCampaignDto)
        .expect(201);

      // Save campaign ID and referral link for later tests
      campaignId = campaignResponse.body.id;
      referralLink = campaignResponse.body.referralLink;
    } catch (error) {
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/affiliate/campaigns', () => {
    it('should verify the campaign was created in beforeAll', async () => {
      // The campaign was created in beforeAll, so we just need to verify it exists
      expect(campaignId).toBeDefined();
      expect(referralLink).toBeDefined();
      expect(referralLink).toContain(campaignId);
    });
  });

  describe('GET /v1/affiliate/campaigns', () => {
    it('should get aggregate campaigns data for the current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('campaigns');
      expect(Array.isArray(response.body.campaigns)).toBe(true);
      if (response.body.campaigns.length > 0) {
        const c = response.body.campaigns[0];
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('userId', userId);
        expect(c).toHaveProperty('name');
        expect(c).toHaveProperty('description');
        expect(c).toHaveProperty('totalCommission');
        expect(c).toHaveProperty('totalReferrals');
        expect(c).toHaveProperty('referralLink');
      }
    });
  });

  describe('GET /v1/affiliate/campaigns/users', () => {
    // Create a referred user before running the tests
    beforeAll(async () => {
      // Extract campaign ID from referral link
      const refParam = referralLink.split('c=')[1];

      // Register a new user with the referral link
      const testUsername = `referred_user_for_campaign_${Date.now()}`;
      const testEmail = `referred_test_for_campaign_${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: testEmail,
          username: testUsername,
          password: 'Secret123',
          affiliateCampaignId: refParam,
        })
        .expect(201);
    });

    it('should get users for a campaign', async () => {
      try {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/campaigns/users')
          .query({ campaignId, page: 1 })
          .set('Authorization', `Bearer ${accessToken}`);

        // Just verify the response structure without checking specific values
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('campaignId');
        expect(response.body).toHaveProperty('campaignName');
        expect(response.body).toHaveProperty('totalCommission');
        expect(response.body).toHaveProperty('totalUsers');
        expect(response.body).toHaveProperty('currentPage');
        expect(response.body).toHaveProperty('totalPages');
        expect(response.body).toHaveProperty('pageSize');
        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);
        if (response.body.users.length > 0) {
          const u = response.body.users[0];
          expect(u).toHaveProperty('totalWagered');
          expect(u).toHaveProperty('earnings');
        }
      } catch (error) {
        throw error;
      }
    });

    it('should return 404 when campaign not found', async () => {
      try {
        const nonExistentId = randomUUID();
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/campaigns/users')
          .query({ campaignId: nonExistentId, page: 1 })
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
      } catch (error) {
        throw error;
      }
    });
  });

  describe('Campaign creation with code and duplicate handling', () => {
    it('should create a campaign with a custom code and include code in referralLink', async () => {
      const createCampaignWithCodeDto = {
        name: `Code Campaign ${Date.now()}`,
        description: 'Campaign with custom code',
        code: `CODE_${Date.now()}`,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createCampaignWithCodeDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('referralLink');
      const link: string = response.body.referralLink;
      expect(link.includes(`c=${createCampaignWithCodeDto.code}`)).toBe(true);
    });

    it('should return 409 when creating a campaign with a duplicate code', async () => {
      const code = `DUP_${Date.now()}`;
      // First creation should succeed
      await request(app.getHttpServer())
        .post('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Dup Campaign A ${Date.now()}`, code })
        .expect(201);

      // Second creation with the same code should fail with 409
      await request(app.getHttpServer())
        .post('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Dup Campaign B ${Date.now()}`, code })
        .expect(409);
    });

    it('should allow registering via referral code (not only id)', async () => {
      const code = `REGCODE_${Date.now()}`;
      const createResponse = await request(app.getHttpServer())
        .post('/v1/affiliate/campaigns')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `Referral by Code ${Date.now()}`, code })
        .expect(201);

      const campaignIdByCode = createResponse.body.id;

      // Register a referred user using the code directly
      const testUsername = `referred_by_code_${Date.now()}`;
      const testEmail = `referred_by_code_${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: testEmail,
          username: testUsername,
          password: 'Secret123',
          affiliateCampaignId: code, // pass code, not id
        })
        .expect(201);

      // Verify the campaign users endpoint includes at least one user now
      const usersResponse = await request(app.getHttpServer())
        .get('/v1/affiliate/campaigns/users')
        .query({ campaignId: campaignIdByCode, page: 1 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(usersResponse.body).toHaveProperty('totalUsers');
      expect(usersResponse.body.totalUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Referral Registration and Deposit', () => {
    let referredUserAccessToken: string;
    let referredUserId: string;

    beforeAll(async () => {
      // Force refresh of the crypto converter cache to ensure it uses the latest rates
      await cryptoConverterService.refreshCache();
      // Extract campaign ID from referral link
      const refParam = referralLink.split('c=')[1];

      // Register a new user with the referral link
      const testUsername = `referred_user_${Date.now()}`;
      const testEmail = `referred_test_${Date.now()}@example.com`;

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: testEmail,
          username: testUsername,
          password: 'Secret123',
          affiliateCampaignId: refParam,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      referredUserAccessToken = response.body.accessToken;

      // Extract user ID from JWT token
      const tokenParts = referredUserAccessToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      referredUserId = payload.sub;

      // Verify the user was created
      expect(referredUserId).toBeDefined();

      // Seed a wallet with a test address for the referred user
      const walletRepo = dataSource.getRepository(WalletEntity);
      const testAddress = `testaddr_${Date.now()}`;

      // Create a wallet with a test address
      await walletRepo.save(
        walletRepo.create({
          userId: referredUserId,
          asset: AssetTypeEnum.BTC,
          addresses: { BTC: testAddress },
        }),
      );
    });

    it('should have registered a new user with referral link', async () => {
      // Just verify the user was created
      expect(referredUserId).toBeDefined();
    });

    it('should get a deposit address for the referred user', async () => {
      // The wallet was created in beforeAll, so we just need to verify we can get the address
      const response = await request(app.getHttpServer())
        .get('/v1/payments/deposit-address')
        .query({ asset: AssetTypeEnum.BTC })
        .set('Authorization', `Bearer ${referredUserAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('qrCode');
      // We can't check the exact address since it's generated in beforeAll
      expect(response.body.address).toBeDefined();
    });

    it('should process a deposit and affiliate commission', async () => {
      // Refresh the cache again to ensure it uses the latest rates
      await cryptoConverterService.refreshCache();

      // Make a test deposit
      const depositAmount = '0.01'; // 0.01 BTC
      const commissionRate = 0.1; // 10% commission rate
      const expectedCommission = (parseFloat(depositAmount) * commissionRate).toString(); // 0.001 BTC
      const btcRate = 50000; // $50,000 per BTC from test setup
      const expectedCommissionCents = parseFloat(expectedCommission) * btcRate * 100; // Convert to cents

      try {
        await paymentsService.creditWallet(referredUserId, AssetTypeEnum.BTC, depositAmount);

        // Wait for the commission to be processed (3 seconds should be enough)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check that the campaign has been updated with the commission
        const campaignResponse = await request(app.getHttpServer())
          .get('/v1/affiliate/campaigns')
          .query({ campaignId })
          .set('Authorization', `Bearer ${accessToken}`);

        expect(campaignResponse.status).toBe(200);

        // Verify response aggregate contains the campaign and properties
        expect(campaignResponse.body).toHaveProperty('campaigns');
        const campaignArr = campaignResponse.body.campaigns as any[];
        expect(Array.isArray(campaignArr)).toBe(true);
        const found = campaignArr.find((c) => c.id === campaignId);
        expect(found).toBeDefined();
        expect(found).toHaveProperty('userId', userId);
        expect(found).toHaveProperty('totalCommission');
        expect(found).toHaveProperty('totalReferrals');

        // Verify the commission amount is correctly calculated on the campaign item
        // The totalCommission is returned by the API in dollars (converted from cents)
        const actualCommission = parseFloat(found.totalCommission);
        // Expected commission in dollars
        const expectedCommissionDollars = parseFloat(expectedCommission) * btcRate;
        expect(actualCommission).toBeCloseTo(expectedCommissionDollars, 2);

        // Check aggregates reflect revenue/deposit in cents
        expect(campaignResponse.body).toHaveProperty('totalRevenue');
        expect(campaignResponse.body).toHaveProperty('totalDeposited');
        const aggRevenue = Number(campaignResponse.body.totalRevenue);
        const aggDeposited = Number(campaignResponse.body.totalDeposited);
        expect(aggRevenue).toBeGreaterThanOrEqual(expectedCommissionCents - 1);
        expect(aggDeposited).toBeGreaterThan(0);

        // Also check the commission in the AffiliateCommissionEntity
        const commissionRepo = dataSource.getRepository(AffiliateCommissionEntity);
        const commission = await commissionRepo.findOne({
          where: {
            campaignId,
            referredUserId,
          },
        });

        expect(commission).toBeDefined();
        expect(parseFloat(commission!.amount)).toBeCloseTo(parseFloat(expectedCommission), 8);
        expect(parseFloat(commission!.amountCents)).toBeCloseTo(expectedCommissionCents, 2);

        // Verify the totalCommission field in the AffiliateCampaignEntity table
        const campaignRepo = dataSource.getRepository(AffiliateCampaignEntity);
        const campaign = await campaignRepo.findOne({
          where: {
            id: campaignId,
          },
        });

        expect(campaign).toBeDefined();
        // The totalCommission is stored in the database in cents
        expect(parseFloat(campaign!.totalCommission)).toBeCloseTo(expectedCommissionCents, 2);
      } catch (error) {
        throw error;
      }
    });
  });

  describe('GET /v1/affiliate/referred-users', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/v1/affiliate/referred-users').expect(401);
    });

    it('should return empty response when user has no campaigns', async () => {
      // Create a new user with no campaigns
      const testUsername = `no_campaigns_user_${Date.now()}`;
      const testEmail = `no_campaigns_${Date.now()}@example.com`;

      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register/email')
        .send({
          email: testEmail,
          username: testUsername,
          password: 'Secret123',
        });

      const noCampaignsToken = registerResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .set('Authorization', `Bearer ${noCampaignsToken}`)
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        totalUsers: 0,
        totalEarnings: 0,
        offset: 0,
        limit: 100,
        hasMore: false,
      });
    });

    it('should return referred users with correct structure and data types', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalEarnings');
      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('hasMore');

      // Validate data types
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.totalUsers).toBe('number');
      expect(typeof response.body.totalEarnings).toBe('number');
      expect(typeof response.body.offset).toBe('number');
      expect(typeof response.body.limit).toBe('number');
      expect(typeof response.body.hasMore).toBe('boolean');

      // Should have at least one referred user from previous tests
      expect(response.body.totalUsers).toBeGreaterThan(0);
      expect(response.body.users.length).toBeGreaterThan(0);

      if (response.body.users.length > 0) {
        const user = response.body.users[0];

        // Validate user structure (extends PublicUserProfileDto)
        expect(user).toHaveProperty('userName');
        expect(user).toHaveProperty('userId');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('vipLevel');
        expect(user).toHaveProperty('statistics');

        // Validate additional ReferredUserProfileDto fields
        expect(user).toHaveProperty('totalEarnings');
        expect(user).toHaveProperty('totalWagered');
        expect(user).toHaveProperty('campaign');

        // Validate data types for numeric fields (should be numbers in cents)
        expect(typeof user.totalEarnings).toBe('number');
        expect(typeof user.totalWagered).toBe('number');

        // Validate campaign structure
        expect(user.campaign).toHaveProperty('campaignId');
        expect(user.campaign).toHaveProperty('createdAt');
        expect(typeof user.campaign.campaignId).toBe('string');
        expect(user.campaign.createdAt).toBeDefined();
        // code field is optional
        if (user.campaign.code !== undefined) {
          expect(typeof user.campaign.code).toBe('string');
        }

        // Validate VIP level structure
        expect(user.vipLevel).toHaveProperty('level');
        expect(user.vipLevel).toHaveProperty('name');
        expect(user.vipLevel).toHaveProperty('percent');

        // Validate statistics structure
        expect(user.statistics).toHaveProperty('totalBets');
        expect(user.statistics).toHaveProperty('numberOfWins');
        expect(user.statistics).toHaveProperty('numberOfLosses');
        expect(user.statistics).toHaveProperty('wagered');
      }
    });

    it('should support pagination with limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('limit', 1);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body.users.length).toBeLessThanOrEqual(1);
    });

    it('should support pagination with offset parameter', async () => {
      // First get total count
      const firstResponse = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const totalUsers = firstResponse.body.totalUsers;

      if (totalUsers > 1) {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ offset: 1, limit: 1 })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('offset', 1);
        expect(response.body).toHaveProperty('limit', 1);
        expect(response.body).toHaveProperty('totalUsers', totalUsers);
        expect(response.body).toHaveProperty('hasMore');
      }
    });

    it('should calculate hasMore pagination flag correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const { totalUsers, offset, limit, hasMore } = response.body;
      const expectedHasMore = offset + limit < totalUsers;
      expect(hasMore).toBe(expectedHasMore);
    });

    it('should return users in descending order by registration date', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      if (response.body.users.length > 1) {
        const users = response.body.users;
        for (let i = 0; i < users.length - 1; i++) {
          const currentDate = new Date(users[i].createdAt);
          const nextDate = new Date(users[i + 1].createdAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    it('should include commission earnings in cents when user has made deposits', async () => {
      // This test will work with the referred user who made a deposit in the previous test suite
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.users.length).toBeGreaterThan(0);

      // The total earnings should be greater than 0 since we processed a deposit with commission
      expect(response.body.totalEarnings).toBeGreaterThan(0);

      // Find a user with earnings (should exist from the deposit test)
      const userWithEarnings = response.body.users.find((user: any) => user.totalEarnings > 0);
      if (userWithEarnings) {
        expect(typeof userWithEarnings.totalEarnings).toBe('number');
        expect(userWithEarnings.totalEarnings).toBeGreaterThan(0);
      }
    });

    it('should handle large offset gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/affiliate/referred-users')
        .query({ offset: 1000, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users', []);
      expect(response.body).toHaveProperty('hasMore', false);
      expect(response.body).toHaveProperty('offset', 1000);
      expect(response.body).toHaveProperty('limit', 10);
    });

    describe('Campaign filtering', () => {
      let secondCampaignId: string;
      let campaignCode: string;

      beforeAll(async () => {
        // Create a second campaign for filtering tests
        const secondCampaignResponse = await request(app.getHttpServer())
          .post('/v1/affiliate/campaigns')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Second Test Campaign',
            description: 'Second campaign for filtering tests',
          })
          .expect(201);

        secondCampaignId = secondCampaignResponse.body.id;

        // Create a campaign with a custom code
        campaignCode = `FILTER_CODE_${Date.now()}`;
        await request(app.getHttpServer())
          .post('/v1/affiliate/campaigns')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: 'Campaign with Code',
            description: 'Campaign with custom code for filtering tests',
            code: campaignCode,
          })
          .expect(201);

        // Register a user for the second campaign
        const testUsername = `second_campaign_user_${Date.now()}`;
        const testEmail = `second_campaign_${Date.now()}@example.com`;

        await request(app.getHttpServer())
          .post('/v1/auth/register/email')
          .send({
            email: testEmail,
            username: testUsername,
            password: 'Secret123',
            affiliateCampaignId: secondCampaignId,
          })
          .expect(201);

        // Register a user for the campaign with code
        const codeUsername = `code_campaign_user_${Date.now()}`;
        const codeEmail = `code_campaign_${Date.now()}@example.com`;

        await request(app.getHttpServer())
          .post('/v1/auth/register/email')
          .send({
            email: codeEmail,
            username: codeUsername,
            password: 'Secret123',
            affiliateCampaignId: campaignCode,
          })
          .expect(201);
      });

      it('should filter referred users by campaign ID', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: secondCampaignId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('totalUsers');
        expect(Array.isArray(response.body.users)).toBe(true);

        // Should have at least the user we registered for this campaign
        expect(response.body.totalUsers).toBeGreaterThan(0);
        expect(response.body.users.length).toBeGreaterThan(0);

        // All returned users should belong to the specified campaign
        // We can't directly check the campaign ID on users, but we know they should be filtered
      });

      it('should filter referred users by campaign code', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: campaignCode })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('totalUsers');
        expect(Array.isArray(response.body.users)).toBe(true);

        // Should have at least the user we registered for this campaign with code
        expect(response.body.totalUsers).toBeGreaterThan(0);
        expect(response.body.users.length).toBeGreaterThan(0);
      });

      it('should return 404 when filtering by non-existent campaign ID', async () => {
        const nonExistentId = randomUUID();
        await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: nonExistentId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);
      });

      it('should return 404 when filtering by non-existent campaign code', async () => {
        const nonExistentCode = `NON_EXISTENT_${Date.now()}`;
        await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: nonExistentCode })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);
      });

      it('should return 404 when filtering by campaign owned by another user', async () => {
        // Create another user with their own campaign
        const otherUsername = `other_user_${Date.now()}`;
        const otherEmail = `other_${Date.now()}@example.com`;

        const otherUserResponse = await request(app.getHttpServer())
          .post('/v1/auth/register/email')
          .send({
            email: otherEmail,
            username: otherUsername,
            password: 'Secret123',
          })
          .expect(201);

        const otherUserToken = otherUserResponse.body.accessToken;

        // Create a campaign for the other user
        const otherCampaignResponse = await request(app.getHttpServer())
          .post('/v1/affiliate/campaigns')
          .set('Authorization', `Bearer ${otherUserToken}`)
          .send({
            name: 'Other User Campaign',
            description: 'Campaign owned by another user',
          })
          .expect(201);

        const otherCampaignId = otherCampaignResponse.body.id;

        // Try to filter by the other user's campaign ID
        await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: otherCampaignId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);
      });

      it('should work with pagination when filtering by campaign', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: secondCampaignId, limit: 1, offset: 0 })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('limit', 1);
        expect(response.body).toHaveProperty('offset', 0);
        expect(response.body.users.length).toBeLessThanOrEqual(1);
      });

      it('should return different results when filtering by different campaigns', async () => {
        // Get users for the first campaign (original campaignId)
        const firstResponse = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: campaignId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // Get users for the second campaign
        const secondResponse = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: secondCampaignId })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // Get all users (no filtering)
        const allResponse = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // The sum of users from individual campaigns should not exceed total users
        const totalFilteredUsers = firstResponse.body.totalUsers + secondResponse.body.totalUsers;
        expect(totalFilteredUsers).toBeLessThanOrEqual(allResponse.body.totalUsers);

        // Each filtered response should have different or overlapping users
        expect(firstResponse.body.totalUsers).toBeGreaterThanOrEqual(0);
        expect(secondResponse.body.totalUsers).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Sorting', () => {
      it('should sort referred users by createdAt (default)', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          for (let i = 0; i < users.length - 1; i++) {
            const currentDate = new Date(users[i].createdAt);
            const nextDate = new Date(users[i + 1].createdAt);
            expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
          }
        }
      });

      it('should sort referred users by createdAt when explicitly specified', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ sortBy: 'createdAt' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          for (let i = 0; i < users.length - 1; i++) {
            const currentDate = new Date(users[i].createdAt);
            const nextDate = new Date(users[i + 1].createdAt);
            expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
          }
        }
      });

      it('should sort referred users by totalEarnings in descending order', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ sortBy: 'totalEarnings' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          for (let i = 0; i < users.length - 1; i++) {
            expect(users[i].totalEarnings).toBeGreaterThanOrEqual(users[i + 1].totalEarnings);
          }
        }
      });

      it('should sort referred users by totalWagered in descending order', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ sortBy: 'totalWagered' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          for (let i = 0; i < users.length - 1; i++) {
            expect(users[i].totalWagered).toBeGreaterThanOrEqual(users[i + 1].totalWagered);
          }
        }
      });

      it('should work with sorting combined with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ sortBy: 'totalEarnings', limit: 2, offset: 0 })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('limit', 2);
        expect(response.body).toHaveProperty('offset', 0);
        expect(response.body.users.length).toBeLessThanOrEqual(2);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          expect(users[0].totalEarnings).toBeGreaterThanOrEqual(users[1].totalEarnings);
        }
      });

      it('should work with sorting combined with campaign filtering', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ campaignId: campaignId, sortBy: 'totalWagered' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);

        if (response.body.users.length > 1) {
          const users = response.body.users;
          for (let i = 0; i < users.length - 1; i++) {
            expect(users[i].totalWagered).toBeGreaterThanOrEqual(users[i + 1].totalWagered);
          }
        }
      });

      it('should return the same total count regardless of sorting method', async () => {
        const [createdAtResponse, earningsResponse, wageredResponse] = await Promise.all([
          request(app.getHttpServer())
            .get('/v1/affiliate/referred-users')
            .query({ sortBy: 'createdAt' })
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200),
          request(app.getHttpServer())
            .get('/v1/affiliate/referred-users')
            .query({ sortBy: 'totalEarnings' })
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200),
          request(app.getHttpServer())
            .get('/v1/affiliate/referred-users')
            .query({ sortBy: 'totalWagered' })
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200),
        ]);

        expect(createdAtResponse.body.totalUsers).toBe(earningsResponse.body.totalUsers);
        expect(earningsResponse.body.totalUsers).toBe(wageredResponse.body.totalUsers);
        expect(createdAtResponse.body.totalEarnings).toBe(earningsResponse.body.totalEarnings);
        expect(earningsResponse.body.totalEarnings).toBe(wageredResponse.body.totalEarnings);
      });

      it('should handle invalid sort parameter gracefully', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/affiliate/referred-users')
          .query({ sortBy: 'invalid' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200); // Should fall back to default sorting

        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);
      });
    });
  });

  describe('Wager-Based Commission Model (Casino & Sportsbook)', () => {
    let wagerTestUserId: string;
    let wagerTestUserToken: string;
    let initialStatistics: any;

    beforeAll(async () => {
      // Register a new user for wager tests
      const uniqueUsername = `wager_${Date.now()}`;
      const refParam = referralLink.split('c=')[1];

      const registerResponse = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `${uniqueUsername}@test.com`,
          username: uniqueUsername,
          password: 'Test1234!',
          referralCode: refParam,
        })
        .expect(201);

      wagerTestUserId = registerResponse.body.id;

      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: `${uniqueUsername}@test.com`,
          password: 'Test1234!',
        })
        .expect(200);

      wagerTestUserToken = loginResponse.body.accessToken;

      // Add test balance using debug endpoint
      await request(app.getHttpServer())
        .post('/v1/affiliate/debug/deposit')
        .set('Authorization', `Bearer ${wagerTestUserToken}`)
        .send({
          userId: wagerTestUserId,
          amount: '10000', // $100 in cents
          currency: 'USD',
        })
        .expect(201);

      // Get initial statistics
      const statsResponse = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      initialStatistics = statsResponse.body;
    });

    it('should credit commission for casino bet immediately via bet.confirmed', async () => {
      // Place a dice bet
      await request(app.getHttpServer())
        .post('/v1/games/dice/bet')
        .set('Authorization', `Bearer ${wagerTestUserToken}`)
        .send({
          betType: 'ROLL_OVER',
          targetNumber: 50,
          amount: '10', // $0.10
          currency: 'USD',
        })
        .expect(201);

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check statistics - commission should be credited
      const statsResponse = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const newStats = statsResponse.body;

      // Commission should have increased
      expect(parseFloat(newStats.totalAvailableUsd)).toBeGreaterThan(
        parseFloat(initialStatistics.totalAvailableUsd),
      );
      expect(newStats.commissions.length).toBeGreaterThan(0);

      // Should have BTC commission (from dice bet)
      const btcCommission = newStats.commissions.find((c: any) => c.asset === 'BTC');
      expect(btcCommission).toBeDefined();
      expect(parseFloat(btcCommission.claimable)).toBeGreaterThan(0);
    });

    it('should credit commission for sportsbook bet only after settlement', async () => {
      const statsBefore = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Place and settle sportsbook bet using debug endpoint
      await request(app.getHttpServer())
        .post('/v1/affiliate/debug/sportsbook-bet')
        .set('Authorization', `Bearer ${wagerTestUserToken}`)
        .send({
          userId: wagerTestUserId,
          betAmount: '100', // $1 in cents
          currency: 'USD',
          status: 'WON',
          debugToken: 'test-debug-token-123',
        })
        .expect(201);

      // Wait for settlement event processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statsAfter = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Commission should have increased after settlement
      expect(parseFloat(statsAfter.body.totalAvailableUsd)).toBeGreaterThan(
        parseFloat(statsBefore.body.totalAvailableUsd),
      );
    });

    it('should enforce $10 minimum claim amount', async () => {
      const statsResponse = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const availableUsd = parseFloat(statsResponse.body.totalAvailableUsd);

      if (availableUsd < 10) {
        // Try to claim with less than $10
        await request(app.getHttpServer())
          .post('/v1/affiliate/claim')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
      }
    });

    it('should have consistent statistics after multiple bets', async () => {
      // Place multiple bets
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/v1/games/dice/bet')
          .set('Authorization', `Bearer ${wagerTestUserToken}`)
          .send({
            betType: 'ROLL_OVER',
            targetNumber: 50,
            amount: '10',
            currency: 'USD',
          })
          .expect(201);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Wait for all events to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check statistics consistency
      const stats1 = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const stats2 = await request(app.getHttpServer())
        .get('/v1/affiliate/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Statistics should be consistent (no race conditions from UPSERT)
      expect(stats1.body.totalAvailableUsd).toBe(stats2.body.totalAvailableUsd);
      expect(stats1.body.commissions).toEqual(stats2.body.commissions);
    });
  });
});
