import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSettings1756432479657 implements MigrationInterface {
  name = 'AddUserSettings1756432479657';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "emailMarketing" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "streamerMode" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "excludeFromRain" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "hideStatistics" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "hideRaceStatistics" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "hideRaceStatistics"`);
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "hideStatistics"`);
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "excludeFromRain"`);
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "streamerMode"`);
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "emailMarketing"`);
  }
}
