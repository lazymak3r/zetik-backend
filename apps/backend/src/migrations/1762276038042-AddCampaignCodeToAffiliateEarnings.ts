import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignCodeToAffiliateEarnings1762276038042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column as nullable first to allow backfilling existing data
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_earnings
      ADD COLUMN "campaignCode" VARCHAR NULL
    `);

    // Backfill existing data from user campaign association
    await queryRunner.query(`
      UPDATE affiliate.affiliate_earnings ae
      SET "campaignCode" = ac.code
      FROM users.users u
      JOIN affiliate.affiliate_campaigns ac ON u."affiliateCampaignId"::uuid = ac.id
      WHERE ae."referredUserId" = u.id
    `);

    // Make column NOT NULL after backfilling - all earnings must be associated with a campaign
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_earnings
      ALTER COLUMN "campaignCode" SET NOT NULL
    `);

    // Create indexes for query optimization
    // Single column index: used for standalone campaignCode filtering
    // Query pattern: WHERE ae."campaignCode" = ?
    await queryRunner.query(`
      CREATE INDEX "IDX_affiliate_earnings_campaign_code"
      ON affiliate.affiliate_earnings ("campaignCode")
    `);

    // Composite index (covering): filter by campaign + group/sort by user
    // Query pattern: WHERE campaignCode = ? GROUP BY referredUserId ORDER BY ...
    // Most efficient for getCampaignDetails and getCampaignReferrals methods
    // Allows index-only scan without needing to fetch from main table
    await queryRunner.query(`
      CREATE INDEX "IDX_affiliate_earnings_campaign_user"
      ON affiliate.affiliate_earnings ("campaignCode", "referredUserId")
    `);

    // Single column index: referral user lookups
    // Query pattern: GROUP BY referredUserId, WHERE referredUserId = ?
    // Used when querying by user across all campaigns
    await queryRunner.query(`
      CREATE INDEX "IDX_affiliate_earnings_referred_user"
      ON affiliate.affiliate_earnings ("referredUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS affiliate."IDX_affiliate_earnings_campaign_code"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS affiliate."IDX_affiliate_earnings_campaign_user"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS affiliate."IDX_affiliate_earnings_referred_user"
    `);

    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_earnings
      DROP COLUMN "campaignCode"
    `);
  }
}
