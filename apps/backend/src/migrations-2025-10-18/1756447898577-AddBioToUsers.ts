import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBioToUsers1756447898577 implements MigrationInterface {
  name = 'AddBioToUsers1756447898577';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" ADD "bio" character varying(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "bio"`);
  }
}
