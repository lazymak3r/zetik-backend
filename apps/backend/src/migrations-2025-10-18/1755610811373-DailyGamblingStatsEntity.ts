import { MigrationInterface, QueryRunner } from 'typeorm';

export class DailyGamblingStatsEntity1755610811373 implements MigrationInterface {
  name = 'DailyGamblingStatsEntity1755610811373';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "users"."daily_gambling_stats_platformtype_enum" AS ENUM('SPORTS', 'CASINO', 'PLATFORM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users"."daily_gambling_stats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "date" date NOT NULL, "platformType" "users"."daily_gambling_stats_platformtype_enum" NOT NULL DEFAULT 'PLATFORM', "wagerAmountCents" numeric(20,0) NOT NULL DEFAULT '0', "winAmountCents" numeric(20,0) NOT NULL DEFAULT '0', "lossAmountCents" numeric(20,0) NOT NULL DEFAULT '0', "depositAmountCents" numeric(20,0) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0430809df35ddbe7c69db1faef9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_28e1f8463138914c05e05d2bee" ON "users"."daily_gambling_stats" ("userId", "date", "platformType") `,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate"."affiliate_campaigns" ADD "code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate"."affiliate_campaigns" ADD CONSTRAINT "UQ_183093c4d10aaee7fe5df41e514" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."seed_pairs" ADD COLUMN IF NOT EXISTS "nextServerSeed" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."seed_pairs" ADD COLUMN IF NOT EXISTS "nextServerSeedHash" character varying(64)`,
    );

    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
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
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
    );

    // Conditionally drop seed_pairs columns only if they exist
    const nextServerSeedHashExists = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'games' AND table_name = 'seed_pairs' AND column_name = 'nextServerSeedHash'`,
    );
    if (nextServerSeedHashExists.length > 0) {
      await queryRunner.query(`ALTER TABLE "games"."seed_pairs" DROP COLUMN "nextServerSeedHash"`);
    }

    const nextServerSeedExists = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'games' AND table_name = 'seed_pairs' AND column_name = 'nextServerSeed'`,
    );
    if (nextServerSeedExists.length > 0) {
      await queryRunner.query(`ALTER TABLE "games"."seed_pairs" DROP COLUMN "nextServerSeed"`);
    }

    await queryRunner.query(
      `ALTER TABLE "affiliate"."affiliate_campaigns" DROP CONSTRAINT "UQ_183093c4d10aaee7fe5df41e514"`,
    );
    await queryRunner.query(`ALTER TABLE "affiliate"."affiliate_campaigns" DROP COLUMN "code"`);
    await queryRunner.query(`DROP INDEX "users"."IDX_28e1f8463138914c05e05d2bee"`);
    await queryRunner.query(`DROP TABLE "users"."daily_gambling_stats"`);
    await queryRunner.query(`DROP TYPE "users"."daily_gambling_stats_platformtype_enum"`);
  }
}
