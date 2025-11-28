import { MigrationInterface, QueryRunner } from 'typeorm';

export class RakebackMultiCurrency1758260000010 implements MigrationInterface {
  name = 'RakebackMultiCurrency1758260000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if rakeback table exists
    const rakebackTableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'balance' AND table_name = 'rakeback'
      )
    `);

    if (rakebackTableExists[0]?.exists) {
      // Backup existing data
      await queryRunner.query(`
        CREATE TEMPORARY TABLE rakeback_backup AS 
        SELECT "userId", "accumulatedHouseSideCents" 
        FROM "balance"."rakeback"
      `);

      // Drop existing table
      await queryRunner.query(`DROP TABLE "balance"."rakeback"`);
    }

    // Create table with new structure
    await queryRunner.query(`
      CREATE TABLE "balance"."rakeback" (
        "userId" uuid NOT NULL,
        "asset" varchar(10) NOT NULL,
        "accumulatedHouseSideAmount" decimal(18,8) NOT NULL DEFAULT '0.00000000',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rakeback_userId_asset" PRIMARY KEY ("userId", "asset")
      )
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON COLUMN "balance"."rakeback"."userId" IS 'User ID'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "balance"."rakeback"."asset" IS 'Asset type (BTC, ETH, USDT, etc.)'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "balance"."rakeback"."accumulatedHouseSideAmount" IS 'Accumulated house side amount in native asset'
    `);

    // Note: We don't restore backup data as old USD data is incompatible with new multi-currency structure
    // Users will start with clean rakeback state
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new table
    await queryRunner.query(`DROP TABLE IF EXISTS "balance"."rakeback"`);

    // Recreate old table structure
    await queryRunner.query(`
      CREATE TABLE "balance"."rakeback" (
        "userId" uuid NOT NULL,
        "accumulatedHouseSideCents" decimal(12,2) NOT NULL DEFAULT '0.00',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rakeback" PRIMARY KEY ("userId")
      )
    `);

    // Add comment
    await queryRunner.query(`
      COMMENT ON COLUMN "balance"."rakeback"."accumulatedHouseSideCents" IS 'Accumulated house side amount (bet amount * house edge) in cents'
    `);
  }
}
