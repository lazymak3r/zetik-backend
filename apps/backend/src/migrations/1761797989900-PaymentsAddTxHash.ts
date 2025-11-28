import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsAddTxHash1761797989900 implements MigrationInterface {
  name = 'PaymentsAddTxHash-1761797989900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('payments.transactions', 'txHash');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."transactions" ADD COLUMN "txHash" character varying NULL`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_txHash" ON "payments"."transactions" ("txHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS  "payments"."IDX_transactions_txHash"`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."transactions" DROP COLUMN IF EXISTS "txHash"`,
    );
  }
}
