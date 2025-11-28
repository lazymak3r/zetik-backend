import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderToCurrencyRateHistory1763915688989 implements MigrationInterface {
  name = 'AddProviderToCurrencyRateHistory-1763915688989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('balance.currency_rate_history');
    if (hasTable) {
      const hasColumn = await queryRunner.hasColumn('balance.currency_rate_history', 'provider');
      if (!hasColumn) {
        await queryRunner.query(
          `ALTER TABLE balance.currency_rate_history ADD COLUMN provider VARCHAR(20) NULL`,
        );
        await queryRunner.query(
          `UPDATE balance.currency_rate_history SET provider = 'CoinGecko' WHERE provider IS NULL`,
        );
        await queryRunner.query(
          `ALTER TABLE balance.currency_rate_history ALTER COLUMN provider SET NOT NULL`,
        );
        await queryRunner.query(
          `ALTER TABLE balance.currency_rate_history ALTER COLUMN provider SET DEFAULT 'CoinGecko'`,
        );
        await queryRunner.query(`
          DO $$ BEGIN
            ALTER TABLE balance.currency_rate_history ADD CONSTRAINT "CHK_currency_rate_provider" 
            CHECK (provider IN ('CoinGecko', 'Binance', 'Coinbase', 'Kraken'));
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS balance.currency_rate_history DROP CONSTRAINT IF EXISTS "CHK_currency_rate_provider"`,
    );
    const hasColumn = await queryRunner.hasColumn('balance.currency_rate_history', 'provider');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS balance.currency_rate_history ALTER COLUMN provider DROP DEFAULT`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE IF EXISTS balance.currency_rate_history DROP COLUMN IF EXISTS provider`,
    );
  }
}
