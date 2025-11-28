import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrashProvablyFairTables1756263617578 implements MigrationInterface {
  name = 'AddCrashProvablyFairTables1756263617578';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "bonus"."bonuses_transactions_unique_period_idx"`);
    await queryRunner.query(`DROP INDEX "bonus"."bonuses_transactions_metadata_gin_idx"`);
    await queryRunner.query(
      `CREATE TABLE "games"."crash_game_state" ("id" integer NOT NULL DEFAULT '1', "currentGameIndex" integer NOT NULL DEFAULT '10000000', "lastUpdated" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_39ff8d9560c74621eaa61f8e2f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."crash_seeds" ("gameIndex" integer NOT NULL, "serverSeed" character varying(64) NOT NULL, CONSTRAINT "PK_633dc73dd3a878535fea70f3cd5" PRIMARY KEY ("gameIndex"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_633dc73dd3a878535fea70f3cd" ON "games"."crash_seeds" ("gameIndex") `,
    );
    await queryRunner.query(`ALTER TABLE "games"."crash_games" ADD "gameIndex" integer`);
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."rankUpBonusAmount" IS 'One-time bonus for moving between major ranks (first level of rank) in cents'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT 0.0000`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT 1.00000000`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 0.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."rankUpBonusAmount" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
    );
    await queryRunner.query(`ALTER TABLE "games"."crash_games" DROP COLUMN "gameIndex"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_633dc73dd3a878535fea70f3cd"`);
    await queryRunner.query(`DROP TABLE "games"."crash_seeds"`);
    await queryRunner.query(`DROP TABLE "games"."crash_game_state"`);
    await queryRunner.query(
      `CREATE INDEX "bonuses_transactions_metadata_gin_idx" ON "bonus"."bonuses_transactions" ("metadata") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "bonuses_transactions_unique_period_idx" ON "bonus"."bonuses_transactions" ("bonusType", "userId") WHERE (("bonusType")::text = ANY ((ARRAY['RAKEBACK'::character varying, 'WEEKLY_AWARD'::character varying, 'MONTHLY_AWARD'::character varying])::text[]))`,
    );
  }
}
