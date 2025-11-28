import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSt8BonusTable1762300000000 implements MigrationInterface {
  name = 'CreateSt8BonusTable1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bonus"."st8_bonus_type_enum" AS ENUM(
          'free_bets',
          'free_money', 
          'bonus_game'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "bonus"."st8_bonus_status_enum" AS ENUM(
          'processing',
          'finished',
          'error',
          'canceled',
          'expired'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bonus"."st8_bonuses" (
        "bonus_id" varchar NOT NULL,
        "game_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "type" "bonus"."st8_bonus_type_enum" NOT NULL,
        "status" "bonus"."st8_bonus_status_enum" NOT NULL DEFAULT 'processing',
        "value" numeric(20,8) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "players" jsonb NOT NULL,
        "count" int NULL,
        "site" varchar(50) NULL,
        "start_time" timestamp NULL,
        "duration" int NULL,
        "created_by_admin_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_st8_bonuses_bonus_id" PRIMARY KEY ("bonus_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_st8_bonuses_game_codes" 
      ON "bonus"."st8_bonuses" USING GIN ("game_codes")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_st8_bonuses_type" ON "bonus"."st8_bonuses" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_st8_bonuses_status" ON "bonus"."st8_bonuses" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_st8_bonuses_created_by_admin_id" ON "bonus"."st8_bonuses" ("created_by_admin_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bonus"."st8_bonuses" 
        ADD CONSTRAINT "FK_st8_bonuses_created_by_admin" 
        FOREIGN KEY ("created_by_admin_id") REFERENCES "admin"."admin_users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_table THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bonus"."st8_bonuses" DROP CONSTRAINT IF EXISTS "FK_st8_bonuses_created_by_admin"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."IDX_st8_bonuses_created_by_admin_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."IDX_st8_bonuses_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."IDX_st8_bonuses_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "bonus"."IDX_st8_bonuses_game_codes"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "bonus"."st8_bonuses"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "bonus"."st8_bonus_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bonus"."st8_bonus_type_enum"`);
  }
}
