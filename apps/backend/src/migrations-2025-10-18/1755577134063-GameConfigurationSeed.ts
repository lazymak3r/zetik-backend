import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameConfigurationSeed1755577134063 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "games"."game_configs_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_configs_status_enum" AS ENUM('enabled', 'disabled', 'maintenance')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."game_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameType" "games"."game_configs_gametype_enum" NOT NULL, "status" "games"."game_configs_status_enum" NOT NULL DEFAULT 'enabled', "name" character varying(100) NOT NULL, "description" text, "createdBy" character varying(255), "updatedBy" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f85e414a9dfc39cee3626f5c9e9" UNIQUE ("gameType"), CONSTRAINT "PK_7d7ef60da2cd850d7676c290dcf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34fc27e32fe9feb78f624d15b3" ON "games"."game_configs" ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f85e414a9dfc39cee3626f5c9e" ON "games"."game_configs" ("gameType") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_bet_limits_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."game_bet_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameType" "games"."game_bet_limits_gametype_enum" NOT NULL, "name" character varying(100) NOT NULL, "description" text, "minBetUsd" numeric(15,2) NOT NULL, "maxBetUsd" numeric(15,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdBy" character varying(255), "updatedBy" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_250ee715212f4a4ff159245054e" UNIQUE ("gameType"), CONSTRAINT "PK_0a5dd8fee8c3da5da6c29d4644d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_387269d3124dd1bb6870e810b8" ON "games"."game_bet_limits" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_250ee715212f4a4ff159245054" ON "games"."game_bet_limits" ("gameType") `,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_bet_type_limits_gametype_enum" AS ENUM('blackjack', 'crash', 'dice', 'keno', 'limbo', 'mines', 'plinko', 'roulette', 'slots')`,
    );
    await queryRunner.query(
      `CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum" AS ENUM('roulette_inside', 'roulette_outside', 'blackjack_main', 'blackjack_insurance', 'blackjack_split', 'blackjack_double', 'default')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games"."game_bet_type_limits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameType" "games"."game_bet_type_limits_gametype_enum" NOT NULL, "betTypeCategory" "games"."game_bet_type_limits_bettypecategory_enum" NOT NULL, "description" character varying(100) NOT NULL, "minBetUsd" numeric(10,2) NOT NULL, "maxBetUsd" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdBy" character varying(255), "updatedBy" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1148fdb3f5fda3cd5408faa361e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00c9bd76243d9a50898427bd4d" ON "games"."game_bet_type_limits" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d67dadd8a88523c74f97636227" ON "games"."game_bet_type_limits" ("gameType") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d23c7ce0bf1438acd0371f61e5" ON "games"."game_bet_type_limits" ("gameType", "betTypeCategory") `,
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
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "games"."IDX_d23c7ce0bf1438acd0371f61e5"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_d67dadd8a88523c74f97636227"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_00c9bd76243d9a50898427bd4d"`);
    await queryRunner.query(`DROP TABLE "games"."game_bet_type_limits"`);
    await queryRunner.query(`DROP TYPE "games"."game_bet_type_limits_bettypecategory_enum"`);
    await queryRunner.query(`DROP TYPE "games"."game_bet_type_limits_gametype_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_250ee715212f4a4ff159245054"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_387269d3124dd1bb6870e810b8"`);
    await queryRunner.query(`DROP TABLE "games"."game_bet_limits"`);
    await queryRunner.query(`DROP TYPE "games"."game_bet_limits_gametype_enum"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_f85e414a9dfc39cee3626f5c9e"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_34fc27e32fe9feb78f624d15b3"`);
    await queryRunner.query(`DROP TABLE "games"."game_configs"`);
    await queryRunner.query(`DROP TYPE "games"."game_configs_status_enum"`);
    await queryRunner.query(`DROP TYPE "games"."game_configs_gametype_enum"`);
  }
}
