import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentTypeToBlogArticles1756439252536 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for content_type
    await queryRunner.query(
      `CREATE TYPE "blog"."blog_articles_content_type_enum" AS ENUM('blog', 'promo')`,
    );

    // Add content_type column with default value 'blog'
    await queryRunner.query(
      `ALTER TABLE "blog"."blog_articles" ADD "content_type" "blog"."blog_articles_content_type_enum" NOT NULL DEFAULT 'blog'`,
    );

    // Create index for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_blog_articles_content_type" ON "blog"."blog_articles" ("content_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "blog"."IDX_blog_articles_content_type"`);

    // Drop column
    await queryRunner.query(`ALTER TABLE "blog"."blog_articles" DROP COLUMN "content_type"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE "blog"."blog_articles_content_type_enum"`);
  }
}
