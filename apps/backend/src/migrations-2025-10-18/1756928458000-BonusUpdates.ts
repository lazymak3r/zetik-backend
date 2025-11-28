import { MigrationInterface, QueryRunner } from 'typeorm';

export class BonusUpdates1756928458000 implements MigrationInterface {
  name = 'BonusUpdates1756928458000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to bonuses_vip_tiers
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadProfitablePercentage" numeric(5,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" ADD "weeklyReloadLosingPercentage" numeric(5,2) NULL`,
    );

    // Reseed bonuses_vip_tiers with updated percentages
    await queryRunner.query(`TRUNCATE TABLE "bonus"."bonuses_vip_tiers" RESTART IDENTITY CASCADE`);
    await queryRunner.query(`
      INSERT INTO bonus.bonuses_vip_tiers (
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

    // Changes to bonuses_transactions
    await queryRunner.query(`ALTER TABLE "bonus"."bonuses_transactions" DROP COLUMN "expiresAt"`);
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ADD "activateAt" TIMESTAMP NULL`,
    );

    // Add houseEdge to balance_history and backfill
    await queryRunner.query(
      `ALTER TABLE "balance"."balance_history" ADD "houseEdge" numeric(5,2) NULL`,
    );
    await queryRunner.query(
      `UPDATE "balance"."balance_history" SET "houseEdge" = 1.00 WHERE "operation" = 'BET' AND "houseEdge" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert balance_history
    await queryRunner.query(`ALTER TABLE "balance"."balance_history" DROP COLUMN "houseEdge"`);

    // Revert bonuses_transactions
    await queryRunner.query(`ALTER TABLE "bonus"."bonuses_transactions" DROP COLUMN "activateAt"`);
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_transactions" ADD "expiresAt" TIMESTAMP NULL`,
    );

    // Revert bonuses_vip_tiers
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN "weeklyReloadLosingPercentage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonuses_vip_tiers" DROP COLUMN "weeklyReloadProfitablePercentage"`,
    );

    // Reseed to previous state
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
        (17, 'Sapphire I', '1500000000.00', '4.50', '7.50', '1200000.00', '6.50', true, 'user-level/sapphire-1', '35000.00'),
        (18, 'Sapphire II', '2000000000.00', '4.50', '7.50', '1500000.00', '6.50', true, 'user-level/sapphire-2', NULL),
        (19, 'Sapphire III', '2500000000.00', '5.00', '8.00', '2000000.00', '7.00', true, 'user-level/sapphire-3', NULL),
        (20, 'Ruby I', '3000000000.00', '5.00', '8.00', '2500000.00', '7.00', true, 'user-level/ruby-1', '42500.00'),
        (21, 'Ruby II', '4000000000.00', '5.00', '8.50', '3000000.00', '7.00', true, 'user-level/ruby-2', NULL),
        (22, 'Ruby III', '5000000000.00', '5.00', '8.50', '4000000.00', '7.00', true, 'user-level/ruby-3', NULL),
        (23, 'Diamond I', '7500000000.00', '5.00', '9.00', '5000000.00', '7.50', true, 'user-level/diamond-1', '50000.00'),
        (24, 'Diamond II', '10000000000.00', '5.00', '9.50', '7500000.00', '7.50', true, 'user-level/diamond-2', NULL),
        (25, 'Diamond III', '15000000000.00', '5.50', '10.00', '10000000.00', '7.50', true, 'user-level/diamond-3', NULL),
        (26, 'Zetik', '25000000000.00', '6.00', '10.00', '15000000.00', '8.00', true, 'user-level/zetik', '75000.00')
    `);
  }
}
