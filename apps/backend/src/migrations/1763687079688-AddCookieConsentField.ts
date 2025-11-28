import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCookieConsentField1763687079688 implements MigrationInterface {
  name = 'AddCookieConsentField1763687079688';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"."users" ADD "cookieConsentAcceptedAt" TIMESTAMP NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users"."users" DROP COLUMN "cookieConsentAcceptedAt"`);
  }
}
