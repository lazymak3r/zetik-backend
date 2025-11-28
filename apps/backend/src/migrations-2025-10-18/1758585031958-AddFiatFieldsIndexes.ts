import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFiatFieldsIndexes1758585031958 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes for fiat currency fields for improved query performance

    // Single field indexes on originalFiatCurrency for filtering
    await queryRunner.query(
      `CREATE INDEX "IDX_user_bets_originalFiatCurrency" ON "games"."user_bets" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blackjack_games_originalFiatCurrency" ON "games"."blackjack_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roulette_games_originalFiatCurrency" ON "games"."roulette_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mines_games_originalFiatCurrency" ON "games"."mines_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crash_bets_originalFiatCurrency" ON "games"."crash_bets" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dice_bets_originalFiatCurrency" ON "games"."dice_bets" ("originalFiatCurrency")`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping

    // Composite indexes on (originalFiatCurrency, createdAt) for time-based queries by currency
    await queryRunner.query(
      `CREATE INDEX "IDX_user_bets_fiatCurrency_createdAt" ON "games"."user_bets" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blackjack_games_fiatCurrency_createdAt" ON "games"."blackjack_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roulette_games_fiatCurrency_createdAt" ON "games"."roulette_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mines_games_fiatCurrency_createdAt" ON "games"."mines_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crash_bets_fiatCurrency_createdAt" ON "games"."crash_bets" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dice_bets_fiatCurrency_createdAt" ON "games"."dice_bets" ("originalFiatCurrency", "createdAt")`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping;

    // Indexes on originalFiatAmount for range queries and sorting (where it's not null)
    await queryRunner.query(
      `CREATE INDEX "IDX_user_bets_originalFiatAmount" ON "games"."user_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blackjack_games_originalFiatAmount" ON "games"."blackjack_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roulette_games_originalFiatAmount" ON "games"."roulette_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mines_games_originalFiatAmount" ON "games"."mines_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crash_bets_originalFiatAmount" ON "games"."crash_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dice_bets_originalFiatAmount" ON "games"."dice_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all fiat field indexes in reverse order

    // Drop originalFiatAmount indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_user_bets_originalFiatAmount"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_blackjack_games_originalFiatAmount"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_roulette_games_originalFiatAmount"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_mines_games_originalFiatAmount"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_crash_bets_originalFiatAmount"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_dice_bets_originalFiatAmount"`);
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping;

    // Drop composite indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_user_bets_fiatCurrency_createdAt"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_blackjack_games_fiatCurrency_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_roulette_games_fiatCurrency_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_mines_games_fiatCurrency_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_crash_bets_fiatCurrency_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_dice_bets_fiatCurrency_createdAt"`);
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping;

    // Drop single field indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_user_bets_originalFiatCurrency"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_blackjack_games_originalFiatCurrency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_roulette_games_originalFiatCurrency"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_mines_games_originalFiatCurrency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_crash_bets_originalFiatCurrency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_dice_bets_originalFiatCurrency"`);
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping
  }
}
