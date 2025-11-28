import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAffiliateEarningsTable1761526130737 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new affiliate_earnings table with correct precision
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS affiliate.affiliate_earnings (
          "referredUserId" UUID NOT NULL,
          asset VARCHAR(10) NOT NULL,
          "affiliateId" UUID NOT NULL,
          earned DECIMAL(25, 10) NOT NULL DEFAULT 0,
          PRIMARY KEY("referredUserId", asset),
          FOREIGN KEY ("affiliateId") REFERENCES users.users(id) ON DELETE CASCADE,
          FOREIGN KEY ("referredUserId") REFERENCES users.users(id) ON DELETE CASCADE
        );
      `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate_id 
        ON affiliate.affiliate_earnings("affiliateId");
      `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_referred_user_id 
        ON affiliate.affiliate_earnings("referredUserId");
      `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate_referred 
        ON affiliate.affiliate_earnings("affiliateId", "referredUserId");
      `);

    // Alter existing affiliate_wallets table columns to increase precision
    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "totalEarned" TYPE numeric(25, 10) USING "totalEarned"::numeric(25, 10)
      `);

    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "totalClaimed" TYPE numeric(25, 10) USING "totalClaimed"::numeric(25, 10)
      `);

    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "balance" TYPE numeric(25, 10) USING "balance"::numeric(25, 10)
      `);

    // Alter affiliate_commission_history table amount column
    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_commission_history 
        ALTER COLUMN "amount" TYPE numeric(25, 10) USING "amount"::numeric(25, 10)
      `);

    // Change affiliateCampaignId from varchar to uuid for better performance
    // First, clean any invalid data (empty strings, malformed UUIDs)
    await queryRunner.query(`
        UPDATE users.users 
        SET "affiliateCampaignId" = NULL 
        WHERE "affiliateCampaignId" IS NOT NULL 
          AND "affiliateCampaignId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);

    // Then perform type change
    await queryRunner.query(`
        ALTER TABLE users.users 
        ALTER COLUMN "affiliateCampaignId" TYPE uuid USING "affiliateCampaignId"::uuid
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop affiliate_earnings table
    await queryRunner.query(`DROP TABLE IF EXISTS affiliate.affiliate_earnings;`);

    // Revert affiliate_wallets columns to original precision
    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "totalEarned" TYPE numeric(20, 8) USING "totalEarned"::numeric(20, 8)
      `);

    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "totalClaimed" TYPE numeric(20, 8) USING "totalClaimed"::numeric(20, 8)
      `);

    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_wallets 
        ALTER COLUMN "balance" TYPE numeric(20, 8) USING "balance"::numeric(20, 8)
      `);

    // Revert affiliate_commission_history amount column
    await queryRunner.query(`
        ALTER TABLE affiliate.affiliate_commission_history 
        ALTER COLUMN "amount" TYPE numeric(20, 8) USING "amount"::numeric(20, 8)
      `);

    // Revert affiliateCampaignId back to varchar
    await queryRunner.query(`
        ALTER TABLE users.users 
        ALTER COLUMN "affiliateCampaignId" TYPE character varying USING "affiliateCampaignId"::character varying
      `);
  }
}
