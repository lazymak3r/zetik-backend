import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1757497300000 implements MigrationInterface {
  name = 'CreateNotificationsTable1757497300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users"."notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
                "userId" uuid NOT NULL, 
                "type" character varying(100) NOT NULL, 
                "title" character varying(255) NOT NULL, 
                "message" text NOT NULL, 
                "data" jsonb, 
                "isRead" boolean NOT NULL DEFAULT false, 
                "isDeleted" boolean NOT NULL DEFAULT false, 
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "readAt" TIMESTAMP, 
                "deletedAt" TIMESTAMP, 
                CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
            ); 
            
            COMMENT ON COLUMN "users"."notifications"."userId" IS 'User ID who should receive the notification'; 
            COMMENT ON COLUMN "users"."notifications"."type" IS 'Type of notification (deposit, withdrawal, etc.)'; 
            COMMENT ON COLUMN "users"."notifications"."title" IS 'Notification title'; 
            COMMENT ON COLUMN "users"."notifications"."message" IS 'Notification message'; 
            COMMENT ON COLUMN "users"."notifications"."data" IS 'Additional notification data'; 
            COMMENT ON COLUMN "users"."notifications"."isRead" IS 'Whether the notification has been read by the user'; 
            COMMENT ON COLUMN "users"."notifications"."isDeleted" IS 'Whether the notification has been deleted by the user';
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"."notifications"`);
  }
}
