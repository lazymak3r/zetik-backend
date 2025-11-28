import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeeklyReloadMinToVipTiers17570175131392 implements MigrationInterface {
  name = 'AddWeeklyReloadMinToVipTiers17570175131392';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add configurable daily minimum (in cents) for weekly reload
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadDailyMinCents" numeric(10,2) NULL`,
    );

    // Reseed: replace BonusUpdates seed with extended seed that includes weeklyReloadDailyMinCents
    await queryRunner.query(`TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`);
    await queryRunner.query(`
      INSERT INTO "bonus"."bonuses_vip_tiers" (
        level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
        "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount",
        "weeklyReloadProfitablePercentage", "weeklyReloadLosingPercentage", "weeklyReloadDailyMinCents"
      )
      VALUES 
        (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL, NULL, NULL, NULL),
        (1, 'Bronze I', '250000.00', '5.00', '0.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00', '5.00', '10.00', NULL),
        (2, 'Bronze II', '500000.00', '5.00', '0.00', '5000.00', '3.00', false, 'user-level/bronze-2', NULL, '5.00', '10.00', NULL),
        (3, 'Bronze III', '1000000.00', '5.00', '0.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL, '5.00', '10.00', NULL),
        (4, 'Bronze IV', '1500000.00', '5.00', '0.00', '15000.00', '3.50', false, 'user-level/bronze-4', NULL, '5.00', '10.00', NULL),
        (5, 'Silver I', '2500000.00', '5.00', '0.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00', '5.00', '10.00', NULL),
        (6, 'Silver II', '5000000.00', '5.00', '0.00', '40000.00', '4.00', false, 'user-level/silver-2', NULL, '5.00', '10.00', NULL),
        (7, 'Silver III', '10000000.00', '5.00', '0.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL, '5.00', '10.00', NULL),
        (8, 'Silver IV', '15000000.00', '5.00', '0.00', '80000.00', '4.50', false, 'user-level/silver-4', NULL, '5.00', '10.00', NULL),
        (9, 'Gold I', '25000000.00', '5.00', '7.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00', '5.00', '10.00', NULL),
        (10, 'Gold II', '50000000.00', '5.00', '7.00', '150000.00', '5.00', false, 'user-level/gold-2', NULL, '5.00', '10.00', NULL),
        (11, 'Gold III', '75000000.00', '5.00', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL, '5.00', '10.00', NULL),
        (12, 'Gold IV', '100000000.00', '5.00', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL, '5.00', '10.00', NULL),
        (13, 'Platinum I', '250000000.00', '5.00', '8.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00', '5.00', '10.00', '500.00'),
        (14, 'Platinum II', '500000000.00', '5.00', '8.00', '600000.00', '6.00', true, 'user-level/platinum-2', NULL, '5.00', '10.00', '750.00'),
        (15, 'Platinum III', '750000000.00', '5.00', '8.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL, '5.00', '10.00', '1000.00'),
        (16, 'Platinum IV', '1000000000.00', '5.00', '8.00', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL, '5.00', '10.00', '1250.00'),
        (17, 'Sapphire I', '1500000000.00', '5.00', '9.00', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00', '5.00', '10.00', '1500.00'),
        (18, 'Sapphire II', '2000000000.00', '5.00', '9.00', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL, '5.00', '10.00', '1750.00'),
        (19, 'Sapphire III', '2500000000.00', '5.00', '9.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL, '5.00', '10.00', '2000.00'),
        (20, 'Ruby I', '3000000000.00', '5.00', '10.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00', '5.00', '10.00', '2250.00'),
        (21, 'Ruby II', '4000000000.00', '5.00', '10.00', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL, '5.00', '10.00', '2500.00'),
        (22, 'Ruby III', '5000000000.00', '5.00', '10.00', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL, '5.00', '10.00', '2750.00'),
        (23, 'Diamond I', '7500000000.00', '5.00', '11.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00', '5.00', '10.00', '3000.00'),
        (24, 'Diamond II', '10000000000.00', '5.00', '11.00', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL, '5.00', '10.00', '3250.00'),
        (25, 'Diamond III', '15000000000.00', '5.00', '11.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL, '5.00', '10.00', '3500.00'),
        (26, 'Zetik', '25000000000.00', '5.00', '12.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00', '5.00', '10.00', '3750.00')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to BonusUpdates seed and drop the column
    await queryRunner.query(`TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`);
    await queryRunner.query(`
      INSERT INTO "bonus"."bonuses_vip_tiers" (
        level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage",
        "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl", "rankUpBonusAmount",
        "weeklyReloadProfitablePercentage", "weeklyReloadLosingPercentage"
      )
      VALUES 
        (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, false, '', NULL, NULL, NULL),
        (1, 'Bronze I', '250000.00', '5.00', '0.00', '2500.00', '3.00', false, 'user-level/bronze-1', '2500.00', '5.00', '10.00'),
        (2, 'Bronze II', '500000.00', '5.00', '0.00', '5000.00', '3.00', false, 'user-level/bronze-2', NULL, '5.00', '10.00'),
        (3, 'Bronze III', '1000000.00', '5.00', '0.00', '10000.00', '3.50', false, 'user-level/bronze-3', NULL, '5.00', '10.00'),
        (4, 'Bronze IV', '1500000.00', '5.00', '0.00', '15000.00', '3.50', false, 'user-level/bronze-4', NULL, '5.00', '10.00'),
        (5, 'Silver I', '2500000.00', '5.00', '0.00', '25000.00', '4.00', false, 'user-level/silver-1', '5000.00', '5.00', '10.00'),
        (6, 'Silver II', '5000000.00', '5.00', '0.00', '40000.00', '4.00', false, 'user-level/silver-2', NULL, '5.00', '10.00'),
        (7, 'Silver III', '10000000.00', '5.00', '0.00', '60000.00', '4.50', false, 'user-level/silver-3', NULL, '5.00', '10.00'),
        (8, 'Silver IV', '15000000.00', '5.00', '0.00', '80000.00', '4.50', false, 'user-level/silver-4', NULL, '5.00', '10.00'),
        (9, 'Gold I', '25000000.00', '5.00', '7.00', '100000.00', '5.00', false, 'user-level/gold-1', '10000.00', '5.00', '10.00'),
        (10, 'Gold II', '50000000.00', '5.00', '7.00', '150000.00', '5.00', false, 'user-level/gold-2', NULL, '5.00', '10.00'),
        (11, 'Gold III', '75000000.00', '5.00', '7.00', '200000.00', '5.50', false, 'user-level/gold-3', NULL, '5.00', '10.00'),
        (12, 'Gold IV', '100000000.00', '5.00', '7.00', '300000.00', '5.50', false, 'user-level/gold-4', NULL, '5.00', '10.00'),
        (13, 'Platinum I', '250000000.00', '5.00', '8.00', '400000.00', '6.00', true, 'user-level/platinum-1', '25000.00', '5.00', '10.00'),
        (14, 'Platinum II', '500000000.00', '5.00', '8.00', '600000.00', '6.00', true, 'user-level/platinum-2', NULL, '5.00', '10.00'),
        (15, 'Platinum III', '750000000.00', '5.00', '8.00', '800000.00', '6.50', true, 'user-level/platinum-3', NULL, '5.00', '10.00'),
        (16, 'Platinum IV', '1000000000.00', '5.00', '8.00', '1000000.00', '6.50', true, 'user-level/platinum-4', NULL, '5.00', '10.00'),
        (17, 'Sapphire I', '1500000000.00', '5.00', '9.00', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00', '5.00', '10.00'),
        (18, 'Sapphire II', '2000000000.00', '5.00', '9.00', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL, '5.00', '10.00'),
        (19, 'Sapphire III', '2500000000.00', '5.00', '9.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL, '5.00', '10.00'),
        (20, 'Ruby I', '3000000000.00', '5.00', '10.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00', '5.00', '10.00'),
        (21, 'Ruby II', '4000000000.00', '5.00', '10.00', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL, '5.00', '10.00'),
        (22, 'Ruby III', '5000000000.00', '5.00', '10.00', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL, '5.00', '10.00'),
        (23, 'Diamond I', '7500000000.00', '5.00', '11.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00', '5.00', '10.00'),
        (24, 'Diamond II', '10000000000.00', '5.00', '11.00', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL, '5.00', '10.00'),
        (25, 'Diamond III', '15000000000.00', '5.00', '11.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL, '5.00', '10.00'),
        (26, 'Zetik', '25000000000.00', '5.00', '12.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00', '5.00', '10.00')
    `);

    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN "weeklyReloadDailyMinCents"`,
    );
  }
}
