import { MigrationInterface, QueryRunner } from 'typeorm';

export class BonusVipTierRemoveDailyAddRankUp1755620000000 implements MigrationInterface {
  name = 'BonusVipTierRemoveDailyAddRankUp1755620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Schema changes (deterministic, no branching)
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN "dailyBonusPercentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "rankUpBonusAmount" numeric(10,2) NULL`,
    );

    // Reseed bonuses_vip_tiers with updated columns (drop daily, add rankUp)
    await queryRunner.query(`TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`);
    await queryRunner.query(`
      INSERT INTO bonus.bonuses_vip_tiers (
        level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
        "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount"
      )
      VALUES 
        (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL),
        (1, 'Bronze I', '250000.00', '1.00', '2.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00'),
        (2, 'Bronze II', '500000.00', '1.00', '2.50', '5000.00', '3.00', false, 'user-level/bronze-2', NULL),
        (3, 'Bronze III', '1000000.00', '1.50', '3.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL),
        (4, 'Bronze IV', '1500000.00', '1.50', '3.50', '15000.00', '3.50', false, 'user-level/bronze-4', NULL),
        (5, 'Silver I', '2500000.00', '2.00', '4.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00'),
        (6, 'Silver II', '5000000.00', '2.00', '4.50', '40000.00', '4.00', false, 'user-level/silver-2', NULL),
        (7, 'Silver III', '10000000.00', '2.50', '5.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL),
        (8, 'Silver IV', '15000000.00', '2.50', '5.50', '80000.00', '4.50', false, 'user-level/silver-4', NULL),
        (9, 'Gold I', '25000000.00', '3.00', '6.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00'),
        (10, 'Gold II', '50000000.00', '3.00', '6.50', '150000.00', '5.00', false, 'user-level/gold-2', NULL),
        (11, 'Gold III', '75000000.00', '3.50', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL),
        (12, 'Gold IV', '100000000.00', '3.50', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL),
        (13, 'Platinum I', '250000000.00', '4.00', '6.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00'),
        (14, 'Platinum II', '500000000.00', '4.00', '6.50', '600000.00', '6.00', true, 'user-level/platinum-2', NULL),
        (15, 'Platinum III', '750000000.00', '4.50', '7.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL),
        (16, 'Platinum IV', '1000000000.00', '4.50', '7.50', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL),
        (17, 'Sapphire I', '1500000000.00', '4.50', '7.50', '1200000.00', '6.50', true, 'user-level/sapphire-1', NULL),
        (18, 'Sapphire II', '2000000000.00', '4.50', '7.50', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL),
        (19, 'Sapphire III', '2500000000.00', '5.00', '8.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL),
        (20, 'Ruby I', '3000000000.00', '5.00', '8.00', '2500000.00', '7.00', true, 'user-level/ruby-1', NULL),
        (21, 'Ruby II', '4000000000.00', '5.00', '8.50', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL),
        (22, 'Ruby III', '5000000000.00', '5.00', '8.50', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL),
        (23, 'Diamond I', '7500000000.00', '5.00', '9.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00'),
        (24, 'Diamond II', '10000000000.00', '5.00', '9.50', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL), 
        (25, 'Diamond III', '15000000000.00', '5.50', '10.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL),
        (26, 'Zetik', '25000000000.00', '6.00', '10.00', '15000000.00', '8.00', true, 'user-level/zetik', NULL)
    `);

    // --- Bonuses transactions timestamp fixes ---
    // 1) Add explicit updatedAt (audit) and expiredAt (semantic expiration time)
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ADD "expiredAt" TIMESTAMP NULL`,
    );

    // 2) Ensure claimedAt is a plain nullable timestamp without default (not auto-updated)
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" DROP DEFAULT`,
    );

    // 3) Backfill: move EXPIRED rows' claimedAt to expiredAt, then clear claimedAt unless actually claimed
    await queryRunner.query(
      `UPDATE "bonus"."bonuses_transactions" SET "expiredAt" = "claimedAt" WHERE status = 'EXPIRED' AND "claimedAt" IS NOT NULL AND "expiredAt" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "bonus"."bonuses_transactions" SET "claimedAt" = NULL WHERE status <> 'CLAIMED' AND "claimedAt" IS NOT NULL`,
    );

    // --- Periodic bonus uniqueness & metadata index ---
    await queryRunner.query(
      `CREATE UNIQUE INDEX "bonuses_transactions_unique_period_idx" ON "bonus"."bonuses_transactions" ("userId", "bonusType", ((metadata->>'periodKey'))) WHERE "bonusType" IN ('RAKEBACK','WEEKLY_AWARD','MONTHLY_AWARD')`,
    );
    await queryRunner.query(
      `CREATE INDEX "bonuses_transactions_metadata_gin_idx" ON "bonus"."bonuses_transactions" USING GIN ("metadata" jsonb_path_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert schema (deterministic)
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN "rankUpBonusAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "dailyBonusPercentage" numeric(5,2) NULL`,
    );

    // Restore original seed (with dailyBonusPercentage)
    await queryRunner.query(`TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`);
    await queryRunner.query(`
      INSERT INTO bonus.bonuses_vip_tiers (
        level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
        "dailyBonusPercentage", "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl"
      )
      VALUES 
        (0, 'Visitor', '0.00', NULL, NULL, NULL, NULL, NULL, false, ''),
        (1, 'Bronze I', '1000000.00', '0.50', '1.50', NULL, '2500.00', '5.00', false, 'user-level/bronze-1'),
        (2, 'Bronze II', '5000000.00', '1.00', '3.00', NULL, '5000.00', '5.00', false, 'user-level/bronze-2'),
        (3, 'Bronze III', '10000000.00', '2.00', '5.00', '0.10', '10000.00', '5.00', false, 'user-level/bronze-3'),
        (4, 'Bronze IV', '25000000.00', '3.00', '8.00', '0.15', '25000.00', '6.00', false, 'user-level/bronze-4'),
        (5, 'Silver I', '50000000.00', '4.00', '10.00', '0.20', '50000.00', '7.00', false, 'user-level/silver-1'),
        (6, 'Silver II', '100000000.00', '5.00', '12.00', '0.25', '100000.00', '8.00', false, 'user-level/silver-2'),
        (7, 'Silver III', '200000000.00', '6.00', '15.00', '0.30', '200000.00', '9.00', false, 'user-level/silver-3'),
        (8, 'Silver IV', '400000000.00', '7.00', '18.00', '0.35', '400000.00', '10.00', false, 'user-level/silver-4'),
        (9, 'Gold I', '800000000.00', '8.00', '20.00', '0.40', '800000.00', '11.00', false, 'user-level/gold-1'),
        (10, 'Gold II', '1600000000.00', '9.00', '22.00', '0.45', '1600000.00', '12.00', false, 'user-level/gold-2'),
        (11, 'Gold III', '3200000000.00', '10.00', '25.00', '0.50', '3200000.00', '13.00', false, 'user-level/gold-3'),
        (12, 'Gold IV', '6400000000.00', '11.00', '28.00', '0.55', '6400000.00', '14.00', false, 'user-level/gold-4'),
        (13, 'Platinum I', '12800000000.00', '12.00', '30.00', '0.60', '12800000.00', '15.00', true, 'user-level/platinum-1'),
        (14, 'Platinum II', '25600000000.00', '13.00', '32.00', '0.65', '25600000.00', '16.00', true, 'user-level/platinum-2'),
        (15, 'Platinum III', '51200000000.00', '14.00', '35.00', '0.70', '51200000.00', '17.00', true, 'user-level/platinum-3'),
        (16, 'Platinum IV', '102400000000.00', '15.00', '38.00', '0.75', '99999999.99', '18.00', true, 'user-level/platinum-4'),
        (17, 'Sapphire I', '204800000000.00', '16.00', '40.00', '0.80', '99999999.99', '19.00', true, 'user-level/sapphire-1'),
        (18, 'Sapphire II', '409600000000.00', '17.00', '42.00', '0.85', '99999999.99', '20.00', true, 'user-level/sapphire-2'),
        (19, 'Sapphire III', '819200000000.00', '18.00', '45.00', '0.90', '99999999.99', '21.00', true, 'user-level/sapphire-3'),
        (20, 'Ruby I', '1638400000000.00', '19.00', '48.00', '0.95', '99999999.99', '22.00', true, 'user-level/ruby-1'),
        (21, 'Ruby II', '3276800000000.00', '20.00', '50.00', '1.00', '99999999.99', '23.00', true, 'user-level/ruby-2'),
        (22, 'Ruby III', '6553600000000.00', '21.00', '52.00', '1.05', '99999999.99', '24.00', true, 'user-level/ruby-3'),
        (23, 'Diamond I', '13107200000000.00', '22.00', '55.00', '1.10', '99999999.99', '25.00', true, 'user-level/diamond-1'),
        (24, 'Diamond II', '26214400000000.00', '23.00', '58.00', '1.15', '99999999.99', '26.00', true, 'user-level/diamond-2'),
        (25, 'Diamond III', '52428800000000.00', '24.00', '60.00', '1.20', '99999999.99', '27.00', true, 'user-level/diamond-3'),
        (26, 'Zetik', '104857600000000.00', '25.00', '65.00', '1.25', '99999999.99', '30.00', true, 'user-level/zetik')
    `);

    // --- Revert bonuses_transactions timestamp changes ---
    await queryRunner.query(`DROP INDEX IF EXISTS "bonuses_transactions_metadata_gin_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "bonuses_transactions_unique_period_idx"`);
    await queryRunner.query(`ALTER TABLE "bonus"."bonuses_transactions" DROP COLUMN "expiredAt"`);
    await queryRunner.query(`ALTER TABLE "bonus"."bonuses_transactions" DROP COLUMN "updatedAt"`);
    // Restore previous semantics approximation: default now() on claimedAt
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ALTER COLUMN "claimedAt" SET DEFAULT now()`,
    );
  }
}
