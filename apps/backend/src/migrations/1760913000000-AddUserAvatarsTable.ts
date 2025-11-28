import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarsTable1760913000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_avatars table
    await queryRunner.query(`
      CREATE TABLE "users"."user_avatars" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "avatarUrl" character varying(500) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "originalFilename" character varying(255),
        "fileSize" integer,
        "mimeType" character varying(50),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_avatars" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_user_avatars_userId" ON "users"."user_avatars" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_avatars_userId_isActive" ON "users"."user_avatars" ("userId", "isActive")
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"."user_avatars"
      ADD CONSTRAINT "FK_user_avatars_userId"
      FOREIGN KEY ("userId")
      REFERENCES "users"."users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // Add comment to table
    await queryRunner.query(`
      COMMENT ON TABLE "users"."user_avatars" IS 'User avatar gallery - stores multiple avatars per user'
    `);

    // Add column comments
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."id" IS 'Unique avatar ID'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."userId" IS 'User ID who owns this avatar'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."avatarUrl" IS 'Full URL to the avatar image in MinIO storage'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."isActive" IS 'Only one avatar can be active per user at a time'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."originalFilename" IS 'Original filename for user reference'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."fileSize" IS 'File size in bytes for storage tracking'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."user_avatars"."mimeType" IS 'MIME type (image/jpeg, image/png, image/webp)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"."user_avatars"
      DROP CONSTRAINT "FK_user_avatars_userId"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "users"."IDX_user_avatars_userId_isActive"
    `);

    await queryRunner.query(`
      DROP INDEX "users"."IDX_user_avatars_userId"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "users"."user_avatars"
    `);
  }
}
