import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessionTrackingTable1764112164898 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users"."session_tracking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tokenHash" character varying(64) NOT NULL UNIQUE,
        "userId" uuid NOT NULL,
        "deviceInfo" character varying(255),
        "ipAddress" character varying(45) NOT NULL,
        "location" character varying(255),
        "lastActivityAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_tracking_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_session_tracking_userId" FOREIGN KEY ("userId") 
          REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."refresh_tokens" 
      ADD COLUMN IF NOT EXISTS "sessionId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_tracking_userId_lastActivityAt" 
      ON "users"."session_tracking" ("userId", "lastActivityAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_tracking_lastActivityAt" 
      ON "users"."session_tracking" ("lastActivityAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_tracking_tokenHash" 
      ON "users"."session_tracking" ("tokenHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"."refresh_tokens" 
      DROP COLUMN IF EXISTS "sessionId"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_session_tracking_tokenHash"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "users"."IDX_session_tracking_userId_lastActivityAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "users"."IDX_session_tracking_lastActivityAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."session_tracking"`);
  }
}
