import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BlogArticleEntity,
  BlogArticleTagDbEnum,
  BlogArticleTagEnum,
} from '@zetik/shared-entities';
import { RedisService } from '../common/services/redis.service';
import { BlogService } from './blog.service';

describe('BlogService', () => {
  let service: BlogService;

  const mockRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockArticle: BlogArticleEntity = {
    id: 1,
    title: 'Test Article',
    slug: 'test-article',
    content: 'Test HTML content',
    subTitle: 'Test Subtitle',
    cover: 'cover.jpg',
    tags: [BlogArticleTagDbEnum.CASINO, BlogArticleTagDbEnum.PROMOTIONS],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    endsAt: new Date('2024-12-31'),
    updatedBy: 'test-user-id',
    isPublished: true,
    contentType: 'blog' as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: getRepositoryToken(BlogArticleEntity),
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);

    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getArticles', () => {
    it('should return all articles when tag is ALL', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockArticle], 1]);

      const result = await service.getArticles({ tag: BlogArticleTagEnum.ALL, page: 1 });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('article');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('article.isPublished = :isPublished', {
        isPublished: true,
      });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('article.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(6);
      expect(result.articles).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(6);
    });

    it('should filter by specific tag when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockArticle], 1]);

      await service.getArticles({ tag: BlogArticleTagEnum.CASINO, page: 1 });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('article.isPublished = :isPublished', {
        isPublished: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        ":tag = ANY(string_to_array(article.tags, ','))",
        {
          tag: 'Casino',
        },
      );
    });

    it('should filter by search when provided with ALL tag', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockArticle], 1]);

      await service.getArticles({ tag: BlogArticleTagEnum.ALL, search: 'test', page: 1 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(article.title ILIKE :search OR article.subTitle ILIKE :search)',
        { search: '%test%' },
      );
    });

    it('should combine specific tag and search filters', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockArticle], 1]);

      await service.getArticles({
        tag: BlogArticleTagEnum.CASINO,
        search: 'test',
        page: 1,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('article.isPublished = :isPublished', {
        isPublished: true,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        ":tag = ANY(string_to_array(article.tags, ','))",
        {
          tag: 'Casino',
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(article.title ILIKE :search OR article.subTitle ILIKE :search)',
        { search: '%test%' },
      );
    });
  });

  describe('getArticleById', () => {
    it('should return article by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockArticle);

      const result = await service.getArticleById({ id: 1 });

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1, isPublished: true } });
      expect(result).toEqual({
        id: mockArticle.id,
        title: mockArticle.title,
        slug: mockArticle.slug,
        content: mockArticle.content,
        subTitle: mockArticle.subTitle,
        cover: mockArticle.cover,
        tags: mockArticle.tags,
        createdAt: mockArticle.createdAt,
        updatedAt: mockArticle.updatedAt,
        endsAt: mockArticle.endsAt,
        updatedBy: mockArticle.updatedBy,
        isPublished: mockArticle.isPublished,
      });
    });

    it('should return null if article not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getArticleById({ id: 999 });

      expect(result).toBeNull();
    });
  });
});
