import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MIGRATION NOTICE (Pre-release phase):
 * - This migration may set affiliateCampaignId to NULL for invalid values
 * - Only affects data that doesn't match UUID format (empty strings, malformed UUIDs)
 * - Pre-release phase: acceptable data loss for cleaner migration
 * - Post-release: would need custom migration per invalid case
 */
export class MakeAffiliateCaseInsensitiveAndAddWagered1761705328751 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Fill null codes with generated values (code-{uuid-suffix})
    // Use single query instead of loop for better performance
    await queryRunner.query(`
      UPDATE affiliate.affiliate_campaigns
      SET code = CONCAT('code-', SUBSTRING(id::text, 1, 8))
      WHERE code IS NULL
    `);

    // Step 2: Find all codes with duplicates (case-insensitive)
    const duplicatesQuery = `
      SELECT LOWER(code) as lower_code, array_agg(id ORDER BY "createdAt") as ids
      FROM affiliate.affiliate_campaigns
      WHERE code IS NOT NULL
      GROUP BY LOWER(code)
      HAVING COUNT(*) > 1
    `;

    const duplicates = await queryRunner.query(duplicatesQuery);

    // Step 3: Rename duplicates by adding -1, -2, etc.
    for (const dup of duplicates) {
      const ids = dup.ids;
      // Keep the first one as is, rename the rest
      for (let i = 1; i < ids.length; i++) {
        const newCode = await this.findAvailableCode(queryRunner, dup.lower_code, i);
        await queryRunner.query(
          `UPDATE affiliate.affiliate_campaigns SET code = $1 WHERE id = $2`,
          [newCode, ids[i]],
        );
      }
    }

    // Step 4: Make code column NOT NULL
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_campaigns
      ALTER COLUMN code SET NOT NULL
    `);

    // Step 5: Drop existing unique constraint on code column
    // First, find the constraint name
    const constraintQuery = `
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'affiliate'
        AND table_name = 'affiliate_campaigns'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%code%'
    `;

    const constraints = await queryRunner.query(constraintQuery);
    for (const constraint of constraints) {
      await queryRunner.query(
        `ALTER TABLE affiliate.affiliate_campaigns DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}"`,
      );
    }

    // Step 6: Create case-insensitive unique index on LOWER(code)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_campaigns_code_lower
      ON affiliate.affiliate_campaigns (LOWER(code))
    `);

    // Step 7: Change affiliateCampaignId from varchar to uuid for better performance
    // This fixes the "operator does not exist: character varying = uuid" error

    // First, check if column is already uuid type
    const columnCheck = await queryRunner.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'users' 
        AND table_name = 'users' 
        AND column_name = 'affiliateCampaignId'
    `);

    if (columnCheck.length > 0 && columnCheck[0].data_type !== 'uuid') {
      // Step 7a: Find and log invalid UUIDs before cleaning
      const invalidRows = await queryRunner.query(`
        SELECT id, "affiliateCampaignId"
        FROM users.users 
        WHERE "affiliateCampaignId" IS NOT NULL 
          AND "affiliateCampaignId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        LIMIT 100
      `);

      if (invalidRows.length > 0) {
        console.log(`[Migration] Found ${invalidRows.length} invalid affiliateCampaignId values:`);
        invalidRows.forEach((row: any) => {
          console.log(`  User ID: ${row.id}, Invalid value: "${row.affiliateCampaignId}"`);
        });
      }

      // Step 7b: Clean invalid data (empty strings, malformed UUIDs)
      const updateResult = await queryRunner.query(`
        UPDATE users.users 
        SET "affiliateCampaignId" = NULL 
        WHERE "affiliateCampaignId" IS NOT NULL 
          AND "affiliateCampaignId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);

      console.log(`[Migration] Cleaned ${updateResult[1] || 0} invalid affiliateCampaignId values`);

      // Step 7c: Verify all remaining values are valid UUIDs before conversion
      const remainingInvalid = await queryRunner.query(`
        SELECT COUNT(*) as count
        FROM users.users 
        WHERE "affiliateCampaignId" IS NOT NULL 
          AND "affiliateCampaignId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      `);

      if (remainingInvalid[0].count > 0) {
        console.warn(
          `[Migration] Warning: Still found ${remainingInvalid[0].count} invalid affiliateCampaignId values after cleaning`,
        );
      }

      // Step 7d: Perform type change
      // NOTE: Pre-release phase - it's acceptable to lose invalid data by setting to NULL
      // If conversion fails, we set problematic rows to NULL rather than failing the migration
      console.log('[Migration] Converting affiliateCampaignId from varchar to uuid...');
      try {
        await queryRunner.query(`
          ALTER TABLE users.users 
          ALTER COLUMN "affiliateCampaignId" TYPE uuid USING "affiliateCampaignId"::uuid
        `);
        console.log('[Migration] Successfully converted affiliateCampaignId to uuid type');
      } catch (error) {
        console.error(
          '[Migration] Type conversion failed, setting remaining invalid values to NULL',
        );
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);

        // Find and log the problematic rows
        const problematicRows = await queryRunner.query(`
          SELECT id, "affiliateCampaignId"
          FROM users.users 
          WHERE "affiliateCampaignId" IS NOT NULL
          LIMIT 50
        `);

        console.log('[Migration] Problematic rows:');
        problematicRows.forEach((row: any) => {
          console.log(`  User ID: ${row.id}, Value: "${row.affiliateCampaignId}"`);
        });

        // CRITICAL FIX: Only set INVALID values to NULL, not ALL values
        // Use the same regex pattern to identify invalid UUIDs
        const cleanupResult = await queryRunner.query(`
          UPDATE users.users 
          SET "affiliateCampaignId" = NULL 
          WHERE "affiliateCampaignId" IS NOT NULL 
            AND "affiliateCampaignId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        `);

        console.log(
          `[Migration] Set ${cleanupResult[1] || 0} INVALID affiliateCampaignId values to NULL (kept valid UUIDs)`,
        );

        // Retry conversion (should succeed with all NULLs)
        await queryRunner.query(`
          ALTER TABLE users.users 
          ALTER COLUMN "affiliateCampaignId" TYPE uuid USING "affiliateCampaignId"::uuid
        `);
        console.log(
          '[Migration] Successfully converted affiliateCampaignId to uuid type after cleanup',
        );
      }
    }

    // Step 8: Add wagered field to affiliate_wallets
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_wallets
      ADD COLUMN IF NOT EXISTS wagered DECIMAL(25, 10) DEFAULT '0' NOT NULL
    `);

    // Step 9: Add wagered field to affiliate_earnings
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_earnings
      ADD COLUMN IF NOT EXISTS wagered DECIMAL(25, 10) DEFAULT '0' NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Remove wagered field from affiliate_earnings
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_earnings
      DROP COLUMN IF EXISTS wagered
    `);

    // Step 2: Remove wagered field from affiliate_wallets
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_wallets
      DROP COLUMN IF EXISTS wagered
    `);

    // Step 3: Convert affiliateCampaignId back to varchar (if it was converted to uuid)
    const columnCheck = await queryRunner.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'users' 
        AND table_name = 'users' 
        AND column_name = 'affiliateCampaignId'
    `);

    if (columnCheck.length > 0 && columnCheck[0].data_type === 'uuid') {
      await queryRunner.query(`
        ALTER TABLE users.users 
        ALTER COLUMN "affiliateCampaignId" TYPE varchar USING "affiliateCampaignId"::varchar
      `);
    }

    // Step 4: Drop case-insensitive index
    await queryRunner.query(`
      DROP INDEX IF EXISTS affiliate.idx_affiliate_campaigns_code_lower
    `);

    // Step 5: Restore original unique constraint on code column (case-sensitive)
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_campaigns
      ADD CONSTRAINT UQ_affiliate_campaigns_code UNIQUE (code)
    `);

    // Step 6: Make code column nullable again (if it was nullable before)
    await queryRunner.query(`
      ALTER TABLE affiliate.affiliate_campaigns
      ALTER COLUMN code DROP NOT NULL
    `);
  }

  private async findAvailableCode(
    queryRunner: QueryRunner,
    baseCode: string,
    startingSuffix: number,
  ): Promise<string> {
    let suffix = startingSuffix;
    let newCode = `${baseCode}-${suffix}`;

    while (true) {
      const existing = await queryRunner.query(
        `SELECT id FROM affiliate.affiliate_campaigns WHERE LOWER(code) = LOWER($1)`,
        [newCode],
      );

      if (existing.length === 0) {
        return newCode;
      }

      suffix++;
      newCode = `${baseCode}-${suffix}`;
    }
  }
}
