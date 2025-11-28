import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRacePrizePrecision1761025194512 implements MigrationInterface {
  name = 'FixRacePrizePrecision1761025194512';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRaces = await queryRunner.hasTable('bonus.races');
    if (hasRaces) {
      await queryRunner.query(`
        ALTER TABLE "bonus"."races" 
        ALTER COLUMN "prizePool" TYPE decimal(20, 8);
      `);

      // Drop old constraint if it exists
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'chk_race_status' AND conrelid = 'bonus.races'::regclass
          ) THEN
            ALTER TABLE "bonus"."races" DROP CONSTRAINT chk_race_status;
          END IF;
        END $$;
      `);

      // Add new constraint with FINALIZING status
      await queryRunner.query(`
        ALTER TABLE "bonus"."races"
        ADD CONSTRAINT chk_race_status 
        CHECK (status IN ('PENDING', 'ACTIVE', 'FINALIZING', 'ENDED'));
      `);
    }

    const hasParticipants = await queryRunner.hasTable('bonus.race_participants');
    if (hasParticipants) {
      await queryRunner.query(`
        ALTER TABLE "bonus"."race_participants" 
        ALTER COLUMN "reward" TYPE decimal(20, 8);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasRaces = await queryRunner.hasTable('bonus.races');
    if (hasRaces) {
      await queryRunner.query(`
        ALTER TABLE "bonus"."races" 
        ALTER COLUMN "prizePool" TYPE decimal(20, 2);
      `);

      // Revert to old constraint without FINALIZING
      await queryRunner.query(`
        ALTER TABLE "bonus"."races"
        DROP CONSTRAINT IF EXISTS chk_race_status;
      `);

      await queryRunner.query(`
        ALTER TABLE "bonus"."races"
        ADD CONSTRAINT chk_race_status 
        CHECK (status IN ('PENDING', 'ACTIVE', 'ENDED'));
      `);
    }

    const hasParticipants = await queryRunner.hasTable('bonus.race_participants');
    if (hasParticipants) {
      await queryRunner.query(`
        ALTER TABLE "bonus"."race_participants" 
        ALTER COLUMN "reward" TYPE decimal(20, 2);
      `);
    }
  }
}
