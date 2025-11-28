import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserVerificationTables1756500000000 implements MigrationInterface {
  name = 'AddUserVerificationTables1756500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create verification status enum
    await queryRunner.query(`
      CREATE TYPE "users"."verification_status_enum" AS ENUM(
        'not_started', 
        'pending', 
        'approved', 
        'rejected', 
        'expired'
      )
    `);

    // Create document type enum
    await queryRunner.query(`
      CREATE TYPE "users"."document_type_enum" AS ENUM(
        'government_id',
        'drivers_license', 
        'passport',
        'national_id',
        'proof_of_address',
        'utility_bill',
        'bank_statement',
        'selfie_with_id'
      )
    `);

    // Create verification level enum
    await queryRunner.query(`
      CREATE TYPE "users"."verification_level_enum" AS ENUM(
        'level_1_email',
        'level_2_basic_info',
        'level_3_identity'
      )
    `);

    // Create user_verifications table
    await queryRunner.query(`
      CREATE TABLE "users"."user_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "level" "users"."verification_level_enum" NOT NULL,
        "status" "users"."verification_status_enum" NOT NULL DEFAULT 'not_started',
        "rejectionReason" character varying,
        "adminNotes" character varying,
        "reviewedBy" character varying,
        "reviewedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create verification_documents table
    await queryRunner.query(`
      CREATE TABLE "users"."verification_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "verification_id" uuid NOT NULL,
        "documentType" "users"."document_type_enum" NOT NULL,
        "originalFileName" character varying NOT NULL,
        "storedFileName" character varying NOT NULL,
        "filePath" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "fileSize" bigint NOT NULL,
        "status" "users"."verification_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_documents" PRIMARY KEY ("id")
      )
    `);

    // Create verification_basic_info table
    await queryRunner.query(`
      CREATE TABLE "users"."verification_basic_info" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "dateOfBirth" TIMESTAMP NOT NULL,
        "phoneNumber" character varying NOT NULL,
        "address" character varying NOT NULL,
        "city" character varying NOT NULL,
        "state" character varying NOT NULL,
        "postalCode" character varying NOT NULL,
        "country" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_basic_info" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_user_verifications_user_id" ON "users"."user_verifications" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_verification_documents_verification_id" ON "users"."verification_documents" ("verification_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_verification_basic_info_user_id" ON "users"."verification_basic_info" ("user_id")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "users"."user_verifications" 
      ADD CONSTRAINT "FK_user_verifications_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."verification_documents" 
      ADD CONSTRAINT "FK_verification_documents_verification_id" 
      FOREIGN KEY ("verification_id") REFERENCES "users"."user_verifications"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."verification_basic_info" 
      ADD CONSTRAINT "FK_verification_basic_info_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE CASCADE
    `);

    // Add unique constraints to ensure one verification per user per level
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_verifications_user_level_unique" 
      ON "users"."user_verifications" ("user_id", "level")
    `);

    // Add unique constraint for one basic info per user
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_verification_basic_info_user_unique" 
      ON "users"."verification_basic_info" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "users"."verification_basic_info"`);
    await queryRunner.query(`DROP TABLE "users"."verification_documents"`);
    await queryRunner.query(`DROP TABLE "users"."user_verifications"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "users"."verification_level_enum"`);
    await queryRunner.query(`DROP TYPE "users"."document_type_enum"`);
    await queryRunner.query(`DROP TYPE "users"."verification_status_enum"`);
  }
}
