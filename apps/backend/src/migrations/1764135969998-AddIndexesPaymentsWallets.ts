import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesPaymentsWallets1764135969998 implements MigrationInterface {
  name = 'AddIndexesPaymentsWallets-1764135969998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE INDEX IF NOT EXISTS "IDX_transactions_userId" ON payments.transactions("userId");
        CREATE INDEX IF NOT EXISTS "IDX_transactions_userId_type" ON payments.transactions("userId", type);
        CREATE INDEX IF NOT EXISTS "IDX_wallets_asset" ON payments.wallets (asset);
        CREATE INDEX IF NOT EXISTS "IDX_wallets_addresses_GIN" ON payments.wallets USING GIN (addresses);
        CREATE INDEX IF NOT EXISTS "IDX_wallets_vaultId" ON payments.wallets ("vaultId");
        
        -- Create separate expression indexes for USDC/USDT specific queries
        CREATE INDEX IF NOT EXISTS "IDX_wallets_USDC_ETH" ON payments.wallets ((addresses ->> 'USDC_ETH')) WHERE asset = 'USDC';
        CREATE INDEX IF NOT EXISTS "IDX_wallets_USDC_BSC" ON payments.wallets ((addresses ->> 'USDC_BSC')) WHERE asset = 'USDC';
        CREATE INDEX IF NOT EXISTS "IDX_wallets_USDT_BSC" ON payments.wallets ((addresses ->> 'USDT_BSC')) WHERE asset = 'USDT';
        
        -- Composite index for asset + specific address keys
        CREATE INDEX IF NOT EXISTS "IDX_wallets_asset_USDC_keys" ON payments.wallets 
          (asset, (addresses ->> 'USDC_ETH'), (addresses ->> 'USDC_BSC'))
          WHERE asset = 'USDC';
          
        CREATE INDEX IF NOT EXISTS "IDX_wallets_asset_USDT_keys" ON payments.wallets 
          (asset, (addresses ->> 'USDT_BSC'))
          WHERE asset = 'USDT';
      EXCEPTION
        WHEN undefined_table THEN null;
        WHEN undefined_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_asset_USDT_keys"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_asset_USDC_keys"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_USDT_BSC"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_USDC_BSC"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_USDC_ETH"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_vaultId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_addresses_GIN"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_wallets_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_transactions_userId_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS payments."IDX_transactions_userId"`);
  }
}
