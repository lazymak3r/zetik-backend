import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add2FAFields1756432900000 implements MigrationInterface {
  name = 'Add2FAFields1756432900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "is2FAEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users"."users" ADD "twoFactorSecret" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "twoFactorSecret"`);
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "is2FAEnabled"`);
  }
}
