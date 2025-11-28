import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserRecentGamesTable1763429037010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_recent_games table for "Continue Playing" functionality
    // Simple JSONB storage: one record per user with array of recent games
    await queryRunner.query(`
      CREATE TABLE games.user_recent_games (
        "userId" UUID PRIMARY KEY,
        games JSONB NOT NULL DEFAULT '[]'::jsonb,
        FOREIGN KEY ("userId") REFERENCES users.users(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS games.user_recent_games;');
  }
}
