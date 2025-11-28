import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BlogArticleEntity,
  BlogArticleTagDbEnum,
  BlogArticleTagEnum,
  tagApiToDb,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { RedisService } from '../common/services/redis.service';
import {
  IArticleResponse,
  IArticlesListResponse,
  IGetArticleByIdInput,
  IGetArticleBySlugInput,
  IGetArticlesInput,
} from './interfaces/blog.interface';

@Injectable()
export class BlogService {
  private readonly CACHE_TTL = 60; // 1 minute
  private readonly ARTICLES_CACHE_PREFIX = 'blog:articles';
  private readonly ARTICLE_CACHE_PREFIX = 'blog:article';

  constructor(
    @InjectRepository(BlogArticleEntity)
    private readonly blogRepository: Repository<BlogArticleEntity>,
    private readonly redisService: RedisService,
  ) {}

  async getArticles(input: IGetArticlesInput): Promise<IArticlesListResponse> {
    // Generate cache key based on request parameters
    const cacheKey = this.getArticlesCacheKey(input);

    // Try to get from cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Continue with DB query if cache fails
    }

    const pageSize = input.limit || 10;
    const skip = ((input.page || 1) - 1) * pageSize;

    const query = this.blogRepository.createQueryBuilder('article');

    // Select only necessary fields (exclude heavy 'text' field and sensitive data)
    query.select([
      'article.id',
      'article.title',
      'article.slug',
      'article.subTitle',
      'article.cover',
      'article.tags',
      'article.createdAt',
      'article.updatedAt',
      'article.endsAt',
      'article.contentType',
    ]);

    // Show only published articles for clients
    query.where('article.isPublished = :isPublished', { isPublished: true });

    // If specific tag is passed (not 'All'), filter by tag
    if (input.tag && input.tag !== 'All') {
      // Handle both API format (lowercase) and DB format (capitalized)
      let dbTag: string;
      if (Object.values(BlogArticleTagEnum).includes(input.tag as BlogArticleTagEnum)) {
        // Input is in API format, convert to DB format
        dbTag = tagApiToDb(input.tag as BlogArticleTagEnum);
      } else if (Object.values(BlogArticleTagDbEnum).includes(input.tag as BlogArticleTagDbEnum)) {
        // Input is already in DB format
        dbTag = input.tag;
      } else {
        // Fallback: use input as is
        dbTag = input.tag;
      }
      query.andWhere(":tag = ANY(string_to_array(article.tags, ','))", { tag: dbTag });
    }

    // Search by title and subtitle using database
    if (input.search) {
      query.andWhere('(article.title ILIKE :search OR article.subTitle ILIKE :search)', {
        search: `%${input.search}%`,
      });
    }

    // Filter by content type
    if (input.contentType) {
      query.andWhere('article.content_type = :contentType', {
        contentType: input.contentType,
      });
    }

    // Apply pagination and ordering
    const [articles, total] = await query
      .orderBy('article.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    // Return tags as stored in DB
    const result = {
      articles,
      total,
      page: input.page || 1,
      pageSize,
    };

    // Cache the result
    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    } catch {
      // Silent fail for cache writes
    }

    return result;
  }

  async getArticleById(input: IGetArticleByIdInput): Promise<IArticleResponse | null> {
    // Generate cache key for single article
    const cacheKey = this.getArticleCacheKey(input.id);

    // Try to get from cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Continue with DB query if cache fails
    }

    const article = await this.blogRepository.findOne({
      where: {
        id: input.id,
        isPublished: true, // Show only published articles for clients
      },
    });

    // Return tags as stored in DB
    if (article) {
      const transformedArticle = {
        ...article,
        tags: article.tags,
      };

      try {
        await this.redisService.set(cacheKey, JSON.stringify(transformedArticle), this.CACHE_TTL);
      } catch {
        // Silent fail for cache writes
      }

      return transformedArticle;
    }

    return null;
  }

  async getArticleBySlug(input: IGetArticleBySlugInput): Promise<IArticleResponse | null> {
    // Generate cache key for single article by slug
    const cacheKey = this.getArticleBySlugCacheKey(input.slug);

    // Try to get from cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Continue with DB query if cache fails
    }

    const article = await this.blogRepository.findOne({
      where: {
        slug: input.slug,
        isPublished: true, // Show only published articles for clients
      },
    });

    // Return tags as stored in DB
    if (article) {
      const transformedArticle = {
        ...article,
        tags: article.tags,
      };

      try {
        await this.redisService.set(cacheKey, JSON.stringify(transformedArticle), this.CACHE_TTL);
      } catch {
        // Silent fail for cache writes
      }

      return transformedArticle;
    }

    return null;
  }

  private getArticlesCacheKey(input: IGetArticlesInput): string {
    const params = new URLSearchParams();
    if (input.page) params.append('page', input.page.toString());
    if (input.limit) params.append('limit', input.limit.toString());
    if (input.tag) params.append('tag', input.tag);
    if (input.search) params.append('search', input.search);
    if (input.contentType) params.append('contentType', input.contentType);
    return `${this.ARTICLES_CACHE_PREFIX}:${params.toString()}`;
  }

  private getArticleCacheKey(id: number): string {
    return `${this.ARTICLE_CACHE_PREFIX}:${id}`;
  }

  private getArticleBySlugCacheKey(slug: string): string {
    return `${this.ARTICLE_CACHE_PREFIX}:slug:${slug}`;
  }
}
