import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingFiatFieldsToGameTables1758260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fiat currency tracking columns to dice_bets table
    await queryRunner.query(`
            ALTER TABLE "games"."dice_bets"
            ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL
        `);

    // Add fiat currency tracking columns to keno_games table
    await queryRunner.query(`
            ALTER TABLE "games"."keno_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL
        `);

    // Add fiat currency tracking columns to limbo_games table
    await queryRunner.query(`
            ALTER TABLE "games"."limbo_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL
        `);

    // Add fiat currency tracking columns to plinko_games table
    await queryRunner.query(`
            ALTER TABLE "games"."plinko_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL
        `);

    // Add enum constraints for originalFiatCurrency in all tables
    await queryRunner.query(`
            ALTER TABLE "games"."dice_bets"
            ADD CONSTRAINT "CHK_dice_bets_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."keno_games"
            ADD CONSTRAINT "CHK_keno_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."limbo_games"
            ADD CONSTRAINT "CHK_limbo_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."plinko_games"
            ADD CONSTRAINT "CHK_plinko_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the constraints first
    await queryRunner.query(`
            ALTER TABLE "games"."dice_bets"
            DROP CONSTRAINT IF EXISTS "CHK_dice_bets_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."keno_games"
            DROP CONSTRAINT IF EXISTS "CHK_keno_games_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."limbo_games"
            DROP CONSTRAINT IF EXISTS "CHK_limbo_games_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."plinko_games"
            DROP CONSTRAINT IF EXISTS "CHK_plinko_games_originalFiatCurrency"
        `);

    // Remove the columns
    await queryRunner.query(`
            ALTER TABLE "games"."dice_bets"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."keno_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."limbo_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."plinko_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);
  }
}
