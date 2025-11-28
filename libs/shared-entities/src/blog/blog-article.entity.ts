import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { BlogArticleContentTypeEnum } from './blog-article-content-type.enum';
import { BlogArticleTagDbEnum } from './blog-article-tag.enum';

@Entity('blog_articles', { schema: DATABASE_SCHEMAS.BLOG })
export class BlogArticleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ unique: true })
  slug!: string;

  @Column('text')
  content!: string;

  @Column({ nullable: true })
  subTitle?: string;

  @Column()
  cover!: string;

  @Column('simple-array')
  tags!: BlogArticleTagDbEnum[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  endsAt?: Date;

  @Column('uuid', { nullable: true })
  updatedBy?: string;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({
    name: 'content_type',
    type: 'enum',
    enum: BlogArticleContentTypeEnum,
    default: BlogArticleContentTypeEnum.BLOG,
  })
  contentType!: BlogArticleContentTypeEnum;
}
