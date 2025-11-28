import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralCodeToUsers1763017233152 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "users"."users"
        ADD COLUMN "referralCode" VARCHAR NULL
      `);

    // Backfill referral codes from affiliate campaigns
    await queryRunner.query(`
        UPDATE "users"."users" u
        SET "referralCode" = ac.code
        FROM affiliate.affiliate_campaigns ac
        WHERE u."affiliateCampaignId" = ac.id
          AND u."affiliateCampaignId" IS NOT NULL
      `);

    // Create index for faster lookups by referral code
    await queryRunner.query(`
        CREATE INDEX "IDX_users_referral_code"
        ON "users"."users" ("referralCode")
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_users_referral_code"
      `);

    await queryRunner.query(`
        ALTER TABLE "users"."users"
        DROP COLUMN "referralCode"
      `);
  }
}
