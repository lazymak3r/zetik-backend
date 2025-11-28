import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserFavoritesTables17570175131391 implements MigrationInterface {
  name = 'CreateUserFavoritesTables17570175131391';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "games"."user_game_favorites_game_enum" AS ENUM(
        'CRASH',
        'DICE',
        'MINES',
        'BLACKJACK',
        'ROULETTE',
        'PLINKO',
        'LIMBO',
        'KENO'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "games"."user_game_favorites" (
        "userId" uuid NOT NULL,
        "game" "games"."user_game_favorites_game_enum" NOT NULL,
        CONSTRAINT "PK_user_game_favorites" PRIMARY KEY ("userId", "game")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_game_favorites_userId" 
      ON "games"."user_game_favorites" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "games"."user_provider_game_favorites" (
        "userId" uuid NOT NULL,
        "code" varchar NOT NULL,
        CONSTRAINT "PK_user_provider_game_favorites" PRIMARY KEY ("userId", "code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_provider_game_favorites_userId" 
      ON "games"."user_provider_game_favorites" ("userId")
    `);

    await queryRunner.query(`
      ALTER TABLE "games"."user_provider_game_favorites"
      ADD CONSTRAINT "FK_user_provider_game_favorites_game"
      FOREIGN KEY ("code") REFERENCES "games"."provider_games"("code")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games"."user_provider_game_favorites" DROP CONSTRAINT "FK_user_provider_game_favorites_game"`,
    );
    await queryRunner.query(`DROP INDEX "games"."IDX_user_provider_game_favorites_userId"`);
    await queryRunner.query(`DROP TABLE "games"."user_provider_game_favorites"`);

    await queryRunner.query(`DROP INDEX "games"."IDX_user_game_favorites_userId"`);
    await queryRunner.query(`DROP TABLE "games"."user_game_favorites"`);
    await queryRunner.query(`DROP TYPE "games"."user_game_favorites_game_enum"`);
  }
}
