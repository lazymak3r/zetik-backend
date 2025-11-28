import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxPayoutToGameBetLimits1756363254387 implements MigrationInterface {
  name = 'AddMaxPayoutToGameBetLimits1756363254387';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."game_bet_limits" ADD "maxPayoutUsd" numeric(15,2) NOT NULL DEFAULT '100000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_games" ALTER COLUMN "crashPoint" TYPE numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "cashOutAt" TYPE numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "autoCashOutAt" TYPE numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."game_results" ALTER COLUMN "outcomeValue" TYPE numeric(12,2)`,
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
      `ALTER TABLE "games"."game_results" ALTER COLUMN "outcomeValue" TYPE numeric(10,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "autoCashOutAt" TYPE numeric(10,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_bets" ALTER COLUMN "cashOutAt" TYPE numeric(10,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."crash_games" ALTER COLUMN "crashPoint" TYPE numeric(10,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT 2.00`,
    );
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
    );
    await queryRunner.query(`ALTER TABLE "games"."game_bet_limits" DROP COLUMN "maxPayoutUsd"`);
  }
}
