import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeClientSeedNullableInGameSession1755935098618 implements MigrationInterface {
  name = 'MakeClientSeedNullableInGameSession1755935098618';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "games"."game_sessions" ALTER COLUMN "clientSeed" DROP NOT NULL`,
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
      `ALTER TABLE "games"."game_sessions" ALTER COLUMN "clientSeed" SET NOT NULL`,
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
  }
}
