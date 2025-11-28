import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSplitAcesToBlackjackGame1762767790965 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            ADD COLUMN "isSplitAces" boolean NOT NULL DEFAULT false
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "games"."blackjack_games"
            DROP COLUMN "isSplitAces"
        `);
  }
}
