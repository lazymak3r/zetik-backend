import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUniversalRaceSystem1759380000000 implements MigrationInterface {
  name = 'CreateUniversalRaceSystem1759380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Move weekly_race_prizes from games to bonus schema (if not already moved)
    const weeklyPrizesInGames = await queryRunner.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'games' AND table_name = 'weekly_race_prizes')`,
    );
    const weeklyPrizesInBonus = await queryRunner.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'bonus' AND table_name = 'weekly_race_prizes')`,
    );

    if (weeklyPrizesInGames[0].exists && !weeklyPrizesInBonus[0].exists) {
      // Move from games to bonus
      await queryRunner.query(`ALTER TABLE games.weekly_race_prizes SET SCHEMA bonus`);
    } else if (weeklyPrizesInGames[0].exists && weeklyPrizesInBonus[0].exists) {
      // Both exist - drop from games, keep in bonus
      await queryRunner.query(`DROP TABLE games.weekly_race_prizes CASCADE`);
    }

    // Drop old weekly race tables
    await queryRunner.query(`DROP TABLE IF EXISTS games.weekly_race_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS games.weekly_races CASCADE`);

    // Create universal races table in bonus schema (if not exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bonus.races (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        "startsAt" TIMESTAMP NOT NULL,
        "endsAt" TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "prizePool" DECIMAL(20, 2) NOT NULL,
        prizes DECIMAL[] NOT NULL,
        asset VARCHAR(10) NULL,
        fiat VARCHAR(3) NULL,
        "referralCode" VARCHAR(50) NULL,
        "sponsorId" UUID NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add constraint if table already exists but constraint doesn't
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_asset_or_fiat'
        ) THEN
          ALTER TABLE bonus.races ADD CONSTRAINT "chk_asset_or_fiat" CHECK (
            (asset IS NOT NULL AND fiat IS NULL) OR 
            (asset IS NULL AND fiat IS NOT NULL)
          );
        END IF;
      END $$;
    `);

    // Create universal race_participants table (if not exists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bonus.race_participants (
        "raceId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "totalWageredCents" BIGINT NOT NULL DEFAULT 0,
        place INT NULL,
        reward DECIMAL(20, 2) NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY ("raceId", "userId")
      )
    `);

    // Add foreign key constraints if they don't exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_race_participants_race'
        ) THEN
          ALTER TABLE bonus.race_participants ADD CONSTRAINT "fk_race_participants_race" 
            FOREIGN KEY ("raceId") REFERENCES bonus.races(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_race_participants_user'
        ) THEN
          ALTER TABLE bonus.race_participants ADD CONSTRAINT "fk_race_participants_user" 
            FOREIGN KEY ("userId") REFERENCES users.users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Create indexes for query optimization
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_races_status" ON bonus.races(status)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_referral_code" ON bonus.races("referralCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_sponsor_id" ON bonus.races("sponsorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_starts_at" ON bonus.races("startsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_ends_at" ON bonus.races("endsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_user_id" ON bonus.race_participants("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_place" ON bonus.race_participants(place)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_wagered" ON bonus.race_participants("totalWageredCents" DESC)`,
    );

    // Additional performance indexes from code review
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_weekly_active" ON bonus.races(status) WHERE "sponsorId" IS NULL AND "referralCode" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_races_sponsor_status" ON bonus.races("sponsorId", status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_race_participants_race_wager" ON bonus.race_participants("raceId", "totalWageredCents" DESC)`,
    );

    // Clear and populate weekly_race_prizes table with default prize structure (only if empty)
    const prizeCount = await queryRunner.query(`SELECT COUNT(*) FROM bonus.weekly_race_prizes`);
    if (parseInt(prizeCount[0].count) === 0) {
      // Insert 50 prize places for weekly race
      await queryRunner.query(`
      INSERT INTO bonus.weekly_race_prizes (place, "amountUsd", "createdAt", "updatedAt") VALUES
        (1, 20000, NOW(), NOW()),
        (2, 10000, NOW(), NOW()),
        (3, 5000, NOW(), NOW()),
        (4, 2000, NOW(), NOW()),
        (5, 1500, NOW(), NOW()),
        (6, 1000, NOW(), NOW()),
        (7, 900, NOW(), NOW()),
        (8, 800, NOW(), NOW()),
        (9, 700, NOW(), NOW()),
        (10, 600, NOW(), NOW()),
        (11, 500, NOW(), NOW()),
        (12, 500, NOW(), NOW()),
        (13, 500, NOW(), NOW()),
        (14, 500, NOW(), NOW()),
        (15, 400, NOW(), NOW()),
        (16, 400, NOW(), NOW()),
        (17, 400, NOW(), NOW()),
        (18, 400, NOW(), NOW()),
        (19, 300, NOW(), NOW()),
        (20, 300, NOW(), NOW()),
        (21, 300, NOW(), NOW()),
        (22, 300, NOW(), NOW()),
        (23, 200, NOW(), NOW()),
        (24, 200, NOW(), NOW()),
        (25, 200, NOW(), NOW()),
        (26, 200, NOW(), NOW()),
        (27, 100, NOW(), NOW()),
        (28, 100, NOW(), NOW()),
        (29, 100, NOW(), NOW()),
        (30, 100, NOW(), NOW()),
        (31, 100, NOW(), NOW()),
        (32, 100, NOW(), NOW()),
        (33, 100, NOW(), NOW()),
        (34, 100, NOW(), NOW()),
        (35, 100, NOW(), NOW()),
        (36, 100, NOW(), NOW()),
        (37, 100, NOW(), NOW()),
        (38, 100, NOW(), NOW()),
        (39, 100, NOW(), NOW()),
        (40, 100, NOW(), NOW()),
        (41, 50, NOW(), NOW()),
        (42, 50, NOW(), NOW()),
        (43, 50, NOW(), NOW()),
        (44, 50, NOW(), NOW()),
        (45, 50, NOW(), NOW()),
        (46, 50, NOW(), NOW()),
        (47, 50, NOW(), NOW()),
        (48, 50, NOW(), NOW()),
        (49, 50, NOW(), NOW()),
        (50, 50, NOW(), NOW())
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes (including additional performance indexes)
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_race_wager`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_sponsor_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_weekly_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_wagered`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_place`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_race_participants_user_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_ends_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_starts_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_sponsor_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_referral_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS bonus.idx_races_status`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS bonus.race_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS bonus.races CASCADE`);

    // Restore old weekly_races table structure (compatible with feature/2fa-critical-endpoints-protection branch)
    // This uses the simplified structure: name, endTime, prizePool
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS games.weekly_races (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        "endTime" TIMESTAMP NOT NULL,
        "prizePool" DECIMAL(20, 2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Move weekly_race_prizes back to games schema if it exists in bonus
    const prizeTableExists = await queryRunner.hasTable('bonus.weekly_race_prizes');
    if (prizeTableExists) {
      await queryRunner.query(`ALTER TABLE bonus.weekly_race_prizes SET SCHEMA games`);
    }
  }
}
