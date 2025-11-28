import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateBlackjackBetTypesToSideBets1755665386590 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Updating blackjack bet types from calculated bets to side bets...');

    // First, remove the old blackjack bet type data that represents calculated bets
    await queryRunner.query(`
            DELETE FROM "games"."game_bet_type_limits" 
            WHERE "betTypeCategory" IN ('blackjack_insurance', 'blackjack_split', 'blackjack_double')
        `);

    // Update the enum to remove old categories and add new side bet categories
    // PostgreSQL requires dropping and recreating the enum to modify it

    // Create new enum with correct values
    await queryRunner.query(`
            CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" AS ENUM(
                'roulette_inside',
                'roulette_outside', 
                'blackjack_main',
                'blackjack_21_plus_3',
                'blackjack_perfect_pairs',
                'default'
            )
        `);

    // Update the table to use the new enum
    await queryRunner.query(`
            ALTER TABLE "games"."game_bet_type_limits" 
            ALTER COLUMN "betTypeCategory" TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
            USING "betTypeCategory"::text::"games"."game_bet_type_limits_bettypecategory_enum_new"
        `);

    // Drop the old enum
    await queryRunner.query(`DROP TYPE "games"."game_bet_type_limits_bettypecategory_enum"`);

    // Rename the new enum to the original name
    await queryRunner.query(`
            ALTER TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
            RENAME TO "game_bet_type_limits_bettypecategory_enum"
        `);

    // Insert the new blackjack side bet data
    await queryRunner.query(`
            INSERT INTO "games"."game_bet_type_limits" 
            ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
            VALUES 
                ('blackjack', 'blackjack_21_plus_3', '21+3 side bet (based on first two cards and dealer up card)', 0.1, 1000, true, 'system', NOW(), NOW()),
                ('blackjack', 'blackjack_perfect_pairs', 'Perfect Pairs side bet (based on first two cards)', 0.1, 1000, true, 'system', NOW(), NOW())
        `);

    // Update the main blackjack bet limit to match the $20K limit from general game limits
    await queryRunner.query(`
            UPDATE "games"."game_bet_type_limits" 
            SET "maxBetUsd" = 20000, "updatedAt" = NOW()
            WHERE "gameType" = 'blackjack' AND "betTypeCategory" = 'blackjack_main'
        `);

    console.log(
      '✅ Updated blackjack bet types: removed calculated bets (insurance, split, double) and added side bets (21+3, perfect pairs)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting blackjack bet type changes...');

    // Remove the new side bet data
    await queryRunner.query(`
            DELETE FROM "games"."game_bet_type_limits" 
            WHERE "betTypeCategory" IN ('blackjack_21_plus_3', 'blackjack_perfect_pairs')
        `);

    // Create old enum with original values
    await queryRunner.query(`
            CREATE TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" AS ENUM(
                'roulette_inside',
                'roulette_outside', 
                'blackjack_main',
                'blackjack_insurance',
                'blackjack_split', 
                'blackjack_double',
                'default'
            )
        `);

    // Update the table to use the old enum
    await queryRunner.query(`
            ALTER TABLE "games"."game_bet_type_limits" 
            ALTER COLUMN "betTypeCategory" TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
            USING "betTypeCategory"::text::"games"."game_bet_type_limits_bettypecategory_enum_new"
        `);

    // Drop the current enum
    await queryRunner.query(`DROP TYPE "games"."game_bet_type_limits_bettypecategory_enum"`);

    // Rename back
    await queryRunner.query(`
            ALTER TYPE "games"."game_bet_type_limits_bettypecategory_enum_new" 
            RENAME TO "game_bet_type_limits_bettypecategory_enum"
        `);

    // Restore original blackjack bet limit
    await queryRunner.query(`
            UPDATE "games"."game_bet_type_limits" 
            SET "maxBetUsd" = 1000, "updatedAt" = NOW()
            WHERE "gameType" = 'blackjack' AND "betTypeCategory" = 'blackjack_main'
        `);

    // Re-insert the old calculated bet data
    await queryRunner.query(`
            INSERT INTO "games"."game_bet_type_limits" 
            ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
            VALUES 
                ('blackjack', 'blackjack_insurance', 'Insurance side bet (max 50% of main bet)', 0.05, 500, true, 'system', NOW(), NOW()),
                ('blackjack', 'blackjack_split', 'Split additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW()),
                ('blackjack', 'blackjack_double', 'Double down additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW())
        `);

    console.log('✅ Reverted blackjack bet types to original calculated bets');
  }
}
