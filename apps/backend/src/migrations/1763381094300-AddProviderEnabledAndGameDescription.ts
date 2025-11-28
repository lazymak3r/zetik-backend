import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderEnabledAndGameDescription1763381094300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'games' 
          AND table_name = 'provider_developers' 
          AND column_name = 'enabled'
        ) THEN
          ALTER TABLE "games"."provider_developers"
          ADD COLUMN "enabled" boolean NOT NULL DEFAULT true;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'games' 
          AND table_name = 'provider_games' 
          AND column_name = 'description'
        ) THEN
          ALTER TABLE "games"."provider_games"
          ADD COLUMN "description" text;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'games' 
          AND table_name = 'provider_games' 
          AND column_name = 'description'
        ) THEN
          ALTER TABLE "games"."provider_games"
          DROP COLUMN "description";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'games' 
          AND table_name = 'provider_developers' 
          AND column_name = 'enabled'
        ) THEN
          ALTER TABLE "games"."provider_developers"
          DROP COLUMN "enabled";
        END IF;
      END $$;
    `);
  }
}
