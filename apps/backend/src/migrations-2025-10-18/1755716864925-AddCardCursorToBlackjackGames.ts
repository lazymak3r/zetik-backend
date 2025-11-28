import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardCursorToBlackjackGames1755716864925 implements MigrationInterface {
  name = 'AddCardCursorToBlackjackGames1755716864925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" RENAME COLUMN "deck" TO "cardCursor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
    );
    await queryRunner.query(`ALTER TABLE "games"."blackjack_games" DROP COLUMN "cardCursor"`);
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ADD "cardCursor" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT 0.0000`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT 1.00000000`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 0.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(`ALTER TABLE "games"."blackjack_games" DROP COLUMN "cardCursor"`);
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ADD "cardCursor" jsonb NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" RENAME COLUMN "cardCursor" TO "deck"`,
    );
  }
}
