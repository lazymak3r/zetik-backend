import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameSettingsToSystemSettings1755924008671 implements MigrationInterface {
  name = 'AddGameSettingsToSystemSettings1755924008671';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "balance"."IDX_vault_history_user_asset_created"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_vaults_user_asset"`);
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
      `ALTER TABLE "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18f52fb98025fa82a59de458ec" ON "balance"."vault_history" ("userId", "asset", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8478e22bfdd4d4f2ba84f21e1e" ON "balance"."vaults" ("userId", "asset") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "balance"."IDX_8478e22bfdd4d4f2ba84f21e1e"`);
    await queryRunner.query(`DROP INDEX "balance"."IDX_18f52fb98025fa82a59de458ec"`);
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
    await queryRunner.query(
      `ALTER TABLE "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT 0.00000000`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_vaults_user_asset" ON "balance"."vaults" ("asset", "userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vault_history_user_asset_created" ON "balance"."vault_history" ("asset", "createdAt", "userId") `,
    );
  }
}
