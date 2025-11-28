import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeFiatFieldsPrecision1758585111412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Standardize DECIMAL precision across all fiat fields
    // Target: DECIMAL(20,2) for originalFiatAmount, DECIMAL(20,8) for fiatToUsdRate
    // This matches the user_bets table which handles the highest transaction volumes

    // Update blackjack_games (from 18,2 and 18,8 to 20,2 and 20,8)
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
    );

    // Update roulette_games (from 12,2 and 12,8 to 20,2 and 20,8)
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
    );

    // Update mines_games (from 12,2 and 12,8 to 20,2 and 20,8)
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
    );

    // Update crash_bets (from 12,2 and 12,8 to 20,2 and 20,8)
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
    );

    // Update dice_bets (from 18,2 and 18,8 to 20,2 and 20,8)
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
    );

    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping

    // user_bets table is already DECIMAL(20,2) and DECIMAL(20,8) - no change needed
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to original precision values (this may cause data loss if values exceed the smaller precision)

    // Revert blackjack_games (back to 18,2 and 18,8)
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(18,8)`,
    );

    // Revert roulette_games (back to 12,2 and 12,8)
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
    );

    // Revert mines_games (back to 12,2 and 12,8)
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
    );

    // Revert crash_bets (back to 12,2 and 12,8)
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
    );

    // Revert dice_bets (back to 18,2 and 18,8)
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."dice_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(18,8)`,
    );

    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping
  }
}
