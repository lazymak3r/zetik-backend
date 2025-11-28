import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BlogArticleContentTypeEnum,
  BlogArticleEntity,
  BlogArticleTagDbEnum,
  BlogArticleTagEnum,
  tagApiToDb,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';
import { UpdateBlogArticleDto } from './dto/update-blog-article.dto';

@Injectable()
export class BlogAdminService {
  constructor(
    @InjectRepository(BlogArticleEntity)
    private readonly blogRepository: Repository<BlogArticleEntity>,
  ) {}

  async createArticle(createBlogArticleDto: CreateBlogArticleDto): Promise<BlogArticleEntity> {
    const slug = createBlogArticleDto.slug || this.generateSlug(createBlogArticleDto.title);

    const article = this.blogRepository.create({
      title: createBlogArticleDto.title,
      slug: await this.ensureUniqueSlug(slug),
      content: createBlogArticleDto.content,
      subTitle: createBlogArticleDto.subTitle,
      cover: createBlogArticleDto.cover,
      tags: createBlogArticleDto.tags, // Tags are already in DB format
      endsAt: createBlogArticleDto.endsAt,
      updatedBy: createBlogArticleDto.updatedBy,
      isPublished: createBlogArticleDto.isPublished ?? false,
      contentType: createBlogArticleDto.contentType ?? BlogArticleContentTypeEnum.BLOG,
    });

    const savedArticle = await this.blogRepository.save(article);

    // Return article as-is (tags are already in human-readable format)
    return savedArticle;
  }

  async updateArticle(
    id: number,
    updateBlogArticleDto: UpdateBlogArticleDto,
  ): Promise<BlogArticleEntity> {
    const existingArticle = await this.blogRepository.findOne({ where: { id } });
    if (!existingArticle) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const updatedData: Partial<BlogArticleEntity> = {};

    if (updateBlogArticleDto.title !== undefined) updatedData.title = updateBlogArticleDto.title;
    if (updateBlogArticleDto.slug !== undefined) {
      updatedData.slug = await this.ensureUniqueSlug(updateBlogArticleDto.slug, id);
    }
    if (updateBlogArticleDto.content !== undefined)
      updatedData.content = updateBlogArticleDto.content;
    if (updateBlogArticleDto.subTitle !== undefined)
      updatedData.subTitle = updateBlogArticleDto.subTitle;
    if (updateBlogArticleDto.cover !== undefined) updatedData.cover = updateBlogArticleDto.cover;
    if (updateBlogArticleDto.tags !== undefined) updatedData.tags = updateBlogArticleDto.tags;
    if (updateBlogArticleDto.endsAt !== undefined) updatedData.endsAt = updateBlogArticleDto.endsAt;
    if (updateBlogArticleDto.updatedBy !== undefined)
      updatedData.updatedBy = updateBlogArticleDto.updatedBy;
    if (updateBlogArticleDto.isPublished !== undefined)
      updatedData.isPublished = updateBlogArticleDto.isPublished;
    if (updateBlogArticleDto.contentType !== undefined)
      updatedData.contentType = updateBlogArticleDto.contentType;

    await this.blogRepository.update(id, updatedData);

    const updatedArticle = await this.blogRepository.findOne({ where: { id } });
    if (!updatedArticle) {
      throw new NotFoundException(`Article with ID ${id} not found after update`);
    }

    // Return article as-is (tags are already in human-readable format)
    return updatedArticle;
  }

  async getAllArticles(queryDto?: {
    page?: number;
    limit?: number;
    tag?: string;
    search?: string;
    contentType?: BlogArticleContentTypeEnum;
  }): Promise<{ articles: BlogArticleEntity[]; total: number; page: number; pageSize: number }> {
    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 25;
    const skip = (page - 1) * limit;

    const query = this.blogRepository
      .createQueryBuilder('article')
      .select([
        'article.id',
        'article.title',
        'article.slug',
        'article.content',
        'article.subTitle',
        'article.cover',
        'article.tags',
        'article.createdAt',
        'article.updatedAt',
        'article.endsAt',
        'article.updatedBy',
        'article.isPublished',
        'article.contentType',
      ]);

    // Filter by tag
    if (queryDto?.tag && queryDto.tag !== 'all') {
      // Handle both API format (camelCase) and DB format (human-readable)
      let dbTag: string;
      if (Object.values(BlogArticleTagEnum).includes(queryDto.tag as BlogArticleTagEnum)) {
        // Input is in API format, convert to DB format
        dbTag = tagApiToDb(queryDto.tag as BlogArticleTagEnum);
      } else if (
        Object.values(BlogArticleTagDbEnum).includes(queryDto.tag as BlogArticleTagDbEnum)
      ) {
        // Input is already in DB format
        dbTag = queryDto.tag;
      } else {
        // Fallback: use input as is
        dbTag = queryDto.tag;
      }
      query.andWhere('CAST(article.tags AS TEXT) LIKE :tag', {
        tag: `%${dbTag}%`,
      });
    }

    // Search by title and subtitle
    if (queryDto?.search) {
      query.andWhere('(article.title ILIKE :search OR article.subTitle ILIKE :search)', {
        search: `%${queryDto.search}%`,
      });
    }

    // Filter by content type
    if (queryDto?.contentType) {
      query.andWhere('article.content_type = :contentType', {
        contentType: queryDto.contentType,
      });
    }

    const [articles, total] = await query
      .orderBy('article.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      articles,
      total,
      page,
      pageSize: limit,
    };
  }

  async getArticleById(id: number): Promise<BlogArticleEntity | null> {
    return this.blogRepository.findOne({ where: { id } });
  }

  async getArticleBySlug(slug: string): Promise<BlogArticleEntity | null> {
    return this.blogRepository.findOne({ where: { slug } });
  }

  async updateArticleBySlug(
    slug: string,
    updateBlogArticleDto: UpdateBlogArticleDto,
  ): Promise<BlogArticleEntity> {
    const existingArticle = await this.blogRepository.findOne({ where: { slug } });
    if (!existingArticle) {
      throw new NotFoundException(`Article with slug "${slug}" not found`);
    }

    const updatedData: Partial<BlogArticleEntity> = {};

    if (updateBlogArticleDto.title !== undefined) updatedData.title = updateBlogArticleDto.title;
    if (updateBlogArticleDto.slug !== undefined) {
      updatedData.slug = await this.ensureUniqueSlug(updateBlogArticleDto.slug, existingArticle.id);
    }
    if (updateBlogArticleDto.content !== undefined)
      updatedData.content = updateBlogArticleDto.content;
    if (updateBlogArticleDto.subTitle !== undefined)
      updatedData.subTitle = updateBlogArticleDto.subTitle;
    if (updateBlogArticleDto.cover !== undefined) updatedData.cover = updateBlogArticleDto.cover;
    if (updateBlogArticleDto.tags !== undefined) updatedData.tags = updateBlogArticleDto.tags;
    if (updateBlogArticleDto.endsAt !== undefined) updatedData.endsAt = updateBlogArticleDto.endsAt;
    if (updateBlogArticleDto.updatedBy !== undefined)
      updatedData.updatedBy = updateBlogArticleDto.updatedBy;
    if (updateBlogArticleDto.isPublished !== undefined)
      updatedData.isPublished = updateBlogArticleDto.isPublished;

    await this.blogRepository.update(existingArticle.id, updatedData);

    const updatedArticle = await this.blogRepository.findOne({ where: { id: existingArticle.id } });
    if (!updatedArticle) {
      throw new NotFoundException(`Article with slug "${slug}" not found after update`);
    }

    // Return article as-is (tags are already in human-readable format)
    return updatedArticle;
  }

  async deleteArticle(id: number): Promise<void> {
    const result = await this.blogRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }
  }

  async deleteArticleBySlug(slug: string): Promise<void> {
    const article = await this.blogRepository.findOne({ where: { slug } });
    if (!article) {
      throw new NotFoundException(`Article with slug "${slug}" not found`);
    }

    await this.blogRepository.delete(article.id);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const query = this.blogRepository
      .createQueryBuilder('article')
      .where('article.slug = :slug', { slug });

    if (excludeId) {
      query.andWhere('article.id != :excludeId', { excludeId });
    }

    const count = await query.getCount();
    return count > 0;
  }
}
