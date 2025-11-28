import { MigrationInterface, QueryRunner } from 'typeorm';

export class Consolidation1760681402634 implements MigrationInterface {
  name = '6-Consolidation-1760681402634';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let hasTable;
    let hasColumn;

    /*--- #1. Consolidated from 1757497300000-CreateNotificationsTable.ts ---*/
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."notifications" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
          "userId" uuid NOT NULL, 
          "type" character varying(100) NOT NULL, 
          "title" character varying(255) NOT NULL, 
          "message" text NOT NULL, 
          "data" jsonb, 
          "isRead" boolean NOT NULL DEFAULT false, 
          "isDeleted" boolean NOT NULL DEFAULT false, 
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
          "readAt" TIMESTAMP, 
          "deletedAt" TIMESTAMP, 
          CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
      ); 
      COMMENT ON COLUMN "users"."notifications"."userId" IS 'User ID who should receive the notification'; 
      COMMENT ON COLUMN "users"."notifications"."type" IS 'Type of notification (deposit, withdrawal, etc.)'; 
      COMMENT ON COLUMN "users"."notifications"."title" IS 'Notification title'; 
      COMMENT ON COLUMN "users"."notifications"."message" IS 'Notification message'; 
      COMMENT ON COLUMN "users"."notifications"."data" IS 'Additional notification data'; 
      COMMENT ON COLUMN "users"."notifications"."isRead" IS 'Whether the notification has been read by the user'; 
      COMMENT ON COLUMN "users"."notifications"."isDeleted" IS 'Whether the notification has been deleted by the user';
    `);

    /*--- #2. Consolidated from 1757500000000-AddSportsbookTables.ts ---*/
    // Create enum types for sportsbook bets
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."sportsbook_bets_status_enum" AS ENUM('pending', 'active', 'won', 'lost', 'canceled', 'refund', 'cashed out', 'half-won', 'half-lost', 'open');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."sportsbook_bets_bettype_enum" AS ENUM('single', 'accumulator', 'system', 'chain');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."sportsbook_bets_bonustype_enum" AS ENUM('freebet_refund', 'freebet_freemoney', 'freebet_no_risk', 'global_comboboost', 'comboboost');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    // Create sportsbook_bets table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."sportsbook_bets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "extTransactionId" character varying(100) NOT NULL,
        "betslipId" character varying(100) NOT NULL,
        "betAmount" numeric(20,8) NOT NULL,
        "potentialWin" numeric(20,8),
        "potentialComboboostWin" numeric(20,8),
        "actualWin" numeric(20,8),
        "totalOdds" numeric(10,4) NOT NULL,
        "asset" "balance"."wallets_asset_enum" NOT NULL DEFAULT 'USDT',
        "currency" "users"."users_currentcurrency_enum" NOT NULL DEFAULT 'USD',
        "status" "games"."sportsbook_bets_status_enum" NOT NULL DEFAULT 'pending',
        "betType" "games"."sportsbook_bets_bettype_enum" NOT NULL DEFAULT 'single',
        "bonusId" character varying(100),
        "bonusType" "games"."sportsbook_bets_bonustype_enum",
        "comboboostMultiplier" character varying(20),
        "selections" jsonb NOT NULL,
        "isQuickBet" boolean NOT NULL DEFAULT false,
        "acceptOddsChange" boolean NOT NULL DEFAULT false,
        "isCashout" boolean NOT NULL DEFAULT false,
        "isSnrLost" boolean NOT NULL DEFAULT false,
        "betCommitOperationId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sportsbook_bets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sportsbook_bets_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE
      )
    `);
    // Create indexes for sportsbook_bets
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sportsbook_bets_userId_status" ON "games"."sportsbook_bets" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sportsbook_bets_userId_createdAt" ON "games"."sportsbook_bets" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sportsbook_bets_betslipId" ON "games"."sportsbook_bets" ("betslipId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sportsbook_bets_extTransactionId" ON "games"."sportsbook_bets" ("extTransactionId")`,
    );

    /*--- #3. Consolidated from 1757662600000-AddFiatFieldsToUserBets.ts ---*/
    // Add fiat currency tracking columns to user_bets table
    hasColumn = await queryRunner.hasColumn('games.user_bets', 'originalFiatAmount');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."user_bets" ADD COLUMN "originalFiatAmount" DECIMAL(20,2) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.user_bets', 'originalFiatCurrency');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."user_bets" ADD COLUMN "originalFiatCurrency" VARCHAR(10) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.user_bets', 'fiatToUsdRate');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."user_bets" ADD COLUMN "fiatToUsdRate" DECIMAL(20,8) NULL`,
      );
    }
    // Add enum constraint for originalFiatCurrency
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_user_bets_originalFiatCurrency'
        ) THEN
          ALTER TABLE IF EXISTS "games"."user_bets" ADD CONSTRAINT "CHK_user_bets_originalFiatCurrency" 
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);

    /*--- #4. Consolidated from 1758257631000-AddFiatFieldsToGameTables.ts ---*/
    // Add fiat currency tracking columns to blackjack_games table
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'originalFiatAmount');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ADD COLUMN "originalFiatAmount" DECIMAL(18,2) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'originalFiatCurrency');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'fiatToUsdRate');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ADD COLUMN "fiatToUsdRate" DECIMAL(18,8) NULL`,
      );
    }
    // Add fiat currency tracking columns to roulette_games table
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'originalFiatAmount');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'originalFiatCurrency');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'fiatToUsdRate');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL`,
      );
    }
    // Add fiat currency tracking columns to mines_games table
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'originalFiatAmount');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'originalFiatCurrency');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'fiatToUsdRate');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL`,
      );
    }
    // Add fiat currency tracking columns to crash_bets table
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'originalFiatAmount');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ADD COLUMN "originalFiatAmount" DECIMAL(12,2) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'originalFiatCurrency');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ADD COLUMN "originalFiatCurrency" VARCHAR(3) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'fiatToUsdRate');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ADD COLUMN "fiatToUsdRate" DECIMAL(12,8) NULL`,
      );
    }
    // Add enum constraints for originalFiatCurrency in all tables
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_blackjack_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."blackjack_games" ADD CONSTRAINT "CHK_blackjack_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_roulette_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."roulette_games" ADD CONSTRAINT "CHK_roulette_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mines_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."mines_games" ADD CONSTRAINT "CHK_mines_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_crash_bets_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."crash_bets" ADD CONSTRAINT "CHK_crash_bets_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);

    /*--- #5. Consolidated from 1758260000000-AddMissingFiatFieldsToGameTables.ts ---*/
    // Add fiat currency tracking columns to dice_bets table
    hasTable = await queryRunner.hasTable('games.dice_bets');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "originalFiatAmount" DECIMAL(18,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatCurrency');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "originalFiatCurrency" VARCHAR(3) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'fiatToUsdRate');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "fiatToUsdRate" DECIMAL(18,8) NULL`,
        );
      }
    }
    // Add fiat currency tracking columns to keno_games table
    hasTable = await queryRunner.hasTable('games.keno_games');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('games.keno_games', 'originalFiatAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."keno_games" ADD "originalFiatAmount" DECIMAL(18,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.keno_games', 'originalFiatCurrency');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."keno_games" ADD "originalFiatCurrency" VARCHAR(3) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.keno_games', 'fiatToUsdRate');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."keno_games" ADD "fiatToUsdRate" DECIMAL(18,8) NULL`,
        );
      }
    }
    // Add fiat currency tracking columns to limbo_games table
    hasTable = await queryRunner.hasTable('games.limbo_games');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('games.limbo_games', 'originalFiatAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."limbo_games" ADD "originalFiatAmount" DECIMAL(18,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.limbo_games', 'originalFiatCurrency');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."limbo_games" ADD "originalFiatCurrency" VARCHAR(3) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.limbo_games', 'fiatToUsdRate');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."limbo_games" ADD "fiatToUsdRate" DECIMAL(18,8) NULL`,
        );
      }
    }
    // Add fiat currency tracking columns to plinko_games table
    hasTable = await queryRunner.hasTable('games.plinko_games');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('games.plinko_games', 'originalFiatAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."plinko_games" ADD "originalFiatAmount" DECIMAL(18,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.plinko_games', 'originalFiatCurrency');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."plinko_games" ADD "originalFiatCurrency" VARCHAR(3) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.plinko_games', 'fiatToUsdRate');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."plinko_games" ADD "fiatToUsdRate" DECIMAL(18,8) NULL`,
        );
      }
    }
    // Add enum constraints for originalFiatCurrency in all tables
    hasTable = await queryRunner.hasTable('games.dice_bets');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatAmount');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "originalFiatAmount" DECIMAL(18,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatCurrency');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "originalFiatCurrency" VARCHAR(3) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn('games.dice_bets', 'fiatToUsdRate');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "games"."dice_bets" ADD "fiatToUsdRate" DECIMAL(18,8) NULL`,
        );
      }
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_keno_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE IF EXISTS "games"."keno_games"
            ADD CONSTRAINT "CHK_keno_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_limbo_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."limbo_games"
            ADD CONSTRAINT "CHK_limbo_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_plinko_games_originalFiatCurrency'
        ) THEN
          ALTER TABLE "games"."plinko_games"
            ADD CONSTRAINT "CHK_plinko_games_originalFiatCurrency"
            CHECK ("originalFiatCurrency" IN ('USD','EUR','MXN','BRL','JPY','IDR','CAD','CNY','DKK','KRW','INR','PHP','TRY','NZD','ARS','RUB','VND'));
        END IF;
      END $$;
    `);

    /*--- #6. Consolidated from 1758260000010-RakebackMultiCurrency.ts ---*/
    /* Risk of dropping existing new version of table and metadata if re-execute this scripts
     * Modified checking logic below
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
    */
    const isNewVersionTable = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'balance'
        AND table_name = 'rakeback'
        AND column_name = 'accumulatedHouseSideAmount'
        AND data_type = 'numeric'
        AND numeric_precision_radix = 10
        AND numeric_precision = 18
        AND numeric_scale = 8
      )
    `);
    if (!isNewVersionTable) {
      // Drop existing table
      await queryRunner.query(`DROP TABLE IF EXISTS "balance"."rakeback"`);
      // Create table with new structure
      await queryRunner.query(`
        CREATE TABLE "balance"."rakeback" (
          "userId" uuid NOT NULL,
          "asset" varchar(10) NOT NULL,
          "accumulatedHouseSideAmount" decimal(18,8) NOT NULL DEFAULT '0.00000000',
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_rakeback_userId_asset" PRIMARY KEY ("userId", "asset")
        );
        COMMENT ON COLUMN "balance"."rakeback"."userId" IS 'User ID';
        COMMENT ON COLUMN "balance"."rakeback"."asset" IS 'Asset type (BTC, ETH, USDT, etc.);
        COMMENT ON COLUMN "balance"."rakeback"."accumulatedHouseSideAmount" IS 'Accumulated house side amount in native asset'
      `);
    }
    // Note: We don't restore backup data as old USD data is incompatible with new multi-currency structure
    // Users will start with clean rakeback state

    /*--- #7. Consolidated from 1758585031958-AddFiatFieldsIndexes.ts ---*/
    // Add indexes for fiat currency fields for improved query performance
    // Single field indexes on originalFiatCurrency for filtering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_bets_originalFiatCurrency" ON "games"."user_bets" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blackjack_games_originalFiatCurrency" ON "games"."blackjack_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_roulette_games_originalFiatCurrency" ON "games"."roulette_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mines_games_originalFiatCurrency" ON "games"."mines_games" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crash_bets_originalFiatCurrency" ON "games"."crash_bets" ("originalFiatCurrency")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dice_bets_originalFiatCurrency" ON "games"."dice_bets" ("originalFiatCurrency")`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping
    // Composite indexes on (originalFiatCurrency, createdAt) for time-based queries by currency
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_bets_fiatCurrency_createdAt" ON "games"."user_bets" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blackjack_games_fiatCurrency_createdAt" ON "games"."blackjack_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_roulette_games_fiatCurrency_createdAt" ON "games"."roulette_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mines_games_fiatCurrency_createdAt" ON "games"."mines_games" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crash_bets_fiatCurrency_createdAt" ON "games"."crash_bets" ("originalFiatCurrency", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dice_bets_fiatCurrency_createdAt" ON "games"."dice_bets" ("originalFiatCurrency", "createdAt")`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping;
    // Indexes on originalFiatAmount for range queries and sorting (where it's not null)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_bets_originalFiatAmount" ON "games"."user_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blackjack_games_originalFiatAmount" ON "games"."blackjack_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_roulette_games_originalFiatAmount" ON "games"."roulette_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mines_games_originalFiatAmount" ON "games"."mines_games" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crash_bets_originalFiatAmount" ON "games"."crash_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dice_bets_originalFiatAmount" ON "games"."dice_bets" ("originalFiatAmount") WHERE "originalFiatAmount" IS NOT NULL`,
    );
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping

    /*--- #8. Consolidated from 1758585111412-StandardizeFiatFieldsPrecision.ts ---*/
    // Standardize DECIMAL precision across all fiat fields
    // Target: DECIMAL(20,2) for originalFiatAmount, DECIMAL(20,8) for fiatToUsdRate
    // This matches the user_bets table which handles the highest transaction volumes
    // Update blackjack_games (from 18,2 and 18,8 to 20,2 and 20,8)
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
      );
    }
    // Update roulette_games (from 12,2 and 12,8 to 20,2 and 20,8)
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
      );
    }
    // Update mines_games (from 12,2 and 12,8 to 20,2 and 20,8)
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
      );
    }
    // Update crash_bets (from 12,2 and 12,8 to 20,2 and 20,8)
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."crash_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."crash_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
      );
    }
    // Update dice_bets (from 18,2 and 18,8 to 20,2 and 20,8)
    hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."dice_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(20,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.dice_bets', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."dice_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(20,8)`,
      );
    }
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping
    // user_bets table is already DECIMAL(20,2) and DECIMAL(20,8) - no change needed

    /*--- #9. Consolidated from 1758636734949-HouseEdge.ts ---*/
    hasTable = await queryRunner.hasTable('games.provider_games');
    hasColumn = await queryRunner.hasColumn('games.provider_games', 'houseEdge');
    if (hasTable && !hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."provider_games" ADD "houseEdge" DECIMAL(5,2) NOT NULL DEFAULT 1.00`,
      );
      await queryRunner.query(
        `UPDATE "games"."provider_games" SET "houseEdge" = COALESCE(100 - "rtp", 1.00)`,
      );
    }

    /*--- #10. Consolidated from 1759303838389-AddVaultIdPaymentsWallets.ts ---*/
    hasColumn = await queryRunner.hasColumn('payments.wallets', 'vaultId');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."wallets" ADD "vaultId" character varying`,
      );
    }

    /*--- #11. Consolidated from 1759380000000-CreateUniversalRaceSystem.ts ---*/
    // Move weekly_race_prizes from games to bonus schema (if not already moved)
    const weeklyPrizesInGames = await queryRunner.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'games' AND table_name = 'weekly_race_prizes')`,
    );
    const weeklyPrizesInBonus = await queryRunner.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'bonus' AND table_name = 'weekly_race_prizes')`,
    );
    if (weeklyPrizesInGames[0].exists && !weeklyPrizesInBonus[0].exists) {
      // Move from games to bonus
      await queryRunner.query(`ALTER TABLE games.weekly_race_prizes SET SCHEMA bonus`);
    } else if (weeklyPrizesInGames[0].exists && weeklyPrizesInBonus[0].exists) {
      // Both exist - drop from games, keep in bonus
      await queryRunner.query(`DROP TABLE games.weekly_race_prizes CASCADE`);
    }
    // Drop old weekly race tables
    await queryRunner.query(`DROP TABLE IF EXISTS games.weekly_race_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS games.weekly_races CASCADE`);
    // Create universal races table in bonus schema (if not exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bonus.races (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        "startsAt" TIMESTAMP NOT NULL,
        "endsAt" TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "prizePool" DECIMAL(20, 2) NOT NULL,
        prizes DECIMAL[] NOT NULL,
        asset VARCHAR(10) NULL,
        fiat VARCHAR(3) NULL,
        "referralCode" VARCHAR(50) NULL,
        "sponsorId" UUID NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add constraint if table already exists but constraint doesn't
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_asset_or_fiat'
        ) THEN
          ALTER TABLE IF EXISTS bonus.races ADD CONSTRAINT "chk_asset_or_fiat"
            CHECK (
            (asset IS NOT NULL AND fiat IS NULL) OR 
            (asset IS NULL AND fiat IS NOT NULL)
            );
        END IF;
      END $$;
    `);
    // Create universal race_participants table (if not exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bonus.race_participants (
        "raceId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "totalWageredCents" BIGINT NOT NULL DEFAULT 0,
        place INT NULL,
        reward DECIMAL(20, 2) NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY ("raceId", "userId")
      )
    `);
    // Add foreign key constraints if they don't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_race_participants_race'
        ) THEN
          ALTER TABLE IF EXISTS bonus.race_participants ADD CONSTRAINT "fk_race_participants_race" 
            FOREIGN KEY ("raceId") REFERENCES bonus.races(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_race_participants_user'
        ) THEN
          ALTER TABLE IF EXISTS bonus.race_participants ADD CONSTRAINT "fk_race_participants_user" 
            FOREIGN KEY ("userId") REFERENCES users.users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    // Create indexes for query optimization
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_races_status" ON bonus.races(status)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_referral_code" ON bonus.races("referralCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_sponsor_id" ON bonus.races("sponsorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_starts_at" ON bonus.races("startsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_ends_at" ON bonus.races("endsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_user_id" ON bonus.race_participants("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_place" ON bonus.race_participants(place)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_wagered" ON bonus.race_participants("totalWageredCents" DESC)`,
    );
    // Additional performance indexes from code review
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_weekly_active" ON bonus.races(status) WHERE "sponsorId" IS NULL AND "referralCode" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_sponsor_status" ON bonus.races("sponsorId", status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_race_wager" ON bonus.race_participants("raceId", "totalWageredCents" DESC)`,
    );
    // Clear and populate weekly_race_prizes table with default prize structure (only if empty)
    const prizeCount = await queryRunner.query(`SELECT COUNT(*) FROM bonus.weekly_race_prizes`);
    if (parseInt(prizeCount[0].count) === 0) {
      // Insert 50 prize places for weekly race
      await queryRunner.query(`
        INSERT INTO bonus.weekly_race_prizes (place, "amountUsd", "createdAt", "updatedAt")
          VALUES
          (1, 20000, NOW(), NOW()),
          (2, 10000, NOW(), NOW()),
          (3, 5000, NOW(), NOW()),
          (4, 2000, NOW(), NOW()),
          (5, 1500, NOW(), NOW()),
          (6, 1000, NOW(), NOW()),
          (7, 900, NOW(), NOW()),
          (8, 800, NOW(), NOW()),
          (9, 700, NOW(), NOW()),
          (10, 600, NOW(), NOW()),
          (11, 500, NOW(), NOW()),
          (12, 500, NOW(), NOW()),
          (13, 500, NOW(), NOW()),
          (14, 500, NOW(), NOW()),
          (15, 400, NOW(), NOW()),
          (16, 400, NOW(), NOW()),
          (17, 400, NOW(), NOW()),
          (18, 400, NOW(), NOW()),
          (19, 300, NOW(), NOW()),
          (20, 300, NOW(), NOW()),
          (21, 300, NOW(), NOW()),
          (22, 300, NOW(), NOW()),
          (23, 200, NOW(), NOW()),
          (24, 200, NOW(), NOW()),
          (25, 200, NOW(), NOW()),
          (26, 200, NOW(), NOW()),
          (27, 100, NOW(), NOW()),
          (28, 100, NOW(), NOW()),
          (29, 100, NOW(), NOW()),
          (30, 100, NOW(), NOW()),
          (31, 100, NOW(), NOW()),
          (32, 100, NOW(), NOW()),
          (33, 100, NOW(), NOW()),
          (34, 100, NOW(), NOW()),
          (35, 100, NOW(), NOW()),
          (36, 100, NOW(), NOW()),
          (37, 100, NOW(), NOW()),
          (38, 100, NOW(), NOW()),
          (39, 100, NOW(), NOW()),
          (40, 100, NOW(), NOW()),
          (41, 50, NOW(), NOW()),
          (42, 50, NOW(), NOW()),
          (43, 50, NOW(), NOW()),
          (44, 50, NOW(), NOW()),
          (45, 50, NOW(), NOW()),
          (46, 50, NOW(), NOW()),
          (47, 50, NOW(), NOW()),
          (48, 50, NOW(), NOW()),
          (49, 50, NOW(), NOW()),
          (50, 50, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
      // Update existing rows
      await queryRunner.query(`
        UPDATE bonus.weekly_race_prizes 
        SET "amountUsd" = data."amountUsd", "updatedAt" = NOW()
        FROM (VALUES
          (1, 20000),
          (2, 10000),
          (3, 5000),
          (4, 2000),
          (5, 1500),
          (6, 1000),
          (7, 900),
          (8, 800),
          (9, 700),
          (10, 600),
          (11, 500),
          (12, 500),
          (13, 500),
          (14, 500),
          (15, 400),
          (16, 400),
          (17, 400),
          (18, 400),
          (19, 300),
          (20, 300),
          (21, 300),
          (22, 300),
          (23, 200),
          (24, 200),
          (25, 200),
          (26, 200),
          (27, 100),
          (28, 100),
          (29, 100),
          (30, 100),
          (31, 100),
          (32, 100),
          (33, 100),
          (34, 100),
          (35, 100),
          (36, 100),
          (37, 100),
          (38, 100),
          (39, 100),
          (40, 100),
          (41, 50),
          (42, 50),
          (43, 50),
          (44, 50),
          (45, 50),
          (46, 50),
          (47, 50),
          (48, 50),
          (49, 50),
          (50, 50)
        ) AS data(place, "amountUsd")
        WHERE bonus.weekly_race_prizes.place = data.place
      `);
    }

    /*--- #12. Consolidated from 1759953460777-AddDescriptionToBalanceHistory.ts ---*/
    hasTable = await queryRunner.hasTable('balance.balance_history');
    hasColumn = await queryRunner.hasColumn('balance.balance_history', 'description');
    if (hasTable && !hasColumn) {
      await queryRunner.query(
        `ALTER TABLE balance.balance_history ADD COLUMN description varchar(255) NULL`,
      );
      // Backfill existing NULL/empty descriptions to 'Other'
      await queryRunner.query(
        `UPDATE balance.balance_history SET description = 'Other' WHERE description IS NULL OR btrim(description) = ''`,
      );
    }

    /*--- #13. Consolidated from 176008992480-AddKenoToHouseEdge.ts ---*/
    await queryRunner.query(`
      INSERT INTO games.house_edge (game, edge)
      VALUES ('keno', 1.00)
      ON CONFLICT (game) DO UPDATE SET edge = EXCLUDED.edge
    `);

    /*--- #14. Consolidated from 1760097000000-AddUniqueSeedPairConstraint.ts ---*/
    /**
     * Migration: Add unique constraint for active seed pairs
     *
     * Purpose: Enforce database-level constraint to prevent race conditions
     * when creating initial seed pairs for users.
     *
     * Constraint: Only ONE active seed pair per user at any time
     * Implementation: Partial unique index on (userId) WHERE isActive = true
     *
     * This prevents duplicate active seed pairs that can occur when:
     * - Multiple concurrent requests create the first bet for a new user
     * - Parallel API calls attempt to initialize seed pairs simultaneously
     *
     * The constraint is backward-compatible:
     * - Existing data is already valid (no duplicate active pairs exist)
     * - Historical inactive seed pairs are not affected (WHERE clause)
     * - PostgreSQL partial indexes are performant and well-supported
     *
     * Error handling:
     * - Violation of this constraint triggers a database error
     * - Existing retry logic in provably-fair.service.ts handles failures
     * - Transaction rollback ensures data consistency
     */
    // Create partial unique index to enforce only one active seed pair per user
    // This index only applies to rows where isActive = true
    // Multiple inactive seed pairs per user are still allowed (seed history)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seed_pairs_userId_active_unique" ON games.seed_pairs ("userId") WHERE "isActive" = true`,
    );

    /*--- #15. Consolidated from 1760653278234-CreateMonthlyRacePrizes.ts ---*/
    // Create bonus.monthly_race_prizes table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "bonus"."monthly_race_prizes" (
        "place" integer NOT NULL,
        "amountUsd" numeric(20,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_monthly_race_prizes_place" PRIMARY KEY ("place")
      )`,
    );
    // Seed monthly race prizes with 2x weekly values (top 50)
    await queryRunner.query(
      `INSERT INTO "bonus"."monthly_race_prizes" ("place", "amountUsd") VALUES
        (1, '40000.00'),
        (2, '20000.00'),
        (3, '10000.00'),
        (4, '4000.00'),
        (5, '3000.00'),
        (6, '2000.00'),
        (7, '1800.00'),
        (8, '1600.00'),
        (9, '1400.00'),
        (10, '1200.00'),
        (11, '1000.00'),
        (12, '1000.00'),
        (13, '1000.00'),
        (14, '1000.00'),
        (15, '800.00'),
        (16, '800.00'),
        (17, '800.00'),
        (18, '800.00'),
        (19, '600.00'),
        (20, '600.00'),
        (21, '600.00'),
        (22, '600.00'),
        (23, '400.00'),
        (24, '400.00'),
        (25, '400.00'),
        (26, '400.00'),
        (27, '200.00'),
        (28, '200.00'),
        (29, '200.00'),
        (30, '200.00'),
        (31, '200.00'),
        (32, '200.00'),
        (33, '200.00'),
        (34, '200.00'),
        (35, '200.00'),
        (36, '200.00'),
        (37, '200.00'),
        (38, '200.00'),
        (39, '200.00'),
        (40, '200.00'),
        (41, '100.00'),
        (42, '100.00'),
        (43, '100.00'),
        (44, '100.00'),
        (45, '100.00'),
        (46, '100.00'),
        (47, '100.00'),
        (48, '100.00'),
        (49, '100.00'),
        (50, '100.00')
      ON CONFLICT ("place") DO NOTHING`,
    );

    /*--- #16. Consolidated from 1760681402634-AddRaceTypeColumn.ts ---*/
    hasTable = await queryRunner.hasTable('bonus.races');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn('bonus.races', 'raceType');
      if (!hasColumn) {
        await queryRunner.query(`ALTER TABLE "bonus"."races" ADD COLUMN "raceType" VARCHAR(20)`);
      }
      await queryRunner.query(`
        UPDATE "bonus"."races" 
        SET "raceType" = CASE 
          WHEN "name" LIKE 'Weekly Race%' AND "sponsorId" IS NULL AND "referralCode" IS NULL THEN 'WEEKLY'
          WHEN "name" LIKE 'Monthly Race%' AND "sponsorId" IS NULL AND "referralCode" IS NULL THEN 'MONTHLY'
          WHEN "sponsorId" IS NOT NULL THEN 'SPONSORED'
          ELSE 'SPONSORED'
        END
      `);
      hasColumn = await queryRunner.hasColumn('bonus.races', 'raceType');
      if (hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "bonus"."races" ALTER COLUMN "raceType" SET DEFAULT 'SPONSORED'`,
        );
        await queryRunner.query(`ALTER TABLE "bonus"."races" ALTER COLUMN "raceType" SET NOT NULL`);
      }
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_races_raceType" ON "bonus"."races" ("raceType")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    let hasColumn;

    /*--- #16. Consolidated from 1760681402634-AddRaceTypeColumn.ts ---*/
    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."IDX_races_raceType"`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."races" DROP COLUMN IF EXISTS "raceType"`,
    );

    /*--- #15. Consolidated from 1760653278234-CreateMonthlyRacePrizes.ts ---*/
    //await queryRunner.query('DELETE FROM "bonus"."monthly_race_prizes"');
    await queryRunner.query('DROP TABLE IF EXISTS "bonus"."monthly_race_prizes"');

    /*--- #14. Consolidated from 1760097000000-AddUniqueSeedPairConstraint.ts ---*/
    // Drop the unique constraint index
    await queryRunner.query(`DROP INDEX IF EXISTS games."IDX_seed_pairs_userId_active_unique"`);

    /*--- #12. Consolidated from 1759953460777-AddDescriptionToBalanceHistory.ts ---*/
    await queryRunner.query(
      `ALTER TABLE balance.balance_history DROP COLUMN IF EXISTS description`,
    );

    /*--- #11. Consolidated from 1759380000000-CreateUniversalRaceSystem.ts ---*/
    // Drop indexes (including additional performance indexes)
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_race_wager`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_sponsor_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_weekly_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_wagered`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_place`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_user_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_ends_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_starts_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_sponsor_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_referral_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_status`);
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS bonus.race_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS bonus.races CASCADE`);
    // Restore old weekly_races table structure (compatible with feature/2fa-critical-endpoints-protection branch)
    // This uses the simplified structure: name, endTime, prizePool
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS games.weekly_races (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        "endTime" TIMESTAMP NOT NULL,
        "prizePool" DECIMAL(20, 2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Move weekly_race_prizes back to games schema if it exists in bonus
    const prizeTableExists = await queryRunner.hasTable('bonus.weekly_race_prizes');
    if (prizeTableExists) {
      await queryRunner.query(`ALTER TABLE bonus.weekly_race_prizes SET SCHEMA games`);
    }

    /*--- #10. Consolidated from 1759303838389-AddVaultIdPaymentsWallets.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."wallets" DROP COLUMN IF EXISTS "vaultId"`,
    );

    /*--- #9. Consolidated from 1758636734949-HouseEdge.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."provider_games" DROP COLUMN IF EXISTS "houseEdge"`,
    );

    /*--- #8. Consolidated from 1758585111412-StandardizeFiatFieldsPrecision.ts ---*/
    // Revert to original precision values (this may cause data loss if values exceed the smaller precision)
    // Revert blackjack_games (from 20,2 and 20,8 back to 18,2 and 18,8)
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(18,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(18,8)`,
      );
    }
    // Revert roulette_games (from 20,2 and 20,8 back to 12,2 and 12,8)
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."roulette_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
      );
    }
    // Revert mines_games (from 20,2 and 20,8 back to 12,2 and 12,8)
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."mines_games" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
      );
    }
    // Revert crash_bets (from 20,2 and 20,8 back to 12,2 and 12,8)
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."crash_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."crash_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(12,8)`,
      );
    }
    // Revert dice_bets (from 20,2 and 20,8 back to 18,2 and 18,8)
    hasColumn = await queryRunner.hasColumn('games.dice_bets', 'originalFiatAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."dice_bets" ALTER COLUMN "originalFiatAmount" TYPE DECIMAL(18,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.dice_bets', 'fiatToUsdRate');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "games"."dice_bets" ALTER COLUMN "fiatToUsdRate" TYPE DECIMAL(18,8)`,
      );
    }
    // plinko_bets table does not exist - skipping
    // limbo_bets table does not exist - skipping
    // keno_bets table does not exist - skipping

    /*--- #7. Consolidated from 1758585031958-AddFiatFieldsIndexes.ts ---*/
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

    /*--- #6. Consolidated from 1758260000010-RakebackMultiCurrency.ts ---*/
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

    /*--- #5. Consolidated from 1758260000000-AddMissingFiatFieldsToGameTables.ts ---*/
    // Remove the constraints first
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."dice_bets"
        DROP CONSTRAINT IF EXISTS "CHK_dice_bets_originalFiatCurrency"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."keno_games"
        DROP CONSTRAINT IF EXISTS "CHK_keno_games_originalFiatCurrency"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."limbo_games"
        DROP CONSTRAINT IF EXISTS "CHK_limbo_games_originalFiatCurrency"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."plinko_games"
        DROP CONSTRAINT IF EXISTS "CHK_plinko_games_originalFiatCurrency"
    `);

    // Remove the columns
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."dice_bets"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."keno_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."limbo_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."plinko_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    /*--- #4. Consolidated from 1758257631000-AddFiatFieldsToGameTables.ts ---*/
    // Remove the constraints first
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."blackjack_games" DROP CONSTRAINT IF EXISTS "CHK_blackjack_games_originalFiatCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."roulette_games" DROP CONSTRAINT IF EXISTS "CHK_roulette_games_originalFiatCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."mines_games" DROP CONSTRAINT IF EXISTS "CHK_mines_games_originalFiatCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."crash_bets" DROP CONSTRAINT IF EXISTS "CHK_crash_bets_originalFiatCurrency"`,
    );
    // Remove the columns
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."blackjack_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."roulette_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."mines_games"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."crash_bets"
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency",
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    /*--- #3. Consolidated from 1757662600000-AddFiatFieldsToUserBets.ts ---*/
    // Remove the constraint first
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."user_bets" DROP CONSTRAINT IF EXISTS "CHK_user_bets_originalFiatCurrency"`,
    );
    // Remove the columns
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "games"."user_bets" 
        DROP COLUMN IF EXISTS "originalFiatAmount",
        DROP COLUMN IF EXISTS "originalFiatCurrency", 
        DROP COLUMN IF EXISTS "fiatToUsdRate"
    `);

    /*--- #2. Consolidated from 1757500000000-AddSportsbookTables.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."sportsbook_bets" DROP CONSTRAINT IF EXISTS "FK_sportsbook_bets_userId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_sportsbook_bets_extTransactionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_sportsbook_bets_betslipId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_sportsbook_bets_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_sportsbook_bets_userId_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."sportsbook_bets"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."sportsbook_bets_bonustype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."sportsbook_bets_bettype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."sportsbook_bets_status_enum"`);

    /*--- #1. Consolidated from 1757497300000-CreateNotificationsTable.ts ---*/
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."notifications"`);
  }
}
