import { QueryRunner } from 'typeorm';

/**
 * Migration: Add unique constraint for active seed pairs
 *
 * Purpose: Enforce database-level constraint to prevent race conditions
 * when creating initial seed pairs for users.
 *
 * Constraint: Only ONE active seed pair per user at any time
 * Implementation: Partial unique index on (userId) WHERE isActive = true
 *
 * This prevents duplicate active seed pairs that can occur when:
 * - Multiple concurrent requests create the first bet for a new user
 * - Parallel API calls attempt to initialize seed pairs simultaneously
 *
 * The constraint is backward-compatible:
 * - Existing data is already valid (no duplicate active pairs exist)
 * - Historical inactive seed pairs are not affected (WHERE clause)
 * - PostgreSQL partial indexes are performant and well-supported
 *
 * Error handling:
 * - Violation of this constraint triggers a database error
 * - Existing retry logic in provably-fair.service.ts handles failures
 * - Transaction rollback ensures data consistency
 */
export class AddUniqueSeedPairConstraint1760097000000 {
  name = 'AddUniqueSeedPairConstraint1760097000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create partial unique index to enforce only one active seed pair per user
    // This index only applies to rows where isActive = true
    // Multiple inactive seed pairs per user are still allowed (seed history)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_seed_pairs_userId_active_unique"
       ON games.seed_pairs ("userId")
       WHERE "isActive" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint index
    await queryRunner.query(`DROP INDEX IF EXISTS games."IDX_seed_pairs_userId_active_unique"`);
  }
}
