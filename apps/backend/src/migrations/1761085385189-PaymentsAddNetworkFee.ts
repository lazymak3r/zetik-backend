import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsAddNetworkFee1761085385189 implements MigrationInterface {
  name = 'PaymentsAddNetworkFee-1761085385189';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let hasColumn;

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_withdraw_requests_status" ON "payments"."withdraw_requests"("status")`,
    );
    hasColumn = await queryRunner.hasColumn('payments.withdraw_requests', 'estimateNetworkFee');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."withdraw_requests" ADD COLUMN "estimateNetworkFee" numeric(36,18) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('payments.transactions', 'amountUSD');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."transactions" ADD COLUMN "amountUSD" numeric(18,8) NULL`,
      );
    }
    hasColumn = await queryRunner.hasColumn('payments.transactions', 'networkFee');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "payments"."transactions" ADD COLUMN "networkFee" numeric(36,18) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."transactions" DROP COLUMN IF EXISTS "networkFee"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."transactions" DROP COLUMN IF EXISTS "amountUSD"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments"."withdraw_requests" DROP COLUMN IF EXISTS "estimateNetworkFee"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "payments"."IDX_withdraw_requests_status"`);
  }
}
