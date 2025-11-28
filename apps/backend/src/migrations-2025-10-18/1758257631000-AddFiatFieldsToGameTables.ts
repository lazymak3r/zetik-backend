import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFiatFieldsToGameTables1758257631000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fiat currency tracking columns to blackjack_games table
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL
        `);

    // Add fiat currency tracking columns to roulette_games table
    await queryRunner.query(`
            ALTER TABLE "games"."roulette_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL
        `);

    // Add fiat currency tracking columns to mines_games table
    await queryRunner.query(`
            ALTER TABLE "games"."mines_games"
            ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL
        `);

    // Add fiat currency tracking columns to crash_bets table
    await queryRunner.query(`
            ALTER TABLE "games"."crash_bets"
            ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL
        `);

    // Add enum constraints for originalFiatCurrency in all tables
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            ADD CONSTRAINT "CHK_blackjack_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."roulette_games"
            ADD CONSTRAINT "CHK_roulette_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."mines_games"
            ADD CONSTRAINT "CHK_mines_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."crash_bets"
            ADD CONSTRAINT "CHK_crash_bets_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the constraints first
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            DROP CONSTRAINT IF EXISTS "CHK_blackjack_games_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."roulette_games"
            DROP CONSTRAINT IF EXISTS "CHK_roulette_games_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."mines_games"
            DROP CONSTRAINT IF EXISTS "CHK_mines_games_originalFiatCurrency"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."crash_bets"
            DROP CONSTRAINT IF EXISTS "CHK_crash_bets_originalFiatCurrency"
        `);

    // Remove the columns
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."roulette_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."mines_games"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);

    await queryRunner.query(`
            ALTER TABLE "games"."crash_bets"
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency",
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);
  }
}
