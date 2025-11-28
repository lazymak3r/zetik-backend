import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTipSupportToChatMessages1759380000001 implements MigrationInterface {
  name = 'AddTipSupportToChatMessages1759380000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for message types
    await queryRunner.query(`
      CREATE TYPE "chat"."messages_messagetype_enum" AS ENUM('MESSAGE', 'SERVER_NOTIFICATION_TIP')
    `);

    // Add messageType column with default value
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      ADD COLUMN "messageType" "chat"."messages_messagetype_enum" NOT NULL DEFAULT 'MESSAGE'
    `);

    // Make message column nullable (TIP messages don't have text message)
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      ALTER COLUMN "message" DROP NOT NULL
    `);

    // Add metadata column for storing TIP data (recipientId, asset, amount)
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      ADD COLUMN "metadata" jsonb
    `);

    // Add column comments for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."messageType" IS 'Type of message: MESSAGE or SERVER_NOTIFICATION_TIP'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."message" IS 'Text message content (nullable for TIP messages)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."metadata" IS 'Additional message data (recipientId, asset, amount for TIP; extensible for future message types)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove column comments
    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."metadata" IS NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."message" IS NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "chat"."messages"."messageType" IS NULL
    `);

    // Remove metadata column
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      DROP COLUMN "metadata"
    `);

    // Delete TIP messages (they have NULL message field and cannot exist after rollback)
    await queryRunner.query(`
      DELETE FROM "chat"."messages" 
      WHERE "messageType" = 'SERVER_NOTIFICATION_TIP'
    `);

    // Restore message column NOT NULL constraint
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      ALTER COLUMN "message" SET NOT NULL
    `);

    // Remove messageType column
    await queryRunner.query(`
      ALTER TABLE "chat"."messages" 
      DROP COLUMN "messageType"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE "chat"."messages_messagetype_enum"
    `);
  }
}
