import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMonthlyRacePrizes1760653278234 implements MigrationInterface {
  name = 'CreateMonthlyRacePrizes1760653278234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create bonus.monthly_race_prizes table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "bonus"."monthly_race_prizes" (
        "place" integer NOT NULL,
        "amountUsd" numeric(20,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_monthly_race_prizes_place" PRIMARY KEY ("place")
      )`,
    );

    // Seed monthly race prizes with 2x weekly values (top 50)
    await queryRunner.query(
      `INSERT INTO "bonus"."monthly_race_prizes" ("place", "amountUsd") VALUES
        (1, '40000.00'),
        (2, '20000.00'),
        (3, '10000.00'),
        (4, '4000.00'),
        (5, '3000.00'),
        (6, '2000.00'),
        (7, '1800.00'),
        (8, '1600.00'),
        (9, '1400.00'),
        (10, '1200.00'),
        (11, '1000.00'),
        (12, '1000.00'),
        (13, '1000.00'),
        (14, '1000.00'),
        (15, '800.00'),
        (16, '800.00'),
        (17, '800.00'),
        (18, '800.00'),
        (19, '600.00'),
        (20, '600.00'),
        (21, '600.00'),
        (22, '600.00'),
        (23, '400.00'),
        (24, '400.00'),
        (25, '400.00'),
        (26, '400.00'),
        (27, '200.00'),
        (28, '200.00'),
        (29, '200.00'),
        (30, '200.00'),
        (31, '200.00'),
        (32, '200.00'),
        (33, '200.00'),
        (34, '200.00'),
        (35, '200.00'),
        (36, '200.00'),
        (37, '200.00'),
        (38, '200.00'),
        (39, '200.00'),
        (40, '200.00'),
        (41, '100.00'),
        (42, '100.00'),
        (43, '100.00'),
        (44, '100.00'),
        (45, '100.00'),
        (46, '100.00'),
        (47, '100.00'),
        (48, '100.00'),
        (49, '100.00'),
        (50, '100.00')
      ON CONFLICT ("place") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM "bonus"."monthly_race_prizes"');
    await queryRunner.query('DROP TABLE IF EXISTS "bonus"."monthly_race_prizes"');
  }
}
