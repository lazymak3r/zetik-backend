import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneVerification1760694264625 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add phone verification columns to users table
    await queryRunner.query(`
            ALTER TABLE "users"."users"
            ADD COLUMN "phoneNumber" character varying,
            ADD COLUMN "isPhoneVerified" boolean NOT NULL DEFAULT false,
            ADD COLUMN "phoneVerifiedAt" TIMESTAMP
        `);

    // Add unique constraint for phone number
    await queryRunner.query(`
            ALTER TABLE "users"."users"
            ADD CONSTRAINT "UQ_users_phoneNumber" UNIQUE ("phoneNumber")
        `);

    // Create phone_verifications table
    await queryRunner.query(`
            CREATE TABLE "users"."phone_verifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "phoneNumber" character varying NOT NULL,
                "code" character varying NOT NULL,
                "attempts" integer NOT NULL DEFAULT 0,
                "expiresAt" TIMESTAMP NOT NULL,
                "isUsed" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_phone_verifications" PRIMARY KEY ("id")
            )
        `);

    // Add indexes for phone_verifications table
    await queryRunner.query(`
            CREATE INDEX "IDX_phone_verifications_userId" ON "users"."phone_verifications" ("userId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_phone_verifications_phoneNumber" ON "users"."phone_verifications" ("phoneNumber")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_phone_verifications_phoneNumber_expiresAt" ON "users"."phone_verifications" ("phoneNumber", "expiresAt")
        `);

    // Add foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "users"."phone_verifications"
            ADD CONSTRAINT "FK_phone_verifications_userId"
            FOREIGN KEY ("userId") REFERENCES "users"."users"("id")
            ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "users"."phone_verifications"
            DROP CONSTRAINT "FK_phone_verifications_userId"
        `);

    // Drop indexes
    await queryRunner.query(`
            DROP INDEX "users"."IDX_phone_verifications_phoneNumber_expiresAt"
        `);

    await queryRunner.query(`
            DROP INDEX "users"."IDX_phone_verifications_phoneNumber"
        `);

    await queryRunner.query(`
            DROP INDEX "users"."IDX_phone_verifications_userId"
        `);

    // Drop phone_verifications table
    await queryRunner.query(`
            DROP TABLE "users"."phone_verifications"
        `);

    // Drop unique constraint for phone number
    await queryRunner.query(`
            ALTER TABLE "users"."users"
            DROP CONSTRAINT "UQ_users_phoneNumber"
        `);

    // Remove phone verification columns from users table
    await queryRunner.query(`
            ALTER TABLE "users"."users"
            DROP COLUMN "phoneVerifiedAt",
            DROP COLUMN "isPhoneVerified",
            DROP COLUMN "phoneNumber"
        `);
  }
}
