import { MigrationInterface, QueryRunner } from 'typeorm';

export class AffiliateWalletsAndHistory1760839783300 implements MigrationInterface {
  name = 'AffiliateWalletsAndHistory-1760839783300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "affiliate"."affiliate_commission_history_operation_enum" AS ENUM('EARN', 'CLAIM');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate"."affiliate_wallets" (
        "userId" uuid NOT NULL,
        "asset" "balance"."wallets_asset_enum" NOT NULL,
        "totalEarned" numeric(20,8) NOT NULL DEFAULT '0',
        "totalClaimed" numeric(20,8) NOT NULL DEFAULT '0',
        "balance" numeric(20,8) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_wallets" PRIMARY KEY ("userId", "asset"),
        CONSTRAINT "FK_affiliate_wallets_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_wallets_userId_asset" 
      ON "affiliate"."affiliate_wallets" ("userId", "asset")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_wallets_userId" 
      ON "affiliate"."affiliate_wallets" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate"."affiliate_commission_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "campaignId" uuid,
        "asset" "balance"."wallets_asset_enum" NOT NULL,
        "amount" numeric(20,8) NOT NULL,
        "amountCents" numeric(20,2) NOT NULL,
        "operation" "affiliate"."affiliate_commission_history_operation_enum" NOT NULL,
        "balanceOperationId" uuid,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_commission_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_affiliate_commission_history_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_affiliate_commission_history_campaignId" 
          FOREIGN KEY ("campaignId") REFERENCES "affiliate"."affiliate_campaigns"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_history_userId" 
      ON "affiliate"."affiliate_commission_history" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_history_campaignId" 
      ON "affiliate"."affiliate_commission_history" ("campaignId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_history_createdAt" 
      ON "affiliate"."affiliate_commission_history" ("createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_history_balanceOperationId" 
      ON "affiliate"."affiliate_commission_history" ("balanceOperationId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_affiliate_commission_history_balanceOperationId" 
      ON "affiliate"."affiliate_commission_history" ("balanceOperationId") 
      WHERE "balanceOperationId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_affiliate_commission_history_userId_operation" 
      ON "affiliate"."affiliate_commission_history" ("userId", "operation")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate"."affiliate_commission_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "affiliate"."affiliate_wallets"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "affiliate"."affiliate_commission_history_operation_enum"`,
    );
  }
}
