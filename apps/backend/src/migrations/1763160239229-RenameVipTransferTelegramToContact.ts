import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameVipTransferTelegramToContact1763160239229 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename telegramUsername column to contactUsername
    await queryRunner.query(`
      ALTER TABLE "bonus"."bonuses_vip_transfer_submissions"
      RENAME COLUMN "telegramUsername" TO "contactUsername";
    `);
  }

  public async down(): Promise<void> {}
}
