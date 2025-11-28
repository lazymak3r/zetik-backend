import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVaultIdPaymentsWallets1759303838389 implements MigrationInterface {
  name = 'AddVaultIdPaymentsWallets1759303838389';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('payments.wallets', 'vaultId');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."wallets" ADD COLUMN "vaultId" character varying`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallets_vault_id" ON "payments"."wallets" ("vaultId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "payments"."IDX_wallets_vault_id"`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."wallets" DROP COLUMN IF EXISTS "vaultId"`,
    );
  }
}
