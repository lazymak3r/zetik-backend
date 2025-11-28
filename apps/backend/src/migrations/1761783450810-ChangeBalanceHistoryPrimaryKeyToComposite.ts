import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeBalanceHistoryPrimaryKeyToComposite1761783450810 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing PRIMARY KEY constraint
    await queryRunner.query(
      `ALTER TABLE "balance"."balance_history" DROP CONSTRAINT "PK_189fd1735da367da79e1685aaa6"`,
    );

    // Add composite PRIMARY KEY (operationId, operation)
    await queryRunner.query(
      `ALTER TABLE "balance"."balance_history" ADD CONSTRAINT "PK_balance_history_operationId_operation" PRIMARY KEY ("operationId", "operation")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite PRIMARY KEY
    await queryRunner.query(
      `ALTER TABLE "balance"."balance_history" DROP CONSTRAINT "PK_balance_history_operationId_operation"`,
    );

    // Restore original PRIMARY KEY on operationId only
    await queryRunner.query(
      `ALTER TABLE "balance"."balance_history" ADD CONSTRAINT "PK_189fd1735da367da79e1685aaa6" PRIMARY KEY ("operationId")`,
    );
  }
}
