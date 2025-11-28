import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFiatFieldsToUserBets1757662600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fiat currency tracking columns to user_bets table
    await queryRunner.query(`
            ALTER TABLE "games"."user_bets" 
            ADD COLUMN "originalFiatAmount" DECIMAL(20,2) NULL,
            ADD COLUMN "originalFiatCurrency" VARCHAR(10) NULL,
            ADD COLUMN "fiatToUsdRate" DECIMAL(20,8) NULL
        `);

    // Add enum constraint for originalFiatCurrency
    await queryRunner.query(`
            ALTER TABLE "games"."user_bets" 
            ADD CONSTRAINT "CHK_user_bets_originalFiatCurrency" 
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the constraint first
    await queryRunner.query(`
            ALTER TABLE "games"."user_bets" 
            DROP CONSTRAINT IF EXISTS "CHK_user_bets_originalFiatCurrency"
        `);

    // Remove the columns
    await queryRunner.query(`
            ALTER TABLE "games"."user_bets" 
            DROP COLUMN IF EXISTS "originalFiatAmount",
            DROP COLUMN IF EXISTS "originalFiatCurrency", 
            DROP COLUMN IF EXISTS "fiatToUsdRate"
        `);
  }
}
