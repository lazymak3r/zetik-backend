import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkAdminsAndUsersByEmail1763463933868 implements MigrationInterface {
  name = 'LinkAdminsAndUsersByEmail1763463933868';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        admin_record RECORD;
        user_record RECORD;
        linked_count INTEGER := 0;
      BEGIN
        FOR admin_record IN 
          SELECT id, email, "userId"
          FROM admin.admin_users
          WHERE "userId" IS NULL
        LOOP
          SELECT id, email, username
          INTO user_record
          FROM users.users
          WHERE email = admin_record.email
          LIMIT 1;

          IF user_record IS NOT NULL THEN
            UPDATE admin.admin_users
            SET "userId" = user_record.id,
                "updatedAt" = NOW()
            WHERE id = admin_record.id;
            
            linked_count := linked_count + 1;
            
            RAISE NOTICE 'Linked admin % (email: %) with user % (username: %)', 
              admin_record.id, 
              admin_record.email, 
              user_record.id, 
              user_record.username;
          END IF;
        END LOOP;

        RAISE NOTICE 'Migration completed. Linked % admin(s) with user(s) by email.', linked_count;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE admin.admin_users
      SET "userId" = NULL,
          "updatedAt" = NOW()
      WHERE "userId" IS NOT NULL
        AND email IN (
          SELECT email 
          FROM users.users 
          WHERE email IS NOT NULL
        );
    `);
  }
}
