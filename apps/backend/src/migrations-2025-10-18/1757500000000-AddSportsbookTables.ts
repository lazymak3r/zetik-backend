import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSportsbookTables1757500000000 implements MigrationInterface {
  name = 'AddSportsbookTables1757500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for sportsbook bets
    await queryRunner.query(`
      CREATE TYPE "games"."sportsbook_bets_status_enum" AS ENUM(
        'pending', 'active', 'won', 'lost', 'canceled', 
        'refund', 'cashed out', 'half-won', 'half-lost', 'open'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "games"."sportsbook_bets_bettype_enum" AS ENUM(
        'single', 'accumulator', 'system', 'chain'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "games"."sportsbook_bets_bonustype_enum" AS ENUM(
        'freebet_refund', 'freebet_freemoney', 'freebet_no_risk', 
        'global_comboboost', 'comboboost'
      )
    `);

    // Create sportsbook_bets table
    await queryRunner.query(`
      CREATE TABLE "games"."sportsbook_bets" (
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
        CONSTRAINT "PK_sportsbook_bets_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for sportsbook_bets
    await queryRunner.query(`
      CREATE INDEX "IDX_sportsbook_bets_userId_status" 
      ON "games"."sportsbook_bets" ("userId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sportsbook_bets_userId_createdAt" 
      ON "games"."sportsbook_bets" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sportsbook_bets_betslipId" 
      ON "games"."sportsbook_bets" ("betslipId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sportsbook_bets_extTransactionId" 
      ON "games"."sportsbook_bets" ("extTransactionId")
    `);

    // Add foreign key constraint for sportsbook_bets
    await queryRunner.query(`
      ALTER TABLE "games"."sportsbook_bets" 
      ADD CONSTRAINT "FK_sportsbook_bets_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "games"."sportsbook_bets" 
      DROP CONSTRAINT "FK_sportsbook_bets_userId"
    `);

    await queryRunner.query(`DROP INDEX "games"."IDX_sportsbook_bets_extTransactionId"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_sportsbook_bets_betslipId"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_sportsbook_bets_userId_createdAt"`);
    await queryRunner.query(`DROP INDEX "games"."IDX_sportsbook_bets_userId_status"`);

    await queryRunner.query(`DROP TABLE "games"."sportsbook_bets"`);

    await queryRunner.query(`DROP TYPE "games"."sportsbook_bets_bonustype_enum"`);
    await queryRunner.query(`DROP TYPE "games"."sportsbook_bets_bettype_enum"`);
    await queryRunner.query(`DROP TYPE "games"."sportsbook_bets_status_enum"`);
  }
}
