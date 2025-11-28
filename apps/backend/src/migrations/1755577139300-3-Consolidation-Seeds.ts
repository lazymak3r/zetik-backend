import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidationSeeds1755577139300 implements MigrationInterface {
  name = '3-Consolidation-Seeds-1755577139300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /*--- #1. Consolidated from 1755118038984-Seed.ts ---*/
    // seed assets
    await queryRunner.query(`
      INSERT INTO payments.assets (symbol, status, "createdAt", "updatedAt")
      VALUES
        ('BTC', 'ACTIVE', NOW(), NOW()),
        ('LTC', 'ACTIVE', NOW(), NOW()),
        ('DOGE', 'ACTIVE', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    const hasColumn = await queryRunner.hasColumn(
      'bonus.bonuses_vip_tiers',
      'dailyBonusPercentage',
    );
    // this column had been removed in the new version - protect failure on existing new version table
    if (hasColumn) {
      // seed vip tiers
      await queryRunner.query(`
        INSERT INTO "bonus"."bonuses_vip_tiers" (
          level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage", 
          "dailyBonusPercentage", "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl"
        )
        VALUES 
          (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, NULL, false, ''),
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
        ON CONFLICT DO NOTHING
      `);
    }
    // seed categories
    await queryRunner.query(`
      INSERT INTO games.provider_categories (name, type, "createdAt", "updatedAt")
      VALUES 
        ('Video Slots', 'rng', NOW(), NOW()),
        ('Crash Games', 'rng', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    // seed developers
    await queryRunner.query(`
      INSERT INTO games.provider_developers (name, code, "restrictedTerritories", "prohibitedTerritories", "createdAt", "updatedAt")
      VALUES 
        ('Red Tiger', 'rtg', '{}', '{"GB","US"}', NOW(), NOW()),
        ('Pragmatic Play', 'pgp', '{}', '{"GB","US"}', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    // seed games
    await queryRunner.query(`
      INSERT INTO games.provider_games (
        code, name, enabled, "developerName", "categoryName", "bonusTypes", themes, features, 
        rtp, volatility, "maxPayoutCoeff", "hitRatio", "funMode", "releaseDate", "deprecationDate",
        "restrictedTerritories", "prohibitedTerritories", "createdAt", "updatedAt"
      )
      VALUES 
        ('pgp_piggy_bankers', 'Piggy Bankers', false, 'Pragmatic Play', 'Video Slots', '{}', '{}', 
         '{"Respin","In-game Freespins","Bonus Buy"}', '96.05', '5.0', '10000', '26.9', true, 
         NULL, NULL, '{}', '{}', NOW(), NOW()),
        ('pgp_pub_kings', 'Pub Kings', false, 'Pragmatic Play', 'Video Slots', '{}', '{}', 
         '{"Bonus Buy","In-game Freespins"}', '96.08', '5.0', '5000', '22.9', true, 
         NULL, NULL, '{}', '{}', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    // seed language chats
    await queryRunner.query(`
      INSERT INTO chat.chats (name, language, "createdAt", "updatedAt")
      VALUES 
        ('English', 'en', NOW(), NOW()),
        ('Spanish', 'es', NOW(), NOW()),
        ('Portuguese', 'pt', NOW(), NOW()),
        ('German', 'de', NOW(), NOW()),
        ('French', 'fr', NOW(), NOW()),
        ('Russian', 'ru', NOW(), NOW()),
        ('Japanese', 'ja', NOW(), NOW()),
        ('Chinese', 'zh', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO games.house_edge (game, edge)
      VALUES
        ('plinko', 1.00),
        ('dice', 1.00),
        ('crash', 1.00),
        ('limbo', 1.00),
        ('mines', 1.00)
      ON CONFLICT DO NOTHING
    `);

    /*--- #2. Consolidated from 1755577134063-GameConfigurationSeed.ts ---*/
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."game_configs_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."game_configs_status_enum" AS ENUM('enabled', 'disabled', 'maintenance');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."game_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameType" "games"."game_configs_gametype_enum" NOT NULL,
        "status" "games"."game_configs_status_enum" NOT NULL DEFAULT 'enabled',
        "name" character varying(100) NOT NULL,
        "description" text,
        "createdBy" character varying(255),
        "updatedBy" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_f85e414a9dfc39cee3626f5c9e9" UNIQUE ("gameType"),
        CONSTRAINT "PK_7d7ef60da2cd850d7676c290dcf" PRIMARY KEY ("id"));
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_34fc27e32fe9feb78f624d15b3" ON "games"."game_configs" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f85e414a9dfc39cee3626f5c9e" ON "games"."game_configs" ("gameType")`,
    );
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."game_bet_limits_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."game_bet_limits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameType" "games"."game_bet_limits_gametype_enum" NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "minBetUsd" numeric(15,2) NOT NULL,
        "maxBetUsd" numeric(15,2) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" character varying(255),
        "updatedBy" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_250ee715212f4a4ff159245054e" UNIQUE ("gameType"),
        CONSTRAINT "PK_0a5dd8fee8c3da5da6c29d4644d" PRIMARY KEY ("id"));
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_387269d3124dd1bb6870e810b8" ON "games"."game_bet_limits" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_250ee715212f4a4ff159245054" ON "games"."game_bet_limits" ("gameType")`,
    );
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."game_bet_type_limits_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum" AS ENUM('roulette_inside', 'roulette_outside', 'blackjack_main', 'blackjack_insurance', 'blackjack_split', 'blackjack_double', 'default');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."game_bet_type_limits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "gameType" "games"."game_bet_type_limits_gametype_enum" NOT NULL,
        "betTypeCategory" "games"."game_bet_type_limits_bettypecategory_enum" NOT NULL,
        "description" character varying(100) NOT NULL,
        "minBetUsd" numeric(10,2) NOT NULL,
        "maxBetUsd" numeric(10,2) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" character varying(255),
        "updatedBy" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_1148fdb3f5fda3cd5408faa361e" PRIMARY KEY ("id"));
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_00c9bd76243d9a50898427bd4d" ON "games"."game_bet_type_limits" ("isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_d67dadd8a88523c74f97636227" ON "games"."game_bet_type_limits" ("gameType")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d23c7ce0bf1438acd0371f61e5" ON "games"."game_bet_type_limits" ("gameType", "betTypeCategory")`,
    );
    await queryRunner.query(`
      INSERT INTO games.game_configs ("gameType", "name", "description", "status", "createdBy", "createdAt", "updatedAt") 
      VALUES 
        ('crash', 'Crash', 'Multiplayer crash game with increasing multiplier', 'enabled', 'system', NOW(), NOW()),
        ('dice', 'Dice', 'Classic dice roll game with over/under betting', 'enabled', 'system', NOW(), NOW()),
        ('mines', 'Mines', 'Minesweeper-style game with hidden mines', 'enabled', 'system', NOW(), NOW()),
        ('plinko', 'Plinko', 'Ball-drop game with multiple rows and multipliers', 'enabled', 'system', NOW(), NOW()),
        ('limbo', 'Limbo', 'Simple over/under game with target multiplier', 'enabled', 'system', NOW(), NOW()),
        ('keno', 'Keno', 'Number selection lottery-style game', 'enabled', 'system', NOW(), NOW()),
        ('roulette', 'Roulette', 'Classic European roulette game', 'enabled', 'system', NOW(), NOW()),
        ('blackjack', 'Blackjack', 'Classic 21 card game with side bets', 'enabled', 'system', NOW(), NOW()),
        ('slots', 'Slots', 'Third-party slot machine games', 'enabled', 'system', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO games.game_bet_limits ("gameType", "name", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt") 
      VALUES 
        ('crash', 'Crash Bet Limits', 'USD-based bet limits for Crash game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('dice', 'Dice Bet Limits', 'USD-based bet limits for Dice game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('mines', 'Mines Bet Limits', 'USD-based bet limits for Mines game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('plinko', 'Plinko Bet Limits', 'USD-based bet limits for Plinko game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('limbo', 'Limbo Bet Limits', 'USD-based bet limits for Limbo game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('keno', 'Keno Bet Limits', 'USD-based bet limits for Keno game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('roulette', 'Roulette Bet Limits', 'USD-based bet limits for Roulette game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('blackjack', 'Blackjack Bet Limits', 'USD-based bet limits for Blackjack game', 0.10, 1000.00, true, 'system', NOW(), NOW()),
        ('slots', 'Slots Bet Limits', 'USD-based bet limits for Slots game', 0.10, 1000.00, true, 'system', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);

    /*--- #3. Consolidated from 1755577139300-GameBetTypeLimitsSeed.ts ---*/
    await queryRunner.query(`
      INSERT INTO games.game_bet_type_limits ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
      VALUES 
        -- Roulette bet type limits
        ('roulette', 'roulette_inside', 'Inside bets: straight, split, street, corner, line', 0.1, 500, true, 'system', NOW(), NOW()),
        ('roulette', 'roulette_outside', 'Outside bets: red/black, odd/even, dozens, columns', 0.5, 2000, true, 'system', NOW(), NOW()),
        -- Blackjack bet type limits  
        ('blackjack', 'blackjack_main', 'Main blackjack bet', 0.1, 1000, true, 'system', NOW(), NOW())
        --('blackjack', 'blackjack_insurance', 'Insurance side bet (max 50% of main bet)', 0.05, 500, true, 'system', NOW(), NOW()),
        --('blackjack', 'blackjack_split', 'Split additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW()),
        --('blackjack', 'blackjack_double', 'Double down additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Consolidated from 1755577139300-GameBetTypeLimitsSeed.ts
    await queryRunner.query(`DELETE FROM games.game_bet_type_limits WHERE "createdBy" = 'system'`);

    // Consolidated from 1755577134063-GameConfigurationSeed.ts
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_d23c7ce0bf1438acd0371f61e5"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_d67dadd8a88523c74f97636227"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_00c9bd76243d9a50898427bd4d"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."game_bet_type_limits"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "games"."game_bet_type_limits_bettypecategory_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."game_bet_type_limits_gametype_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_250ee715212f4a4ff159245054"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_387269d3124dd1bb6870e810b8"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."game_bet_limits"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."game_bet_limits_gametype_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_f85e414a9dfc39cee3626f5c9e"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "games"."IDX_34fc27e32fe9feb78f624d15b3"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"."game_configs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."game_configs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "games"."game_configs_gametype_enum"`);
  }
}
