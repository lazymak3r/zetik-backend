import { MigrationInterface, QueryRunner } from 'typeorm';

export class Seed1755118038984 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // seed assets
    await queryRunner.query(`
      INSERT INTO payments.assets (symbol, status, "createdAt", "updatedAt") 
      VALUES 
        ('BTC', 'ACTIVE', NOW(), NOW()),
        ('LTC', 'ACTIVE', NOW(), NOW()),
        ('DOGE', 'ACTIVE', NOW(), NOW())
    `);

    // seed vip tiers
    await queryRunner.query(`
      INSERT INTO bonus.bonuses_vip_tiers (
        level, name, "wagerRequirement", "weeklyBonusPercentage", "monthlyBonusPercentage", 
        "dailyBonusPercentage", "levelUpBonusAmount", "rakebackPercentage", "isForVip", "imageUrl"
      )
      VALUES 
        (0, 'Unranked', '0.00', NULL, NULL, NULL, NULL, NULL, false, ''),
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

    // seed categories
    await queryRunner.query(`
      INSERT INTO games.provider_categories (name, type, "createdAt", "updatedAt")
      VALUES 
        ('Video Slots', 'rng', NOW(), NOW()),
        ('Crash Games', 'rng', NOW(), NOW())
    `);

    // seed developers
    await queryRunner.query(`
      INSERT INTO games.provider_developers (name, code, "restrictedTerritories", "prohibitedTerritories", "createdAt", "updatedAt")
      VALUES 
        ('Red Tiger', 'rtg', '{}', '{"GB","US"}', NOW(), NOW()),
        ('Pragmatic Play', 'pgp', '{}', '{"GB","US"}', NOW(), NOW())
    `);

    // seed games
    await queryRunner.query(`
      INSERT INTO games.provider_games (
        code, name, enabled, "developerName", "categoryName", "bonusTypes", themes, features, 
        rtp, volatility, "maxPayoutCoeff", "hitRatio", "funMode", "releaseDate", "deprecationDate",
        "restrictedTerritories", "prohibitedTerritories", "createdAt", "updatedAt"
      )
      VALUES 
        ('pgp_piggy_bankers', 'Piggy Bankers', false, 'Pragmatic Play', 'Video Slots', '{}', '{}', 
         '{"Respin","In-game Freespins","Bonus Buy"}', '96.05', '5.0', '10000', '26.9', true, 
         NULL, NULL, '{}', '{}', NOW(), NOW()),
        ('pgp_pub_kings', 'Pub Kings', false, 'Pragmatic Play', 'Video Slots', '{}', '{}', 
         '{"Bonus Buy","In-game Freespins"}', '96.08', '5.0', '5000', '22.9', true, 
         NULL, NULL, '{}', '{}', NOW(), NOW())
    `);

    // seed language chats
    await queryRunner.query(`
      INSERT INTO chat.chats (name, language, "createdAt", "updatedAt")
      VALUES 
        ('English', 'en', NOW(), NOW()),
        ('Spanish', 'es', NOW(), NOW()),
        ('Portuguese', 'pt', NOW(), NOW()),
        ('German', 'de', NOW(), NOW()),
        ('French', 'fr', NOW(), NOW()),
        ('Russian', 'ru', NOW(), NOW()),
        ('Japanese', 'ja', NOW(), NOW()),
        ('Chinese', 'zh', NOW(), NOW())
    `);

    await queryRunner.query(`
      INSERT INTO games.house_edge (game, edge)
      VALUES
        ('plinko', 1.00),
        ('dice', 1.00),
        ('crash', 1.00),
        ('limbo', 1.00),
        ('mines', 1.00)
    `);
  }

  public async down(): Promise<void> {}
}
