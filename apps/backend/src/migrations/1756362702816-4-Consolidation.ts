import { MigrationInterface, QueryRunner } from 'typeorm';

export class Consolidation1756362702816 implements MigrationInterface {
  name = '4-Consolidation-1756362702816';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let hasTable;
    let hasColumn;

    /*--- #1. Consolidated from 1755610811373-DailyGamblingStatsEntity.ts ---*/
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "users"."daily_gambling_stats_platformtype_enum" AS ENUM('SPORTS', 'CASINO', 'PLATFORM');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."daily_gambling_stats" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "date" date NOT NULL,
        "platformType" "users"."daily_gambling_stats_platformtype_enum" NOT NULL DEFAULT 'PLATFORM',
        "wagerAmountCents" numeric(20,0) NOT NULL DEFAULT '0',
        "winAmountCents" numeric(20,0) NOT NULL DEFAULT '0',
        "lossAmountCents" numeric(20,0) NOT NULL DEFAULT '0',
        "depositAmountCents" numeric(20,0) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_0430809df35ddbe7c69db1faef9" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_28e1f8463138914c05e05d2bee" ON "users"."daily_gambling_stats" ("userId", "date", "platformType")`,
    );
    hasColumn = await queryRunner.hasColumn('affiliate.affiliate_campaigns', 'code');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "affiliate"."affiliate_campaigns" ADD "code" character varying`,
      );
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_183093c4d10aaee7fe5df41e514'
        ) THEN
          ALTER TABLE IF EXISTS "affiliate"."affiliate_campaigns" ADD CONSTRAINT "UQ_183093c4d10aaee7fe5df41e514" UNIQUE ("code");
        END IF;
      END $$;
    `);
    hasColumn = await queryRunner.hasColumn('games.seed_pairs', 'nextServerSeed');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."seed_pairs" ADD COLUMN "nextServerSeed" character varying(64)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.seed_pairs', 'nextServerSeedHash');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."seed_pairs" ADD COLUMN "nextServerSeedHash" character varying(64)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    /*--- #2. Consolidated from 1755610811383-VaultAndWeeklyRacePrizes.ts ---*/
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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balance"."vaults" (
        "userId" uuid NOT NULL,
        "asset" "balance"."vaults_asset_enum" NOT NULL,
        "balance" numeric(20,8) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vaults_user_asset" PRIMARY KEY ("userId", "asset")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'balance' AND indexname = 'IDX_vaults_user_asset'
        ) THEN
          CREATE UNIQUE INDEX "IDX_vaults_user_asset" ON "balance"."vaults" ("userId", "asset");
        END IF;
      END $$;
    `);

    // Create balance.vault_history
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balance"."vault_history" (
        "operationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "asset" "balance"."vault_history_asset_enum" NOT NULL,
        "direction" "balance"."vault_history_direction_enum" NOT NULL,
        "amount" numeric(20,8) NOT NULL DEFAULT '0',
        "previousVaultBalance" numeric(20,8) NOT NULL DEFAULT '0',
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vault_history_operationId" PRIMARY KEY ("operationId")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'balance' AND indexname = 'IDX_vault_history_user_asset_created'
        ) THEN
          CREATE INDEX "IDX_vault_history_user_asset_created" ON "balance"."vault_history" ("userId", "asset", "createdAt");
        END IF;
      END $$;
    `);

    // Create games.weekly_race_prizes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."weekly_race_prizes" (
        "place" integer NOT NULL,
        "amountUsd" numeric(20,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weekly_race_prizes_place" PRIMARY KEY ("place")
      )
    `);

    // Seed default top-10 prize distribution (idempotent)
    await queryRunner.query(`
      INSERT INTO "games"."weekly_race_prizes" ("place", "amountUsd") VALUES
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
      ON CONFLICT ("place") DO NOTHING
    `);

    /*--- #3. Consolidated from 1755620000000-BonusVipTier_RemoveDaily_AddRankUp.ts ---*/
    hasTable = queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
      // Schema changes (deterministic, no branching)
      await queryRunner.query(
        `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN IF EXISTS "dailyBonusPercentage"`,
      );
      hasColumn = await queryRunner.hasColumn('bonus.bonuses_vip_tiers', 'rankUpBonusAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "rankUpBonusAmount" numeric(10,2) NULL`,
        );
      }
      // Reseed bonuses_vip_tiers with updated columns (drop daily, add rankUp)
      await queryRunner.query(
        `TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`,
      );
      await queryRunner.query(`
        INSERT INTO bonus.bonuses_vip_tiers (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
          "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount"
        )
        VALUES 
          (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL),
          (1, 'Bronze I', '250000.00', '1.00', '2.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00'),
          (2, 'Bronze II', '500000.00', '1.00', '2.50', '5000.00', '3.00', false, 'user-level/bronze-2', NULL),
          (3, 'Bronze III', '1000000.00', '1.50', '3.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL),
          (4, 'Bronze IV', '1500000.00', '1.50', '3.50', '15000.00', '3.50', false, 'user-level/bronze-4', NULL),
          (5, 'Silver I', '2500000.00', '2.00', '4.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00'),
          (6, 'Silver II', '5000000.00', '2.00', '4.50', '40000.00', '4.00', false, 'user-level/silver-2', NULL),
          (7, 'Silver III', '10000000.00', '2.50', '5.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL),
          (8, 'Silver IV', '15000000.00', '2.50', '5.50', '80000.00', '4.50', false, 'user-level/silver-4', NULL),
          (9, 'Gold I', '25000000.00', '3.00', '6.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00'),
          (10, 'Gold II', '50000000.00', '3.00', '6.50', '150000.00', '5.00', false, 'user-level/gold-2', NULL),
          (11, 'Gold III', '75000000.00', '3.50', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL),
          (12, 'Gold IV', '100000000.00', '3.50', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL),
          (13, 'Platinum I', '250000000.00', '4.00', '6.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00'),
          (14, 'Platinum II', '500000000.00', '4.00', '6.50', '600000.00', '6.00', true, 'user-level/platinum-2', NULL),
          (15, 'Platinum III', '750000000.00', '4.50', '7.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL),
          (16, 'Platinum IV', '1000000000.00', '4.50', '7.50', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL),
          (17, 'Sapphire I', '1500000000.00', '4.50', '7.50', '1200000.00', '6.50', true, 'user-level/sapphire-1', NULL),
          (18, 'Sapphire II', '2000000000.00', '4.50', '7.50', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL),
          (19, 'Sapphire III', '2500000000.00', '5.00', '8.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL),
          (20, 'Ruby I', '3000000000.00', '5.00', '8.00', '2500000.00', '7.00', true, 'user-level/ruby-1', NULL),
          (21, 'Ruby II', '4000000000.00', '5.00', '8.50', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL),
          (22, 'Ruby III', '5000000000.00', '5.00', '8.50', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL),
          (23, 'Diamond I', '7500000000.00', '5.00', '9.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00'),
          (24, 'Diamond II', '10000000000.00', '5.00', '9.50', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL), 
          (25, 'Diamond III', '15000000000.00', '5.50', '10.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL),
          (26, 'Zetik', '25000000000.00', '6.00', '10.00', '15000000.00', '8.00', true, 'user-level/zetik', NULL)
      `);
    }
    // --- Bonuses transactions timestamp fixes ---
    // 1) Add explicit updatedAt (audit) and expiredAt (semantic expiration time)
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'updatedAt');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'expiredAt');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ADD "expiredAt" TIMESTAMP NULL`,
      );
    }
    // 2) Ensure claimedAt is a plain nullable timestamp without default (not auto-updated)
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'claimedAt');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" TYPE TIMESTAMP`,
      );
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" DROP DEFAULT`,
      );
    }
    // 3) Backfill: move EXPIRED rows' claimedAt to expiredAt, then clear claimedAt unless actually claimed
    await queryRunner.query(
      `UPDATE "bonus"."bonuses_transactions" SET "expiredAt" = "claimedAt" WHERE status = 'EXPIRED' AND "claimedAt" IS NOT NULL AND "expiredAt" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "bonus"."bonuses_transactions" SET "claimedAt" = NULL WHERE status <> 'CLAIMED' AND "claimedAt" IS NOT NULL`,
    );
    // --- Periodic bonus uniqueness & metadata index ---
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "bonuses_transactions_unique_period_idx" ON "bonus"."bonuses_transactions" ("userId", "bonusType", ((metadata->>'periodKey')))
        WHERE "bonusType" IN ('RAKEBACK','WEEKLY_AWARD','MONTHLY_AWARD')
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "bonuses_transactions_metadata_gin_idx" ON "bonus"."bonuses_transactions"
        USING GIN ("metadata" jsonb_path_ops)
    `);

    /*--- #4. Consolidated from 1755665386590-UpdateBlackjackBetTypesToSideBets.ts ---*/
    // First, remove the old blackjack bet type data that represents calculated bets
    hasTable = queryRunner.hasTable('games.game_bet_type_limits');
    if (hasTable) {
      await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'games'
          AND t.typname='game_bet_type_limits_bettypecategory_enum'
          AND t.typtype = 'e'
          AND e.enumlabel IN ('blackjack_insurance', 'blackjack_split', 'blackjack_double')
        ) THEN
          DELETE FROM "games"."game_bet_type_limits" 
          WHERE "betTypeCategory" IN ('blackjack_insurance', 'blackjack_split', 'blackjack_double');
        END IF;
      END $$;
      `);
      // Update the enum to remove old categories and add new side bet categories
      // PostgreSQL requires dropping and recreating the enum to modify it
      // Create new enum with correct values
      await queryRunner.query(`
        DO $$ 
        BEGIN
          CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" AS ENUM(
            'roulette_inside',
            'roulette_outside', 
            'blackjack_main',
            'blackjack_21_plus_3',
            'blackjack_perfect_pairs',
            'default'
          );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
      // Update the table to use the new enum
      hasColumn = await queryRunner.hasColumn('games.game_bet_type_limits', 'betTypeCategory');
      if (hasColumn) {
        await queryRunner.query(`
          ALTER TABLE "games"."game_bet_type_limits" 
            ALTER COLUMN "betTypeCategory" TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
              USING "betTypeCategory"::text::"games"."game_bet_type_limits_bettypecategory_enum_new"
        `);
      }
      // Drop the old enum
      await queryRunner.query(
        `DROP TYPE IF EXISTS "games"."game_bet_type_limits_bettypecategory_enum"`,
      );
      // Rename the new enum to the original name
      await queryRunner.query(`
        ALTER TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
          RENAME TO "game_bet_type_limits_bettypecategory_enum"
      `);
      // Insert the new blackjack side bet data
      await queryRunner.query(`
        INSERT INTO "games"."game_bet_type_limits" 
        ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
        VALUES 
          ('blackjack', 'blackjack_21_plus_3', '21+3 side bet (based on first two cards and dealer up card)', 0.1, 1000, true, 'system', NOW(), NOW()),
          ('blackjack', 'blackjack_perfect_pairs', 'Perfect Pairs side bet (based on first two cards)', 0.1, 1000, true, 'system', NOW(), NOW())
        ON CONFLICT DO NOTHING
        `);
      // Update the main blackjack bet limit to match the $20K limit from general game limits
      await queryRunner.query(`
        UPDATE "games"."game_bet_type_limits" 
        SET "maxBetUsd" = 20000, "updatedAt" = NOW()
        WHERE "gameType" = 'blackjack' AND "betTypeCategory" = 'blackjack_main'
        `);
    }

    /*--- #5. Consolidated from 1755716864925-AddCardCursorToBlackjackGames.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."blackjack_games" DROP COLUMN IF EXISTS "deck"`,
    );
    if (!hasColumn) {
      hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'cardCursor');
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ADD "cardCursor" integer NOT NULL DEFAULT '0'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    /*--- #6. Consolidated form 1755760346694-AddInsuranceRejectedToBlackjackGames.ts ---*/
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'isInsuranceRejected');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ADD "isInsuranceRejected" boolean NOT NULL DEFAULT false`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    /*--- #7. Consolidated from 1755924008671-AddGameSettingsToSystemSettings.ts ---*/
    await queryRunner.query(
      `DROP INDEX IF EXISTS "balance"."IDX_vault_history_user_asset_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "balance"."IDX_vaults_user_asset"`);
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_18f52fb98025fa82a59de458ec" ON "balance"."vault_history" ("userId", "asset", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_8478e22bfdd4d4f2ba84f21e1e" ON "balance"."vaults" ("userId", "asset")`,
    );

    /*--- #8. Consolidated from 1755935098618-MakeClientSeedNullableInGameSession.ts ---*/
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.game_sessions', 'clientSeed');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."game_sessions" ALTER COLUMN "clientSeed" DROP NOT NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    /*--- #9. Consolidated from 1756263617578-AddCrashProvablyFairTables.ts ---*/
    await queryRunner.query(
      `DROP INDEX IF EXISTS "bonus"."bonuses_transactions_unique_period_idx"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."bonuses_transactions_metadata_gin_idx"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."crash_game_state" (
        "id" integer NOT NULL DEFAULT '1',
        "currentGameIndex" integer NOT NULL DEFAULT '10000000',
        "lastUpdated" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_39ff8d9560c74621eaa61f8e2f0" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."crash_seeds" (
        "gameIndex" integer NOT NULL,
        "serverSeed" character varying(64) NOT NULL,
        CONSTRAINT "PK_633dc73dd3a878535fea70f3cd5" PRIMARY KEY ("gameIndex")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_633dc73dd3a878535fea70f3cd" ON "games"."crash_seeds" ("gameIndex")`,
    );
    hasColumn = await queryRunner.hasColumn('games.crash_games', 'gameIndex');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_games" ADD "gameIndex" integer`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_vip_tiers', 'rankUpBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `COMMENT ON COLUMN "bonus"."bonuses_vip_tiers"."rankUpBonusAmount" IS 'One-time bonus for moving between major ranks (first level of rank) in cents'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    /*--- #10. Consolidated from 1756362702816-RemoveCrashPointLimit.ts ---*/
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.crash_games', 'crashPoint');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_games" ALTER COLUMN "crashPoint" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.crash_bets', 'cashOutAt');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "cashOutAt" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.crash_bets', 'autoCashOutAt');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "autoCashOutAt" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.game_results', 'outcomeValue');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."game_results" ALTER COLUMN "outcomeValue" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    let hasTable;
    let hasColumn;

    /*--- #9. Consolidated from 1756263617578-AddCrashProvablyFairTables.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."crash_games" DROP COLUMN IF EXISTS "gameIndex"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_633dc73dd3a878535fea70f3cd"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."crash_seeds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."crash_game_state"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "bonuses_transactions_metadata_gin_idx" ON "bonus"."bonuses_transactions"
        USING GIN ("metadata" jsonb_path_ops)
    `);
    // There might be duplicated records since unique index was dropped in "roll-up" - revert in "roll-down" without UNIQUE specified
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "bonuses_transactions_unique_period_idx" ON "bonus"."bonuses_transactions" ("bonusType", "userId")
        WHERE "bonusType" IN ('RAKEBACK','WEEKLY_AWARD','MONTHLY_AWARD')
    `);

    /*--- #8. Consolidated from 1755935098618-MakeClientSeedNullableInGameSession.ts ---*/
    /**  Game_sessions table might contains a NULL clientSeed. DON'T revert this
     *   hasColumn = await queryRunner.hasColumn('games.game_sessions', 'clientSeed');
     *   if (hasColumn) {
     *     await queryRunner.query(`ALTER TABLE IF EXISTS "games"."game_sessions" ALTER COLUMN "clientSeed" SET NOT NULL`);
     *   }
     */
    /*--- #7. Consolidated from 1755924008671-AddGameSettingsToSystemSettings.ts ---*/
    await queryRunner.query(`DROP INDEX IF EXISTS "balance"."IDX_8478e22bfdd4d4f2ba84f21e1e"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "balance"."IDX_18f52fb98025fa82a59de458ec"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vaults_user_asset" ON "balance"."vaults" ("asset", "userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vault_history_user_asset_created" ON "balance"."vault_history" ("asset", "createdAt", "userId") `,
    );

    /*--- #6. Consolidated form 1755760346694-AddInsuranceRejectedToBlackjackGames.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."blackjack_games" DROP COLUMN IF EXISTS "isInsuranceRejected"`,
    );

    /*--- #5. Consolidated from 1755716864925-AddCardCursorToBlackjackGames.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."blackjack_games" DROP COLUMN IF EXISTS "cardCursor"`,
    );
    await queryRunner.query(`ALTER TABLE "games"."blackjack_games" ADD "deck" jsonb`);

    /*--- #4. Consolidated from 1755665386590-UpdateBlackjackBetTypesToSideBets.ts ---*/
    hasTable = queryRunner.hasTable('games.game_bet_type_limits');
    if (hasTable) {
      // Remove the new side bet data
      await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'games'
          AND t.typname='game_bet_type_limits_bettypecategory_enum'
          AND t.typtype = 'e'
          AND e.enumlabel IN ('blackjack_21_plus_3', 'blackjack_perfect_pairs')
        ) THEN
          DELETE FROM "games"."game_bet_type_limits" 
          WHERE "betTypeCategory" IN ('blackjack_21_plus_3', 'blackjack_perfect_pairs');
        END IF;
      END $$;

      `);
      // Create old enum with original values
      await queryRunner.query(`
        DO $$ 
        BEGIN
          CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" AS ENUM(
            'roulette_inside',
            'roulette_outside', 
            'blackjack_main',
            'blackjack_insurance',
            'blackjack_split', 
            'blackjack_double',
            'default'
          );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
      // Update the table to use the old enum
      await queryRunner.query(`
        ALTER TABLE "games"."game_bet_type_limits" 
          ALTER COLUMN "betTypeCategory" TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
            USING "betTypeCategory"::text::"games"."game_bet_type_limits_bettypecategory_enum_new"
      `);
      // Drop the current enum
      await queryRunner.query(
        `DROP TYPE IF EXISTS "games"."game_bet_type_limits_bettypecategory_enum"`,
      );
      // Rename back
      await queryRunner.query(`
        ALTER TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
          RENAME TO "game_bet_type_limits_bettypecategory_enum"
      `);
      // Restore original blackjack bet limit
      await queryRunner.query(`
        UPDATE "games"."game_bet_type_limits" 
        SET "maxBetUsd" = 1000, "updatedAt" = NOW()
        WHERE "gameType" = 'blackjack' AND "betTypeCategory" = 'blackjack_main'
      `);
      // Re-insert the old calculated bet data
      await queryRunner.query(`
        INSERT INTO "games"."game_bet_type_limits" 
        ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
        VALUES 
          ('blackjack', 'blackjack_insurance', 'Insurance side bet (max 50% of main bet)', 0.05, 500, true, 'system', NOW(), NOW()),
          ('blackjack', 'blackjack_split', 'Split additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW()),
          ('blackjack', 'blackjack_double', 'Double down additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW())
        ON CONFLICT DO NOTHING
        `);
    }

    /*--- #3. Consolidated from 1755620000000-BonusVipTier_RemoveDaily_AddRankUp.ts ---*/
    // Revert schema (deterministic)
    hasTable = queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
      await queryRunner.query(
        `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN IF EXISTS "rankUpBonusAmount"`,
      );
      hasColumn = await queryRunner.hasColumn('bonus.bonuses_vip_tiers', 'dailyBonusPercentage');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "dailyBonusPercentage" numeric(5,2) NULL`,
        );
      }
      // Restore original seed (with dailyBonusPercentage)
      await queryRunner.query(
        `TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`,
      );
      await queryRunner.query(`
        INSERT INTO bonus.bonuses_vip_tiers (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
          "dailyBonusPercentage", "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl"
        )
        VALUES 
          (0, 'Visitor', '0.00', NULL, NULL, NULL, NULL, NULL, false, ''),
          (1, 'Bronze I', '1000000.00', '0.50', '1.50', NULL, '2500.00', '5.00', false, 'user-level/bronze-1'),
          (2, 'Bronze II', '5000000.00', '1.00', '3.00', NULL, '5000.00', '5.00', false, 'user-level/bronze-2'),
          (3, 'Bronze III', '10000000.00', '2.00', '5.00', '0.10', '10000.00', '5.00', false, 'user-level/bronze-3'),
          (4, 'Bronze IV', '25000000.00', '3.00', '8.00', '0.15', '25000.00', '6.00', false, 'user-level/bronze-4'),
          (5, 'Silver I', '50000000.00', '4.00', '10.00', '0.20', '50000.00', '7.00', false, 'user-level/silver-1'),
          (6, 'Silver II', '100000000.00', '5.00', '12.00', '0.25', '100000.00', '8.00', false, 'user-level/silver-2'),
          (7, 'Silver III', '200000000.00', '6.00', '15.00', '0.30', '200000.00', '9.00', false, 'user-level/silver-3'),
          (8, 'Silver IV', '400000000.00', '7.00', '18.00', '0.35', '400000.00', '10.00', false, 'user-level/silver-4'),
          (9, 'Gold I', '800000000.00', '8.00', '20.00', '0.40', '800000.00', '11.00', false, 'user-level/gold-1'),
          (10, 'Gold II', '1600000000.00', '9.00', '22.00', '0.45', '1600000.00', '12.00', false, 'user-level/gold-2'),
          (11, 'Gold III', '3200000000.00', '10.00', '25.00', '0.50', '3200000.00', '13.00', false, 'user-level/gold-3'),
          (12, 'Gold IV', '6400000000.00', '11.00', '28.00', '0.55', '6400000.00', '14.00', false, 'user-level/gold-4'),
          (13, 'Platinum I', '12800000000.00', '12.00', '30.00', '0.60', '12800000.00', '15.00', true, 'user-level/platinum-1'),
          (14, 'Platinum II', '25600000000.00', '13.00', '32.00', '0.65', '25600000.00', '16.00', true, 'user-level/platinum-2'),
          (15, 'Platinum III', '51200000000.00', '14.00', '35.00', '0.70', '51200000.00', '17.00', true, 'user-level/platinum-3'),
          (16, 'Platinum IV', '102400000000.00', '15.00', '38.00', '0.75', '99999999.99', '18.00', true, 'user-level/platinum-4'),
          (17, 'Sapphire I', '204800000000.00', '16.00', '40.00', '0.80', '99999999.99', '19.00', true, 'user-level/sapphire-1'),
          (18, 'Sapphire II', '409600000000.00', '17.00', '42.00', '0.85', '99999999.99', '20.00', true, 'user-level/sapphire-2'),
          (19, 'Sapphire III', '819200000000.00', '18.00', '45.00', '0.90', '99999999.99', '21.00', true, 'user-level/sapphire-3'),
          (20, 'Ruby I', '1638400000000.00', '19.00', '48.00', '0.95', '99999999.99', '22.00', true, 'user-level/ruby-1'),
          (21, 'Ruby II', '3276800000000.00', '20.00', '50.00', '1.00', '99999999.99', '23.00', true, 'user-level/ruby-2'),
          (22, 'Ruby III', '6553600000000.00', '21.00', '52.00', '1.05', '99999999.99', '24.00', true, 'user-level/ruby-3'),
          (23, 'Diamond I', '13107200000000.00', '22.00', '55.00', '1.10', '99999999.99', '25.00', true, 'user-level/diamond-1'),
          (24, 'Diamond II', '26214400000000.00', '23.00', '58.00', '1.15', '99999999.99', '26.00', true, 'user-level/diamond-2'),
          (25, 'Diamond III', '52428800000000.00', '24.00', '60.00', '1.20', '99999999.99', '27.00', true, 'user-level/diamond-3'),
          (26, 'Zetik', '104857600000000.00', '25.00', '65.00', '1.25', '99999999.99', '30.00', true, 'user-level/zetik')
      `);
    }
    // --- Revert bonuses_transactions timestamp changes ---
    await queryRunner.query(`DROP INDEX IF EXISTS "bonuses_transactions_metadata_gin_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "bonuses_transactions_unique_period_idx"`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" DROP COLUMN IF EXISTS "expiredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" DROP COLUMN IF EXISTS "updatedAt"`,
    );
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'claimedAt');
    if (hasColumn) {
      // Restore previous semantics approximation: default now() on claimedAt
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" SET DEFAULT now()`,
      );
    }

    /*--- #2. Consolidated from 1755610811383-VaultAndWeeklyRacePrizes.ts ---*/
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

    /*--- #1. Consolidated from 1755610811373-DailyGamblingStatsEntity.ts ---*/
    // Conditionally drop seed_pairs columns only if they exist
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."seed_pairs" DROP COLUMN IF EXISTS "nextServerSeedHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."seed_pairs" DROP COLUMN IF EXISTS "nextServerSeed"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "affiliate"."affiliate_campaigns" DROP CONSTRAINT IF EXISTS "UQ_183093c4d10aaee7fe5df41e514"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "affiliate"."affiliate_campaigns" DROP COLUMN IF EXISTS "code"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_28e1f8463138914c05e05d2bee"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."daily_gambling_stats"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users"."daily_gambling_stats_platformtype_enum"`);
  }
}
