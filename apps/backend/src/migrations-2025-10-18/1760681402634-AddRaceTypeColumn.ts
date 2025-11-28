import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRaceTypeColumn1760681402634 implements MigrationInterface {
  name = 'AddRaceTypeColumn1760681402634';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bonus"."races" 
      ADD COLUMN "raceType" VARCHAR(20)
    `);

    await queryRunner.query(`
      UPDATE "bonus"."races" 
      SET "raceType" = CASE 
        WHEN "name" LIKE 'Weekly Race%' AND "sponsorId" IS NULL AND "referralCode" IS NULL THEN 'WEEKLY'
        WHEN "name" LIKE 'Monthly Race%' AND "sponsorId" IS NULL AND "referralCode" IS NULL THEN 'MONTHLY'
        WHEN "sponsorId" IS NOT NULL THEN 'SPONSORED'
        ELSE 'SPONSORED'
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "bonus"."races" 
      ALTER COLUMN "raceType" SET DEFAULT 'SPONSORED'
    `);

    await queryRunner.query(`
      ALTER TABLE "bonus"."races" 
      ALTER COLUMN "raceType" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_races_raceType" ON "bonus"."races" ("raceType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "bonus"."IDX_races_raceType"`);
    await queryRunner.query(`ALTER TABLE "bonus"."races" DROP COLUMN "raceType"`);
  }
}
