import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromocodesSystem1760681402645 implements MigrationInterface {
  name = '7-CreatePromocodesSystem1760681402645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "promocodes"');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "promocodes"."promocode_audit_action_enum" AS ENUM(
          'CREATED',
          'PAUSED', 
          'RESUMED',
          'CANCELLED',
          'UPDATED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "promocodes"."promocode_status_enum" AS ENUM(
          'ACTIVE',
          'PAUSED',
          'CANCELLED',
          'EXPIRED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "promocodes"."asset_type_enum" AS ENUM('BTC', 'LTC', 'DOGE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promocodes"."promocodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(50) NOT NULL,
        "created_by_admin_id" uuid NOT NULL,
        "value_per_claim" numeric(20,8) NOT NULL,
        "total_claims" integer NOT NULL,
        "claimed_count" integer NOT NULL DEFAULT 0,
        "asset" "promocodes"."asset_type_enum" NOT NULL,
        "starts_at" TIMESTAMP NOT NULL,
        "ends_at" TIMESTAMP NOT NULL,
        "status" "promocodes"."promocode_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "note" text,
        "eligibility_rules" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promocodes_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promocodes"."promocode_audit" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "promocode_id" uuid NOT NULL,
        "admin_id" uuid NOT NULL,
        "action" "promocodes"."promocode_audit_action_enum" NOT NULL,
        "previous_values" jsonb,
        "new_values" jsonb,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promocode_audit_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promocodes"."promocode_claims" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "promocode_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "amount" decimal(20,8) NOT NULL,
        "asset" "promocodes"."asset_type_enum" NOT NULL,
        "ip_address" varchar(45),
        "device_fingerprint" varchar(64),
        "user_agent" text,
        "balance_operation_id" uuid NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promocode_claims_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promocodes_code" ON "promocodes"."promocodes" ("code")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promocodes_status" ON "promocodes"."promocodes" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promocode_audit_promocode_id" ON "promocodes"."promocode_audit" ("promocode_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promocode_claims_promocode_id" ON "promocodes"."promocode_claims" ("promocode_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promocode_claims_user_id" ON "promocodes"."promocode_claims" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_promocode_claims_ip_address" ON "promocodes"."promocode_claims" ("ip_address")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocode_claims" 
        ADD CONSTRAINT "FK_promocode_claims_promocode" 
        FOREIGN KEY ("promocode_id") REFERENCES "promocodes"."promocodes"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocode_claims" 
        ADD CONSTRAINT "FK_promocode_claims_user" 
        FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocode_claims" 
        ADD CONSTRAINT "FK_promocode_claims_balance_operation" 
        FOREIGN KEY ("balance_operation_id") REFERENCES "balance"."balance_operations"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocodes" 
        ADD CONSTRAINT "FK_promocodes_created_by_admin" 
        FOREIGN KEY ("created_by_admin_id") REFERENCES "admin"."admin_users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocode_audit" 
        ADD CONSTRAINT "FK_promocode_audit_promocode" 
        FOREIGN KEY ("promocode_id") REFERENCES "promocodes"."promocodes"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "promocodes"."promocode_audit" 
        ADD CONSTRAINT "FK_promocode_audit_admin" 
        FOREIGN KEY ("admin_id") REFERENCES "admin"."admin_users"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN undefined_table THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "promocodes"."IDX_promocode_claims_ip_address"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "promocodes"."IDX_promocode_claims_user_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "promocodes"."IDX_promocode_claims_promocode_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "promocodes"."IDX_promocode_audit_promocode_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "promocodes"."IDX_promocodes_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "promocodes"."IDX_promocodes_code"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "promocodes"."promocode_claims"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promocodes"."promocode_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promocodes"."promocodes"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "promocodes"."asset_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promocodes"."promocode_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promocodes"."promocode_audit_action_enum"`);

    await queryRunner.query(`DROP SCHEMA IF EXISTS "promocodes" CASCADE`);
  }
}
