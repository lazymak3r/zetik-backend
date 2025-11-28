import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSelfExclusionWagerLimitAndTimestamps1760714400000 implements MigrationInterface {
  name = '7-AddSelfExclusionWagerLimitAndTimestamps-1760714400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add WAGER_LIMIT to the self_exclusion_type enum
    await queryRunner.query(`
      ALTER TYPE "users"."self_exclusions_type_enum"
      ADD VALUE IF NOT EXISTS 'WAGER_LIMIT';
    `);

    // Add removalRequestedAt column
    await queryRunner.query(`
      ALTER TABLE "users"."self_exclusions"
      ADD COLUMN IF NOT EXISTS "removalRequestedAt" TIMESTAMP NULL;
    `);

    // Add postCooldownWindowEnd column
    await queryRunner.query(`
      ALTER TABLE "users"."self_exclusions"
      ADD COLUMN IF NOT EXISTS "postCooldownWindowEnd" TIMESTAMP NULL;
    `);

    // Add comments for new columns
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."self_exclusions"."removalRequestedAt"
      IS 'Timestamp when user requested limit removal (24h countdown starts)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."self_exclusions"."postCooldownWindowEnd"
      IS 'Timestamp marking end of 24h window after cooldown expires (for limit reinstatement)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove comments
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."self_exclusions"."postCooldownWindowEnd" IS NULL;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."self_exclusions"."removalRequestedAt" IS NULL;
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "users"."self_exclusions"
      DROP COLUMN IF EXISTS "postCooldownWindowEnd";
    `);

    await queryRunner.query(`
      ALTER TABLE "users"."self_exclusions"
      DROP COLUMN IF EXISTS "removalRequestedAt";
    `);

    // Note: Cannot remove enum value from PostgreSQL enum type directly
    // This would require recreating the enum type and all dependent columns
    // For safety, we leave the WAGER_LIMIT enum value in place during rollback
    await queryRunner.query(`
      -- Cannot safely remove enum value 'WAGER_LIMIT' from "users"."self_exclusions_type_enum"
      -- Manual intervention required if rollback of enum is necessary
    `);
  }
}
