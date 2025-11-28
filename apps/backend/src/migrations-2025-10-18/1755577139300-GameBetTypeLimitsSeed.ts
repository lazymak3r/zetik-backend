import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameBetTypeLimitsSeed1755577139300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO games.game_bet_type_limits ("gameType", "betTypeCategory", "description", "minBetUsd", "maxBetUsd", "isActive", "createdBy", "createdAt", "updatedAt")
      VALUES 
        -- Roulette bet type limits
        ('roulette', 'roulette_inside', 'Inside bets: straight, split, street, corner, line', 0.1, 500, true, 'system', NOW(), NOW()),
        ('roulette', 'roulette_outside', 'Outside bets: red/black, odd/even, dozens, columns', 0.5, 2000, true, 'system', NOW(), NOW()),
        
        -- Blackjack bet type limits  
        ('blackjack', 'blackjack_main', 'Main blackjack bet', 0.1, 1000, true, 'system', NOW(), NOW()),
        ('blackjack', 'blackjack_insurance', 'Insurance side bet (max 50% of main bet)', 0.05, 500, true, 'system', NOW(), NOW()),
        ('blackjack', 'blackjack_split', 'Split additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW()),
        ('blackjack', 'blackjack_double', 'Double down additional bet (must match main bet)', 0.1, 1000, true, 'system', NOW(), NOW())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded bet type limits
    await queryRunner.query(`DELETE FROM games.game_bet_type_limits WHERE "createdBy" = 'system'`);
  }
}
