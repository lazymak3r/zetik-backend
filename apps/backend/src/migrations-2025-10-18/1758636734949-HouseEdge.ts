import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseEdge1758636734949 implements MigrationInterface {
  name = 'HouseEdge1758636734949';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."provider_games" ADD "houseEdge" DECIMAL(5,2) NOT NULL DEFAULT 1.00`,
    );
    await queryRunner.query(
      `UPDATE "games"."provider_games" SET "houseEdge" = COALESCE(100 - "rtp", 1.00)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games"."provider_games" DROP COLUMN "houseEdge"`);
  }
}
