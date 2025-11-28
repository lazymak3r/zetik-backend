import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVipTransferSubmissions1762258552000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "bonus"."vip_transfer_tag_enum" AS ENUM('New', 'Pending', 'Approved', 'Rejected');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "bonus"."vip_transfer_casino_enum" AS ENUM('shuffle', 'rollbit', 'gamdom', 'roobet', 'bcgame');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bonus"."bonuses_vip_transfer_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "country" character varying(255) NOT NULL,
        "contactMethod" character varying(50) NOT NULL DEFAULT 'telegram',
        "telegramUsername" character varying(255) NOT NULL,
        "casino" "bonus"."vip_transfer_casino_enum" NOT NULL,
        "casinoUsername" character varying(255) NOT NULL,
        "totalWager" numeric(20,2) NOT NULL,
        "rank" character varying(255) NOT NULL,
        "howDidYouHear" text,
        "tag" "bonus"."vip_transfer_tag_enum" DEFAULT 'New',
        "customNote" text,
        "tagged_by_admin_id" uuid,
        "tagged_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bonuses_vip_transfer_submissions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bonuses_vip_transfer_submissions_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"."users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bonuses_vip_transfer_submissions_tagged_by_admin_id" 
          FOREIGN KEY ("tagged_by_admin_id") REFERENCES "admin"."admin_users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bonuses_vip_transfer_submissions_userId" 
      ON "bonus"."bonuses_vip_transfer_submissions" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bonuses_vip_transfer_submissions_tag" 
      ON "bonus"."bonuses_vip_transfer_submissions" ("tag");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bonuses_vip_transfer_submissions_createdAt" 
      ON "bonus"."bonuses_vip_transfer_submissions" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bonus"."bonuses_vip_transfer_submissions";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bonus"."vip_transfer_casino_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "bonus"."vip_transfer_tag_enum";`);
  }
}
