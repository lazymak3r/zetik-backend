import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSlotImagesTable1762192797106 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "games"."slot_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "directory" character varying(255) NOT NULL,
        "fileName" character varying(255) NOT NULL,
        "key" character varying(512) NOT NULL,
        "url" character varying(1024) NOT NULL,
        "sizeBytes" bigint NOT NULL,
        "mimeType" character varying(255) NOT NULL,
        "uploadedBy" character varying(255) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_slot_images" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_slot_images_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_slot_images_directory" ON "games"."slot_images" ("directory")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "games"."IDX_slot_images_directory"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "games"."slot_images"
    `);
  }
}
