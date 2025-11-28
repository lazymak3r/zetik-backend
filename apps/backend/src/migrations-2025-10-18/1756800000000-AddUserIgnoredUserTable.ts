import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIgnoredUserTable1756800000000 implements MigrationInterface {
  name = 'AddUserIgnoredUserTable1756800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users"."user_ignored_users" (
        "id" SERIAL NOT NULL,
        "ignorerId" uuid NOT NULL,
        "ignoredUserId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_ignored_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_ignored_users_ignorer" FOREIGN KEY ("ignorerId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_ignored_users_ignored" FOREIGN KEY ("ignoredUserId") REFERENCES "users"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_user_ignored_users_ignorerId" ON "users"."user_ignored_users" ("ignorerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_ignored_users_ignoredUserId" ON "users"."user_ignored_users" ("ignoredUserId")`,
    );

    // Create unique constraint to prevent duplicate ignores
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_ignored_users_unique" ON "users"."user_ignored_users" ("ignorerId", "ignoredUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "users"."IDX_user_ignored_users_unique"`);
    await queryRunner.query(`DROP INDEX "users"."IDX_user_ignored_users_ignoredUserId"`);
    await queryRunner.query(`DROP INDEX "users"."IDX_user_ignored_users_ignorerId"`);
    await queryRunner.query(`DROP TABLE "users"."user_ignored_users"`);
  }
}
