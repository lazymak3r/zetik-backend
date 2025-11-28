import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultAvatarsAndSystemSeeds1760915314825 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create default_avatars table in users schema
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."default_avatars" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "avatarUrl" character varying(500) NOT NULL,
        "originalFilename" character varying(255) NOT NULL,
        "fileSize" integer NOT NULL,
        "mimeType" character varying(50) NOT NULL,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "description" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_default_avatars" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "users"."default_avatars" IS 'System-wide default avatars available to all users'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."default_avatars"."displayOrder" IS 'Display order in gallery (lower = higher priority)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."default_avatars"."isActive" IS 'Whether this avatar is shown to users (allows soft-delete)'
    `);

    // Create index for efficient querying
    await queryRunner.query(`
      CREATE INDEX "IDX_default_avatars_active_order" ON "users"."default_avatars" ("isActive", "displayOrder")
    `);

    // Add defaultAvatarId column to users table
    await queryRunner.query(`
      ALTER TABLE "users"."users"
      ADD COLUMN "defaultAvatarId" uuid NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."users"."defaultAvatarId" IS 'Reference to selected default avatar'
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"."users"
      ADD CONSTRAINT "FK_users_defaultAvatarId"
      FOREIGN KEY ("defaultAvatarId")
      REFERENCES "users"."default_avatars"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"."users"
      DROP CONSTRAINT IF EXISTS "FK_users_defaultAvatarId"
    `);

    // Remove defaultAvatarId column
    await queryRunner.query(`
      ALTER TABLE "users"."users"
      DROP COLUMN IF EXISTS "defaultAvatarId"
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "users"."IDX_default_avatars_active_order"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "users"."default_avatars"
    `);
  }
}
