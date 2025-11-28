import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModeratorRoleAndUserModeration1762354704300 implements MigrationInterface {
  name = 'AddModeratorRoleAndUserModeration1762354704300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "admin"."admin_role_enum" AS ENUM('moderator', 'admin', 'super_admin');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'moderator' 
          AND enumtypid = (
            SELECT oid FROM pg_type 
            WHERE typname = 'admin_role_enum' 
            AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'admin')
          )
        ) THEN
          ALTER TYPE "admin"."admin_role_enum" ADD VALUE 'moderator';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'admin' 
          AND table_name = 'admin_users' 
          AND column_name = 'role'
          AND data_type != 'USER-DEFINED'
        ) THEN
          ALTER TABLE "admin"."admin_users" 
          ALTER COLUMN "role" DROP DEFAULT;
          
          ALTER TABLE "admin"."admin_users" 
          ALTER COLUMN "role" TYPE "admin"."admin_role_enum" 
          USING CASE 
            WHEN "role" = 'moderator' THEN 'moderator'::"admin"."admin_role_enum"
            WHEN "role" = 'admin' THEN 'admin'::"admin"."admin_role_enum"
            WHEN "role" = 'super_admin' THEN 'super_admin'::"admin"."admin_role_enum"
            ELSE 'admin'::"admin"."admin_role_enum"
          END;
          
          ALTER TABLE "admin"."admin_users" 
          ALTER COLUMN "role" SET DEFAULT 'admin'::"admin"."admin_role_enum";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'admin' 
          AND table_name = 'admin_users' 
          AND column_name = 'userId'
        ) THEN
          ALTER TABLE "admin"."admin_users" 
          ADD COLUMN "userId" uuid;

          ALTER TABLE "admin"."admin_users" 
          ADD CONSTRAINT "UQ_admin_users_userId" UNIQUE ("userId");

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_admin_users_userId'
          ) THEN
            ALTER TABLE "admin"."admin_users" 
            ADD CONSTRAINT "FK_admin_users_userId" 
            FOREIGN KEY ("userId") 
            REFERENCES "users"."users"("id") 
            ON DELETE SET NULL 
            ON UPDATE CASCADE;
          END IF;

          CREATE INDEX IF NOT EXISTS "IDX_admin_users_userId" 
          ON "admin"."admin_users"("userId");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'users' 
          AND table_name = 'users' 
          AND column_name = 'mutedUntil'
        ) THEN
          ALTER TABLE "users"."users" 
          ADD COLUMN "mutedUntil" TIMESTAMP;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'users' 
          AND table_name = 'users' 
          AND column_name = 'muteReason'
        ) THEN
          ALTER TABLE "users"."users" 
          ADD COLUMN "muteReason" character varying(500);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "users"."moderation_action_type_enum" AS ENUM('MUTE', 'BAN');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."user_moderation_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "adminId" uuid NOT NULL,
        "actionType" "users"."moderation_action_type_enum" NOT NULL,
        "reason" character varying(500),
        "durationMinutes" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_moderation_history_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_moderation_history_userId" 
      ON "users"."user_moderation_history"("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_moderation_history_adminId" 
      ON "users"."user_moderation_history"("adminId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_moderation_history_createdAt" 
      ON "users"."user_moderation_history"("createdAt")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_moderation_history_userId'
        ) THEN
          ALTER TABLE "users"."user_moderation_history" 
          ADD CONSTRAINT "FK_user_moderation_history_userId" 
          FOREIGN KEY ("userId") 
          REFERENCES "users"."users"("id") 
          ON DELETE CASCADE 
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_moderation_history_adminId'
        ) THEN
          ALTER TABLE "users"."user_moderation_history" 
          ADD CONSTRAINT "FK_user_moderation_history_adminId" 
          FOREIGN KEY ("adminId") 
          REFERENCES "users"."users"("id") 
          ON DELETE CASCADE 
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "users"."user_moderation_history"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "users"."moderation_action_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."users" 
      DROP COLUMN IF EXISTS "mutedUntil"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."users" 
      DROP COLUMN IF EXISTS "muteReason"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_admin_users_userId"
    `);

    await queryRunner.query(`
      ALTER TABLE "admin"."admin_users" 
      DROP CONSTRAINT IF EXISTS "FK_admin_users_userId"
    `);

    await queryRunner.query(`
      ALTER TABLE "admin"."admin_users" 
      DROP CONSTRAINT IF EXISTS "UQ_admin_users_userId"
    `);

    await queryRunner.query(`
      ALTER TABLE "admin"."admin_users" 
      DROP COLUMN IF EXISTS "userId"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'admin' 
          AND table_name = 'admin_users' 
          AND column_name = 'role'
          AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE "admin"."admin_users" 
          ALTER COLUMN "role" TYPE character varying;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "admin"."admin_role_enum"
    `);
  }
}
