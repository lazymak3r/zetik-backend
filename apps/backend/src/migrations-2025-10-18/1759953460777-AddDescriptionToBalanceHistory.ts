import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToBalanceHistory1759953460777 implements MigrationInterface {
  name = 'AddDescriptionToBalanceHistory1759953460777';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE balance.balance_history ADD COLUMN IF NOT EXISTS description varchar(255) NULL`,
    );

    // Backfill existing NULL/empty descriptions to 'Other'
    await queryRunner.query(
      `UPDATE balance.balance_history SET description = 'Other' WHERE description IS NULL OR btrim(description) = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE balance.balance_history DROP COLUMN IF EXISTS description`,
    );
  }
}
