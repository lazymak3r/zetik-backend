import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminInit1755100112235 implements MigrationInterface {
  name = '2-AdminInit-1755100112235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let hasColumn;
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "admin"');
    await queryRunner.query(`
      DO $$ 
      BEGIN
        CREATE TYPE "admin"."admin_audit_logs_action_enum" AS ENUM('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'VIEW_AFFILIATE_CAMPAIGNS', 'VIEW_AFFILIATE_CAMPAIGN_DETAILS');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin"."admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "adminId" uuid NOT NULL,
        "adminEmail" character varying NOT NULL,
        "action" "admin"."admin_audit_logs_action_enum" NOT NULL,
        "resource" character varying NOT NULL,
        "resourceId" character varying,
        "details" jsonb,
        "previousValues" jsonb,
        "newValues" jsonb,
        "ipAddress" character varying NOT NULL,
        "userAgent" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_de7a8fc2fbb525484c71a86bb96" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin"."admin_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'admin',
        "isActive" boolean NOT NULL DEFAULT true,
        "tokenVersion" integer NOT NULL DEFAULT '1',
        "permissions" jsonb, "lastLoginAt" TIMESTAMP,
        "lastLoginIp" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_dcd0c8a4b10af9c986e510b9ecc" UNIQUE ("email"),
        CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin"."api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "key" character varying NOT NULL,
        "permissions" text array NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastUsedAt" TIMESTAMP,
        "createdBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_e42cf55faeafdcce01a82d24849" UNIQUE ("key"),
        CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin"."system_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "value" jsonb NOT NULL,
        "description" character varying,
        "category" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'string',
        "isSecret" boolean NOT NULL DEFAULT false,
        "updatedBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_b1b5bc664526d375c94ce9ad43d" UNIQUE ("key"),
        CONSTRAINT "PK_82521f08790d248b2a80cc85d40" PRIMARY KEY ("id")
      )
    `);
    hasColumn = await queryRunner.hasColumn('bonus.bonus_calculation_logs', 'totalBonusAmount');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "bonus"."bonus_calculation_logs" ALTER COLUMN "totalBonusAmount" SET DEFAULT '0.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.blackjack_games', 'splitPayoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."blackjack_games" ALTER COLUMN "splitPayoutMultiplier" SET DEFAULT '2.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.keno_games', 'payoutMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."keno_games" ALTER COLUMN "payoutMultiplier" SET DEFAULT '0.00'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.mines_games', 'currentMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."mines_games" ALTER COLUMN "currentMultiplier" SET DEFAULT '1.00000000'`,
      );
    }
    hasColumn = await queryRunner.hasColumn('games.roulette_games', 'totalMultiplier');
    if (hasColumn) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "games"."roulette_games" ALTER COLUMN "totalMultiplier" SET DEFAULT '0.0000'`,
      );
    }

    // seed default admin
    // EMAIL=admin@zetik.casino
    // PASSWORD=changeme123
    // NAME=Administrator
    await queryRunner.query(`
      INSERT INTO admin.admin_users (
        id,
        email,
        name,
        password,
        role,
        "isActive",
        "tokenVersion",
        permissions,
        "lastLoginAt",
        "lastLoginIp",
        "createdAt",
        "updatedAt"
      ) 
      VALUES (
        gen_random_uuid(),
        'admin@zetik.casino',
        'Administrator',
        'b24e4c5c2e19cfb280bdc4d72ca1fb21568b1e57a669857db271962e4c2315aa:c48c6e486f280b7eb1642cf4858651006a5bbc923de4192281a436affc0a6068f83a493402e7bf57d6cf828d24f38a14c194ea3c8208d20e9464cba8e95c27c8',
        'super_admin',
        true,
        1,
        '{"games": true, "users": true, "reports": true, "settings": true, "transactions": true}',
        null,
        null,
        now(),
        now()
      ) ON CONFLICT (email) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"."system_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"."api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"."admin_users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"."admin_audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "admin"."admin_audit_logs_action_enum"`);
  }
}
