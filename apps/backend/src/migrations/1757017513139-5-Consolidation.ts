import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeeklyReloadMinToVipTiers1757017513139 implements MigrationInterface {
  name = '5-Consolidation-1757017513139';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let hasTable;
    let hasColumn;

    /*--- #1. Consolidated from 1756363254387-AddMaxPayoutToGameBetLimits.ts ---*/
    hasColumn = await queryRunner.hasColumn('games.game_bet_limits', 'maxPayoutUsd');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."game_bet_limits" ADD "maxPayoutUsd" numeric(15,2) NOT NULL DEFAULT '100000'`,
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
    hasColumn = await queryRunner.hasColumn('games.crash_games', 'crashPoint');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_games" ALTER COLUMN "crashPoint" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'cashOutAt');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "cashOutAt" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.crash_bets', 'autoCashOutAt');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "autoCashOutAt" TYPE numeric(12,2)`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.game_results', 'outcomeValue');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."game_results" ALTER COLUMN "outcomeValue" TYPE numeric(12,2)`,
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

    /*--- #2. Consolidated from 1756432479657-AddUserSettings.ts ---*/
    hasColumn = await queryRunner.hasColumn('users.users', 'emailMarketing');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "emailMarketing" boolean NOT NULL DEFAULT true`,
      );
    }
    hasColumn = await queryRunner.hasColumn('users.users', 'streamerMode');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "streamerMode" boolean NOT NULL DEFAULT false`,
      );
    }
    hasColumn = await queryRunner.hasColumn('users.users', 'excludeFromRain');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "excludeFromRain" boolean NOT NULL DEFAULT false`,
      );
    }
    hasColumn = await queryRunner.hasColumn('users.users', 'hideStatistics');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "hideStatistics" boolean NOT NULL DEFAULT false`,
      );
    }
    hasColumn = await queryRunner.hasColumn('users.users', 'hideRaceStatistics');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "hideRaceStatistics" boolean NOT NULL DEFAULT false`,
      );
    }

    /*--- #3. Consolidated from 1756432900000-Add2FAFields.ts ---*/
    hasColumn = await queryRunner.hasColumn('users.users', 'is2FAEnabled');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "is2FAEnabled" boolean NOT NULL DEFAULT false`,
      );
    }
    hasColumn = await queryRunner.hasColumn('users.users', 'twoFactorSecret');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "twoFactorSecret" character varying`,
      );
    }

    /*--- #4. Consolidated from 1756439252536-AddContentTypeToBlogArticles.ts ---*/
    // Create enum type for content_type
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "blog"."blog_articles_content_type_enum" AS ENUM('blog', 'promo');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    // Add content_type column with default value 'blog'
    hasColumn = await queryRunner.hasColumn('blog.blog_articles', 'content_type');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "blog"."blog_articles" ADD "content_type" "blog"."blog_articles_content_type_enum" NOT NULL DEFAULT 'blog'`,
      );
    }
    // Create index for better query performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_blog_articles_content_type" ON "blog"."blog_articles" ("content_type")`,
    );

    /*--- #5. Consolidated from 1756447898577-AddBioToUsers.ts ---*/
    hasColumn = await queryRunner.hasColumn('users.users', 'bio');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "users"."users" ADD "bio" character varying(500)`,
      );
    }

    /*--- #6. Consolidated from 1756500000000-AddUserVerificationTables.ts ---*/
    // Create verification status enum
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "users"."verification_status_enum" AS ENUM(
          'not_started', 
          'pending', 
          'approved', 
          'rejected', 
          'expired'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    // Create document type enum
    await queryRunner.query(`
    DO $$ 
    BEGIN
      CREATE TYPE "users"."document_type_enum" AS ENUM(
        'government_id',
        'drivers_license', 
        'passport',
        'national_id',
        'proof_of_address',
        'utility_bill',
        'bank_statement',
        'selfie_with_id'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    `);
    // Create verification level enum
    await queryRunner.query(`
    DO $$ 
    BEGIN
      CREATE TYPE "users"."verification_level_enum" AS ENUM(
        'level_1_email',
        'level_2_basic_info',
        'level_3_identity'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    `);
    // Create user_verifications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."user_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "level" "users"."verification_level_enum" NOT NULL,
        "status" "users"."verification_status_enum" NOT NULL DEFAULT 'not_started',
        "rejectionReason" character varying,
        "adminNotes" character varying,
        "reviewedBy" character varying,
        "reviewedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_verifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_verifications_user_id" 
          FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE
      )
    `);
    // Create verification_documents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."verification_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "verification_id" uuid NOT NULL,
        "documentType" "users"."document_type_enum" NOT NULL,
        "originalFileName" character varying NOT NULL,
        "storedFileName" character varying NOT NULL,
        "filePath" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "fileSize" bigint NOT NULL,
        "status" "users"."verification_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verification_documents_verification_id" 
          FOREIGN KEY ("verification_id") REFERENCES "users"."user_verifications"("id") ON DELETE CASCADE
      )
    `);
    // Create verification_basic_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."verification_basic_info" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "dateOfBirth" TIMESTAMP NOT NULL,
        "phoneNumber" character varying NOT NULL,
        "address" character varying NOT NULL,
        "city" character varying NOT NULL,
        "state" character varying NOT NULL,
        "postalCode" character varying NOT NULL,
        "country" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_basic_info" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verification_basic_info_user_id" 
          FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE
      )
    `);
    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_verifications_user_id" ON "users"."user_verifications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_verification_documents_verification_id" ON "users"."verification_documents" ("verification_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_verification_basic_info_user_id" ON "users"."verification_basic_info" ("user_id")`,
    );
    // Add unique constraints to ensure one verification per user per level
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_verifications_user_level_unique" ON "users"."user_verifications" ("user_id", "level")`,
    );
    // Add unique constraint for one basic info per user
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_verification_basic_info_user_unique" ON "users"."verification_basic_info" ("user_id")`,
    );

    /*--- #7. Consolidated from 1756800000000-AddUserIgnoredUserTable.ts ---*/
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."user_ignored_users" (
          "id" SERIAL NOT NULL,
          "ignorerId" uuid NOT NULL,
          "ignoredUserId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_user_ignored_users" PRIMARY KEY ("id"),
          CONSTRAINT "FK_user_ignored_users_ignorer" FOREIGN KEY ("ignorerId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_user_ignored_users_ignored" FOREIGN KEY ("ignoredUserId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
    `);
    // Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_ignored_users_ignorerId" ON "users"."user_ignored_users" ("ignorerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_ignored_users_ignoredUserId" ON "users"."user_ignored_users" ("ignoredUserId")`,
    );
    // Create unique constraint to prevent duplicate ignores
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_ignored_users_unique" ON "users"."user_ignored_users" ("ignorerId", "ignoredUserId")`,
    );

    /*--- #8. Consolidated from 1756928458000-BonusUpdates.ts ---*/
    hasTable = await queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
      // Add new columns to bonuses_vip_tiers
      hasColumn = await queryRunner.hasColumn(
        'bonus.bonuses_vip_tiers',
        'weeklyReloadProfitablePercentage',
      );
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadProfitablePercentage" numeric(5,2) NULL`,
        );
      }
      hasColumn = await queryRunner.hasColumn(
        'bonus.bonuses_vip_tiers',
        'weeklyReloadLosingPercentage',
      );
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadLosingPercentage" numeric(5,2) NULL`,
        );
      }
      // Reseed bonuses_vip_tiers with updated percentages
      await queryRunner.query(
        `TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`,
      );
      await queryRunner.query(`
        INSERT INTO bonus.bonuses_vip_tiers (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
          "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount",
          "weeklyReloadProfitablePercentage", "weeklyReloadLosingPercentage"
        )
        VALUES 
          (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL, NULL, NULL),
          (1, 'Bronze I', '250000.00', '5.00', '0.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00', '5.00', '10.00'),
          (2, 'Bronze II', '500000.00', '5.00', '0.00', '5000.00', '3.00', false, 'user-level/bronze-2', NULL, '5.00', '10.00'),
          (3, 'Bronze III', '1000000.00', '5.00', '0.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL, '5.00', '10.00'),
          (4, 'Bronze IV', '1500000.00', '5.00', '0.00', '15000.00', '3.50', false, 'user-level/bronze-4', NULL, '5.00', '10.00'),
          (5, 'Silver I', '2500000.00', '5.00', '0.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00', '5.00', '10.00'),
          (6, 'Silver II', '5000000.00', '5.00', '0.00', '40000.00', '4.00', false, 'user-level/silver-2', NULL, '5.00', '10.00'),
          (7, 'Silver III', '10000000.00', '5.00', '0.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL, '5.00', '10.00'),
          (8, 'Silver IV', '15000000.00', '5.00', '0.00', '80000.00', '4.50', false, 'user-level/silver-4', NULL, '5.00', '10.00'),
          (9, 'Gold I', '25000000.00', '5.00', '7.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00', '5.00', '10.00'),
          (10, 'Gold II', '50000000.00', '5.00', '7.00', '150000.00', '5.00', false, 'user-level/gold-2', NULL, '5.00', '10.00'),
          (11, 'Gold III', '75000000.00', '5.00', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL, '5.00', '10.00'),
          (12, 'Gold IV', '100000000.00', '5.00', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL, '5.00', '10.00'),
          (13, 'Platinum I', '250000000.00', '5.00', '8.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00', '5.00', '10.00'),
          (14, 'Platinum II', '500000000.00', '5.00', '8.00', '600000.00', '6.00', true, 'user-level/platinum-2', NULL, '5.00', '10.00'),
          (15, 'Platinum III', '750000000.00', '5.00', '8.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL, '5.00', '10.00'),
          (16, 'Platinum IV', '1000000000.00', '5.00', '8.00', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL, '5.00', '10.00'),
          (17, 'Sapphire I', '1500000000.00', '5.00', '9.00', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00', '5.00', '10.00'),
          (18, 'Sapphire II', '2000000000.00', '5.00', '9.00', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL, '5.00', '10.00'),
          (19, 'Sapphire III', '2500000000.00', '5.00', '9.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL, '5.00', '10.00'),
          (20, 'Ruby I', '3000000000.00', '5.00', '10.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00', '5.00', '10.00'),
          (21, 'Ruby II', '4000000000.00', '5.00', '10.00', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL, '5.00', '10.00'),
          (22, 'Ruby III', '5000000000.00', '5.00', '10.00', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL, '5.00', '10.00'),
          (23, 'Diamond I', '7500000000.00', '5.00', '11.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00', '5.00', '10.00'),
          (24, 'Diamond II', '10000000000.00', '5.00', '11.00', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL, '5.00', '10.00'),
          (25, 'Diamond III', '15000000000.00', '5.00', '11.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL, '5.00', '10.00'),
          (26, 'Zetik', '25000000000.00', '5.00', '12.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00', '5.00', '10.00')
      `);
    }
    // Changes to bonuses_transactions
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" DROP COLUMN IF EXISTS "expiresAt"`,
    );
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'activateAt');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ADD "activateAt" TIMESTAMP NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('balance.balance_history', 'houseEdge');
    if (!hasColumn) {
      // Add houseEdge to balance_history and backfill
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "balance"."balance_history" ADD "houseEdge" numeric(5,2) NULL`,
      );
      await queryRunner.query(
        `UPDATE "balance"."balance_history" SET "houseEdge" = 1.00 WHERE "operation" = 'BET' AND "houseEdge" IS NULL`,
      );
    }

    /*--- #9. Consolidated from 1757017513137-CreateRakebackTable.ts ---*/
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "balance"."rakeback" (
        "userId" uuid NOT NULL,
        "accumulatedHouseSideCents" numeric(12,2) NOT NULL DEFAULT '0.00',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rakeback_userId" PRIMARY KEY ("userId")
      );
      COMMENT ON TABLE "balance"."rakeback" IS 'Accumulated house side (bet * HE) for rakeback calculation per user';
      COMMENT ON COLUMN "balance"."rakeback"."userId" IS 'User ID - primary key';
      --COMMENT ON COLUMN "balance"."rakeback"."accumulatedHouseSideCents" IS 'Accumulated house side amount (bet amount * house edge) in cents'
    `);

    /*--- #10. Consolidated from 1757017513138-CreateUserFavoritesTables.tx ---*/
    await queryRunner.query(`
    DO $$ 
    BEGIN
      CREATE TYPE "games"."user_game_favorites_game_enum" AS ENUM(
        'CRASH',
        'DICE',
        'MINES',
        'BLACKJACK',
        'ROULETTE',
        'PLINKO',
        'LIMBO',
        'KENO'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."user_game_favorites" (
        "userId" uuid NOT NULL,
        "game" "games"."user_game_favorites_game_enum" NOT NULL,
        CONSTRAINT "PK_user_game_favorites" PRIMARY KEY ("userId", "game")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_game_favorites_userId" ON "games"."user_game_favorites" ("userId")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."user_provider_game_favorites" (
        "userId" uuid NOT NULL,
        "code" varchar NOT NULL,
        CONSTRAINT "PK_user_provider_game_favorites" PRIMARY KEY ("userId", "code"),
        CONSTRAINT "FK_user_provider_game_favorites_game"
          FOREIGN KEY ("code") REFERENCES "games"."provider_games"("code") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_provider_game_favorites_userId" ON "games"."user_provider_game_favorites" ("userId")`,
    );

    /*--- #11. Consolidated from 1757017513139-AddWeeklyReloadMinToVipTiers.ts ---*/
    hasTable = await queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
      hasColumn = await queryRunner.hasColumn(
        'bonus.bonuses_vip_tiers',
        'weeklyReloadDailyMinCents',
      );
      if (!hasColumn) {
        // Add configurable daily minimum (in cents) for weekly reload
        await queryRunner.query(
          `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadDailyMinCents" numeric(10,2) NULL`,
        );
      }
      // Reseed: replace BonusUpdates seed with extended seed that includes weeklyReloadDailyMinCents
      await queryRunner.query(
        `TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`,
      );
      await queryRunner.query(`
        INSERT INTO "bonus"."bonuses_vip_tiers" (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
          "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount",
          "weeklyReloadProfitablePercentage", "weeklyReloadLosingPercentage", "weeklyReloadDailyMinCents"
        )
        VALUES 
          (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL, NULL, NULL, NULL),
          (1, 'Bronze I', '250000.00', '5.00', '0.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00', '5.00', '10.00', NULL),
          (2, 'Bronze II', '500000.00', '5.00', '0.00', '5000.00', '3.00', false, 'user-level/bronze-2', NULL, '5.00', '10.00', NULL),
          (3, 'Bronze III', '1000000.00', '5.00', '0.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL, '5.00', '10.00', NULL),
          (4, 'Bronze IV', '1500000.00', '5.00', '0.00', '15000.00', '3.50', false, 'user-level/bronze-4', NULL, '5.00', '10.00', NULL),
          (5, 'Silver I', '2500000.00', '5.00', '0.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00', '5.00', '10.00', NULL),
          (6, 'Silver II', '5000000.00', '5.00', '0.00', '40000.00', '4.00', false, 'user-level/silver-2', NULL, '5.00', '10.00', NULL),
          (7, 'Silver III', '10000000.00', '5.00', '0.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL, '5.00', '10.00', NULL),
          (8, 'Silver IV', '15000000.00', '5.00', '0.00', '80000.00', '4.50', false, 'user-level/silver-4', NULL, '5.00', '10.00', NULL),
          (9, 'Gold I', '25000000.00', '5.00', '7.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00', '5.00', '10.00', NULL),
          (10, 'Gold II', '50000000.00', '5.00', '7.00', '150000.00', '5.00', false, 'user-level/gold-2', NULL, '5.00', '10.00', NULL),
          (11, 'Gold III', '75000000.00', '5.00', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL, '5.00', '10.00', NULL),
          (12, 'Gold IV', '100000000.00', '5.00', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL, '5.00', '10.00', NULL),
          (13, 'Platinum I', '250000000.00', '5.00', '8.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00', '5.00', '10.00', '500.00'),
          (14, 'Platinum II', '500000000.00', '5.00', '8.00', '600000.00', '6.00', true, 'user-level/platinum-2', NULL, '5.00', '10.00', '750.00'),
          (15, 'Platinum III', '750000000.00', '5.00', '8.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL, '5.00', '10.00', '1000.00'),
          (16, 'Platinum IV', '1000000000.00', '5.00', '8.00', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL, '5.00', '10.00', '1250.00'),
          (17, 'Sapphire I', '1500000000.00', '5.00', '9.00', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00', '5.00', '10.00', '1500.00'),
          (18, 'Sapphire II', '2000000000.00', '5.00', '9.00', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL, '5.00', '10.00', '1750.00'),
          (19, 'Sapphire III', '2500000000.00', '5.00', '9.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL, '5.00', '10.00', '2000.00'),
          (20, 'Ruby I', '3000000000.00', '5.00', '10.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00', '5.00', '10.00', '2250.00'),
          (21, 'Ruby II', '4000000000.00', '5.00', '10.00', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL, '5.00', '10.00', '2500.00'),
          (22, 'Ruby III', '5000000000.00', '5.00', '10.00', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL, '5.00', '10.00', '2750.00'),
          (23, 'Diamond I', '7500000000.00', '5.00', '11.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00', '5.00', '10.00', '3000.00'),
          (24, 'Diamond II', '10000000000.00', '5.00', '11.00', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL, '5.00', '10.00', '3250.00'),
          (25, 'Diamond III', '15000000000.00', '5.00', '11.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL, '5.00', '10.00', '3500.00'),
          (26, 'Zetik', '25000000000.00', '5.00', '12.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00', '5.00', '10.00', '3750.00')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    let hasTable;
    let hasColumn;

    /*--- #11. Consolidated from 1757017513139-AddWeeklyReloadMinToVipTiers.ts ---*/
    // Revert to BonusUpdates seed and drop the column
    hasTable = await queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
      await queryRunner.query(
        `TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`,
      );
      await queryRunner.query(`
        INSERT INTO "bonus"."bonuses_vip_tiers" (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
          "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount",
          "weeklyReloadProfitablePercentage", "weeklyReloadLosingPercentage"
        )
        VALUES 
          (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL, NULL, NULL),
          (1, 'Bronze I', '250000.00', '5.00', '0.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00', '5.00', '10.00'),
          (2, 'Bronze II', '500000.00', '5.00', '0.00', '5000.00', '3.00', false, 'user-level/bronze-2', NULL, '5.00', '10.00'),
          (3, 'Bronze III', '1000000.00', '5.00', '0.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL, '5.00', '10.00'),
          (4, 'Bronze IV', '1500000.00', '5.00', '0.00', '15000.00', '3.50', false, 'user-level/bronze-4', NULL, '5.00', '10.00'),
          (5, 'Silver I', '2500000.00', '5.00', '0.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00', '5.00', '10.00'),
          (6, 'Silver II', '5000000.00', '5.00', '0.00', '40000.00', '4.00', false, 'user-level/silver-2', NULL, '5.00', '10.00'),
          (7, 'Silver III', '10000000.00', '5.00', '0.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL, '5.00', '10.00'),
          (8, 'Silver IV', '15000000.00', '5.00', '0.00', '80000.00', '4.50', false, 'user-level/silver-4', NULL, '5.00', '10.00'),
          (9, 'Gold I', '25000000.00', '5.00', '7.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00', '5.00', '10.00'),
          (10, 'Gold II', '50000000.00', '5.00', '7.00', '150000.00', '5.00', false, 'user-level/gold-2', NULL, '5.00', '10.00'),
          (11, 'Gold III', '75000000.00', '5.00', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL, '5.00', '10.00'),
          (12, 'Gold IV', '100000000.00', '5.00', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL, '5.00', '10.00'),
          (13, 'Platinum I', '250000000.00', '5.00', '8.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00', '5.00', '10.00'),
          (14, 'Platinum II', '500000000.00', '5.00', '8.00', '600000.00', '6.00', true, 'user-level/platinum-2', NULL, '5.00', '10.00'),
          (15, 'Platinum III', '750000000.00', '5.00', '8.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL, '5.00', '10.00'),
          (16, 'Platinum IV', '1000000000.00', '5.00', '8.00', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL, '5.00', '10.00'),
          (17, 'Sapphire I', '1500000000.00', '5.00', '9.00', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00', '5.00', '10.00'),
          (18, 'Sapphire II', '2000000000.00', '5.00', '9.00', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL, '5.00', '10.00'),
          (19, 'Sapphire III', '2500000000.00', '5.00', '9.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL, '5.00', '10.00'),
          (20, 'Ruby I', '3000000000.00', '5.00', '10.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00', '5.00', '10.00'),
          (21, 'Ruby II', '4000000000.00', '5.00', '10.00', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL, '5.00', '10.00'),
          (22, 'Ruby III', '5000000000.00', '5.00', '10.00', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL, '5.00', '10.00'),
          (23, 'Diamond I', '7500000000.00', '5.00', '11.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00', '5.00', '10.00'),
          (24, 'Diamond II', '10000000000.00', '5.00', '11.00', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL, '5.00', '10.00'),
          (25, 'Diamond III', '15000000000.00', '5.00', '11.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL, '5.00', '10.00'),
          (26, 'Zetik', '25000000000.00', '5.00', '12.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00', '5.00', '10.00')
      `);
      await queryRunner.query(
        `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN IF EXISTS "weeklyReloadDailyMinCents"`,
      );
    }

    /*--- #10. Consolidated from 1757017513138-CreateUserFavoritesTables.tx ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."user_provider_game_favorites" DROP CONSTRAINT IF EXISTS "FK_user_provider_game_favorites_game"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "games"."IDX_user_provider_game_favorites_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."user_provider_game_favorites"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_user_game_favorites_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."user_game_favorites"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."user_game_favorites_game_enum"`);

    /*--- #9. Consolidated from 1757017513137-CreateRakebackTable.ts ---*/
    await queryRunner.query(`DROP TABLE IF EXISTS "balance"."rakeback"`);

    /*--- #8. Consolidated from 1756928458000-BonusUpdates.ts ---*/
    // Revert balance_history
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "balance"."balance_history" DROP COLUMN IF EXISTS "houseEdge"`,
    );
    // Revert bonuses_transactions
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" DROP COLUMN IF EXISTS "activateAt"`,
    );
    hasColumn = await queryRunner.hasColumn('bonus.bonuses_transactions', 'expiresAt');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonuses_transactions" ADD "expiresAt" TIMESTAMP NULL`,
      );
    }
    // Revert bonuses_vip_tiers
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_vip_tiers" DROP COLUMN IF EXISTS "weeklyReloadLosingPercentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "bonus"."bonuses_vip_tiers" DROP COLUMN IF EXISTS "weeklyReloadProfitablePercentage"`,
    );
    // Reseed to previous state
    hasTable = await queryRunner.hasTable('bonus.bonuses_vip_tiers');
    if (hasTable) {
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
          (17, 'Sapphire I', '1500000000.00', '4.50', '7.50', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00'),
          (18, 'Sapphire II', '2000000000.00', '4.50', '7.50', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL),
          (19, 'Sapphire III', '2500000000.00', '5.00', '8.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL),
          (20, 'Ruby I', '3000000000.00', '5.00', '8.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00'),
          (21, 'Ruby II', '4000000000.00', '5.00', '8.50', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL),
          (22, 'Ruby III', '5000000000.00', '5.00', '8.50', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL),
          (23, 'Diamond I', '7500000000.00', '5.00', '9.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00'),
          (24, 'Diamond II', '10000000000.00', '5.00', '9.50', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL),
          (25, 'Diamond III', '15000000000.00', '5.50', '10.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL),
          (26, 'Zetik', '25000000000.00', '6.00', '10.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00')
      `);
    }

    /*--- #7. Consolidated from 1756800000000-AddUserIgnoredUserTable.ts ---*/
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_user_ignored_users_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_user_ignored_users_ignoredUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_user_ignored_users_ignorerId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."user_ignored_users"`);

    /*--- #6. Consolidated from 1756500000000-AddUserVerificationTables.ts ---*/
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."verification_basic_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."verification_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."user_verifications"`);
    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "users"."verification_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users"."document_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users"."verification_status_enum"`);

    /*--- #5. Consolidated from 1756447898577-AddBioToUsers.ts ---*/
    await queryRunner.query(`ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "bio"`);

    /*--- #4. Consolidated from 1756439252536-AddContentTypeToBlogArticles.ts ---*/
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "blog"."IDX_blog_articles_content_type"`);
    // Drop column
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "blog"."blog_articles" DROP COLUMN IF EXISTS "content_type"`,
    );
    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "blog"."blog_articles_content_type_enum"`);

    /*--- #3. Consolidated from 1756432900000-Add2FAFields.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "twoFactorSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "is2FAEnabled"`,
    );

    /*--- #2. Consolidated from 1756432479657-AddUserSettings.ts ---*/
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "hideRaceStatistics"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "hideStatistics"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "excludeFromRain"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "streamerMode"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users"."users" DROP COLUMN IF EXISTS "emailMarketing"`,
    );

    /*--- #1. Consolidated from 1756363254387-AddMaxPayoutToGameBetLimits.ts ---*/
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT 0.0000`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT 1.00000000`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 0.00`,
      );
    }
    /**  Down-grade numeric type will cause "numeric field overflow error" if metadata exists - DON'T REVERT down-grade
     *   hasColumn = await queryRunner.hasColumn('games.game_results', 'outcomeValue');
     *   if (hasColumn) {
     *     await queryRunner.query(`ALTER TABLE IF EXISTS "games"."game_results" ALTER COLUMN "outcomeValue" TYPE numeric(10,8)`);
     *   }
     *   hasColumn = await queryRunner.hasColumn('games.crash_bets', 'autoCashOutAt');
     *   if (hasColumn) {
     *     await queryRunner.query(`ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "autoCashOutAt" TYPE numeric(10,8)`);
     *   }
     *   hasColumn = await queryRunner.hasColumn('games.crash_bets', 'cashOutAt');
     *   if (hasColumn) {
     *     await queryRunner.query(`ALTER TABLE IF EXISTS "games"."crash_bets" ALTER COLUMN "cashOutAt" TYPE numeric(10,8)`);
     *   }
     *   hasColumn = await queryRunner.hasColumn('games.crash_games', 'crashPoint');
     *   if (hasColumn) {
     *     await queryRunner.query(`ALTER TABLE IF EXISTS "games"."crash_games" ALTER COLUMN "crashPoint" TYPE numeric(10,8)`);
     *   }
     */
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT 2.00`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 2.00`,
      );
    }
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "games"."game_bet_limits" DROP COLUMN IF EXISTS "maxPayoutUsd"`,
    );
  }
}
