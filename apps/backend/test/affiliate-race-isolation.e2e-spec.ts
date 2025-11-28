import {
  AffiliateCampaignEntity,
  AssetTypeEnum,
  BalanceWalletEntity,
  RaceEntity,
  RaceParticipantEntity,
  RaceStatusEnum,
  WalletEntity,
} from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AffiliateModule } from '../src/affiliate/affiliate.module';
import { AuthModule } from '../src/auth/auth.module';
import { BalanceModule } from '../src/balance/balance.module';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { AppDataSource } from '../src/data-source';
import { GamesModule } from '../src/games/games.module';
import { PaymentsModule } from '../src/payments/payments.module';

describe('Affiliate Race Isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const logger = new Logger('AffiliateRaceIsolationE2E');

  // Test users
  let creator1: {
    userId: string;
    accessToken: string;
    email: string;
    campaignId: string;
    referralCode: string;
  };
  let creator2: {
    userId: string;
    accessToken: string;
    email: string;
    campaignId: string;
    referralCode: string;
  };
  let referredUser1: { userId: string; accessToken: string; email: string };
  let referredUser2: { userId: string; accessToken: string; email: string };
  let independentUser: { userId: string; accessToken: string; email: string };

  // Test races
  let race1Id: string;
  let race2Id: string;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          AuthModule,
          PaymentsModule,
          BalanceModule,
          BonusesModule,
          AffiliateModule,
          GamesModule,
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig],
          }),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();

      dataSource = moduleFixture.get<DataSource>(DataSource);

      // Create two campaign creators
      creator1 = await createUserWithCampaign('creator1');
      creator2 = await createUserWithCampaign('creator2');

      // Create referred users (one per campaign)
      referredUser1 = await createReferredUser('referred1', creator1.referralCode);
      referredUser2 = await createReferredUser('referred2', creator2.referralCode);

      // Create independent user (no referral)
      independentUser = await createReferredUser('independent', null);

      // Create affiliate races
      race1Id = await createAffiliateRace(creator1.accessToken, creator1.referralCode);
      race2Id = await createAffiliateRace(creator2.accessToken, creator2.referralCode);

      logger.log('Test setup complete');
    } catch (error) {
      logger.error('Setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUserWithCampaign(username: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    campaignId: string;
    referralCode: string;
  }> {
    const email = `${username}_${Date.now()}@example.com`;
    const password = 'TestPassword123';

    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login/email')
      .send({ email, password })
      .expect(200);

    const userId = registerRes.body.user.id;
    const accessToken = loginRes.body.accessToken;

    // Setup wallets
    await setupUserWallets(userId);

    // Create affiliate campaign
    const campaignRes = await request(app.getHttpServer())
      .post('/v1/affiliate/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `${username}'s Campaign` })
      .expect(201);

    const referralLink = campaignRes.body.referralLink;
    const referralCode = referralLink.match(/c=([^&]+)/)[1];
    const campaignId = campaignRes.body.id;

    return { userId, accessToken, email, campaignId, referralCode };
  }

  async function createReferredUser(
    username: string,
    referralCode: string | null,
  ): Promise<{ userId: string; accessToken: string; email: string }> {
    const email = `${username}_${Date.now()}@example.com`;
    const password = 'TestPassword123';

    const payload: any = { email, username, password };
    if (referralCode) {
      payload.affiliateCampaignId = await getCampaignIdByCode(referralCode);
    }

    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register/email')
      .send(payload)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login/email')
      .send({ email, password })
      .expect(200);

    const userId = registerRes.body.user.id;
    const accessToken = loginRes.body.accessToken;

    await setupUserWallets(userId);

    return { userId, accessToken, email };
  }

  async function getCampaignIdByCode(code: string): Promise<string> {
    const campaignRepo = dataSource.getRepository(AffiliateCampaignEntity);
    const campaign = await campaignRepo.findOne({ where: { code } });
    if (!campaign) throw new Error(`Campaign with code ${code} not found`);
    return campaign.id;
  }

  async function setupUserWallets(userId: string): Promise<void> {
    const walletRepo = dataSource.getRepository(WalletEntity);
    await walletRepo.save(
      walletRepo.create({
        userId,
        asset: AssetTypeEnum.BTC,
        addresses: { BTC: `test_${userId}` },
      } as any),
    );

    const balanceRepo = dataSource.getRepository(BalanceWalletEntity);
    await balanceRepo.save(
      balanceRepo.create({
        userId,
        asset: AssetTypeEnum.BTC,
        balance: '100000000',
        isPrimary: true,
      } as any),
    );
  }

  async function createAffiliateRace(accessToken: string, referralCode: string): Promise<string> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const raceRes = await request(app.getHttpServer())
      .post('/v1/affiliate/races')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `Race for ${referralCode}`,
        referralCode,
        prizes: [100000, 50000, 25000],
        startsAt: new Date().toISOString(),
        endsAt: tomorrow.toISOString(),
        asset: AssetTypeEnum.BTC,
        fiat: 'USD',
      })
      .expect(201);

    const raceId = raceRes.body.id;

    // Activate race manually
    const raceRepo = dataSource.getRepository(RaceEntity);
    await raceRepo.update({ id: raceId }, { status: RaceStatusEnum.ACTIVE });

    return raceId;
  }

  async function placeBet(accessToken: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/v1/games/dice/bet')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        betAmount: 0.0001,
        betType: 'ROLL_OVER',
        multiplier: 2,
      })
      .expect(201);
  }

  describe('Race Isolation Tests', () => {
    it('should add referred user to their own affiliate race after first bet', async () => {
      // Place bet as referredUser1
      await placeBet(referredUser1.accessToken);

      // Wait for async race participation processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if user is in race1
      const statsRes = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race1Id}/me`)
        .set('Authorization', `Bearer ${referredUser1.accessToken}`)
        .expect(200);

      expect(statsRes.body).not.toBeNull();
      expect(statsRes.body.wagered).toBeDefined();
    });

    it('should NOT add referred user to other affiliate races', async () => {
      // referredUser1 should NOT be in race2 (belongs to creator2)
      const statsRes = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race2Id}/me`)
        .set('Authorization', `Bearer ${referredUser1.accessToken}`)
        .expect(200);

      expect(statsRes.body).toBeNull();
    });

    it('should isolate referredUser2 to only race2', async () => {
      // Place bet as referredUser2
      await placeBet(referredUser2.accessToken);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should be in race2
      const stats2Res = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race2Id}/me`)
        .set('Authorization', `Bearer ${referredUser2.accessToken}`)
        .expect(200);

      expect(stats2Res.body).not.toBeNull();

      // Should NOT be in race1
      const stats1Res = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race1Id}/me`)
        .set('Authorization', `Bearer ${referredUser2.accessToken}`)
        .expect(200);

      expect(stats1Res.body).toBeNull();
    });

    it('should NOT add independent user to any affiliate races', async () => {
      // Place bet as independent user
      await placeBet(independentUser.accessToken);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should NOT be in race1
      const stats1Res = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race1Id}/me`)
        .set('Authorization', `Bearer ${independentUser.accessToken}`)
        .expect(200);

      expect(stats1Res.body).toBeNull();

      // Should NOT be in race2
      const stats2Res = await request(app.getHttpServer())
        .get(`/v1/bonus/races/${race2Id}/me`)
        .set('Authorization', `Bearer ${independentUser.accessToken}`)
        .expect(200);

      expect(stats2Res.body).toBeNull();
    });

    it('should verify database isolation - referredUser1 only in race1', async () => {
      const participantRepo = dataSource.getRepository(RaceParticipantEntity);

      const user1Races = await participantRepo.find({
        where: { userId: referredUser1.userId },
        select: ['raceId'],
      });

      const affiliateRaceIds = user1Races
        .map((p) => p.raceId)
        .filter((id) => id === race1Id || id === race2Id);

      expect(affiliateRaceIds).toContain(race1Id);
      expect(affiliateRaceIds).not.toContain(race2Id);
    });

    it('should verify database isolation - referredUser2 only in race2', async () => {
      const participantRepo = dataSource.getRepository(RaceParticipantEntity);

      const user2Races = await participantRepo.find({
        where: { userId: referredUser2.userId },
        select: ['raceId'],
      });

      const affiliateRaceIds = user2Races
        .map((p) => p.raceId)
        .filter((id) => id === race1Id || id === race2Id);

      expect(affiliateRaceIds).not.toContain(race1Id);
      expect(affiliateRaceIds).toContain(race2Id);
    });

    it('should verify referral code caching works', async () => {
      // Place multiple bets to trigger cache hits
      await placeBet(referredUser1.accessToken);
      await placeBet(referredUser1.accessToken);
      await placeBet(referredUser1.accessToken);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // User should still only be in race1
      const participantRepo = dataSource.getRepository(RaceParticipantEntity);
      const user1Races = await participantRepo.find({
        where: { userId: referredUser1.userId },
        select: ['raceId'],
      });

      const affiliateRaceIds = user1Races
        .map((p) => p.raceId)
        .filter((id) => id === race1Id || id === race2Id);

      expect(affiliateRaceIds.length).toBe(1);
      expect(affiliateRaceIds).toContain(race1Id);
    });
  });
});
