import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaultAndWeeklyRacePrizes1755610811383 implements MigrationInterface {
  name = 'VaultAndWeeklyRacePrizes1755610811383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure schemas exist (idempotent)
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "games"');
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "balance"');

    // Create enums for vault tables if not exists
    await queryRunner.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vaults_asset_enum') THEN CREATE TYPE \"balance\".\"vaults_asset_enum\" AS ENUM('BTC','ETH','USDC','USDT','LTC','DOGE','TRX','XRP','SOL'); END IF; END $$;",
    );
    await queryRunner.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_history_asset_enum') THEN CREATE TYPE \"balance\".\"vault_history_asset_enum\" AS ENUM('BTC','ETH','USDC','USDT','LTC','DOGE','TRX','XRP','SOL'); END IF; END $$;",
    );
    await queryRunner.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_history_direction_enum') THEN CREATE TYPE \"balance\".\"vault_history_direction_enum\" AS ENUM('DEPOSIT','WITHDRAW'); END IF; END $$;",
    );

    // Create balance.vaults
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "balance"."vaults" (
        "userId" uuid NOT NULL,
        "asset" "balance"."vaults_asset_enum" NOT NULL,
        "balance" numeric(20,8) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vaults_user_asset" PRIMARY KEY ("userId", "asset")
      )`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'balance' AND indexname = 'IDX_vaults_user_asset'
        ) THEN
          CREATE UNIQUE INDEX "IDX_vaults_user_asset" ON "balance"."vaults" ("userId", "asset");
        END IF;
      END $$;`,
    );

    // Create balance.vault_history
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "balance"."vault_history" (
        "operationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "asset" "balance"."vault_history_asset_enum" NOT NULL,
        "direction" "balance"."vault_history_direction_enum" NOT NULL,
        "amount" numeric(20,8) NOT NULL DEFAULT '0',
        "previousVaultBalance" numeric(20,8) NOT NULL DEFAULT '0',
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vault_history_operationId" PRIMARY KEY ("operationId")
      )`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'balance' AND indexname = 'IDX_vault_history_user_asset_created'
        ) THEN
          CREATE INDEX "IDX_vault_history_user_asset_created" ON "balance"."vault_history" ("userId", "asset", "createdAt");
        END IF;
      END $$;`,
    );

    // Create games.weekly_race_prizes
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "games"."weekly_race_prizes" (
        "place" integer NOT NULL,
        "amountUsd" numeric(20,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weekly_race_prizes_place" PRIMARY KEY ("place")
      )`,
    );

    // Seed default top-10 prize distribution (idempotent)
    await queryRunner.query(
      `INSERT INTO "games"."weekly_race_prizes" ("place", "amountUsd") VALUES
        (1, '25000.00'),
        (2, '12000.00'),
        (3, '8000.00'),
        (4, '6000.00'),
        (5, '5000.00'),
        (6, '3500.00'),
        (7, '2500.00'),
        (8, '2000.00'),
        (9, '1500.00'),
        (10,'1000.00')
      ON CONFLICT ("place") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded prizes
    await queryRunner.query('DELETE FROM "games"."weekly_race_prizes"');
    await queryRunner.query('DROP TABLE IF EXISTS "games"."weekly_race_prizes"');

    // Drop vault history, vaults and enums
    await queryRunner.query(
      'DROP INDEX IF EXISTS "balance"."IDX_vault_history_user_asset_created"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "balance"."vault_history"');
    await queryRunner.query('DROP TABLE IF EXISTS "balance"."vaults"');
    await queryRunner.query('DROP INDEX IF EXISTS "balance"."IDX_vaults_user_asset"');

    await queryRunner.query(
      'DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = \'vault_history_direction_enum\') THEN DROP TYPE "balance"."vault_history_direction_enum"; END IF; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = \'vault_history_asset_enum\') THEN DROP TYPE "balance"."vault_history_asset_enum"; END IF; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = \'vaults_asset_enum\') THEN DROP TYPE "balance"."vaults_asset_enum"; END IF; END $$;',
    );
  }
}
