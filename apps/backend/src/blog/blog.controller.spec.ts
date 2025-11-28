import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlogArticleEntity } from '@zetik/shared-entities';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

describe('BlogController', () => {
  let controller: BlogController;

  const mockBlogService = {
    getArticles: jest.fn(),
    getArticleById: jest.fn(),
    getArticleBySlug: jest.fn(),
  };

  const mockArticle: BlogArticleEntity = {
    id: 1,
    title: 'Test Article',
    slug: 'test-article',
    content: 'Test HTML content',
    subTitle: 'Test Subtitle',
    cover: 'cover.jpg',
    tags: ['casino', 'promotions'] as any,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    endsAt: new Date('2024-12-31'),
    updatedBy: 'test-user-id',
    isPublished: true,
    contentType: 'blog' as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        {
          provide: BlogService,
          useValue: mockBlogService,
        },
      ],
    }).compile();

    controller = module.get<BlogController>(BlogController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getArticles', () => {
    it('should return all articles when tag is "all"', async () => {
      const mockResponse = {
        articles: [mockArticle],
        total: 1,
        page: 1,
        pageSize: 6,
      };

      mockBlogService.getArticles.mockResolvedValue(mockResponse);

      const result = await controller.getArticles({ tag: 'all' as any, page: 1, search: 'test' });

      expect(mockBlogService.getArticles).toHaveBeenCalledWith({
        tag: 'all',
        page: 1,
        search: 'test',
      });
      expect(result.total).toBe(1);
      expect(result.articles).toHaveLength(1);
    });

    it('should return articles filtered by specific tag', async () => {
      const mockResponse = {
        articles: [mockArticle],
        total: 1,
        page: 1,
        pageSize: 6,
      };

      mockBlogService.getArticles.mockResolvedValue(mockResponse);

      const result = await controller.getArticles({
        tag: 'casino' as any,
        page: 1,
        search: 'test',
      });

      expect(mockBlogService.getArticles).toHaveBeenCalledWith({
        tag: 'casino',
        page: 1,
        search: 'test',
      });
      expect(result.total).toBe(1);
      expect(result.articles).toHaveLength(1);
    });
  });

  describe('getArticleBySlug', () => {
    it('should return article by slug', async () => {
      const mockResponse = {
        id: 1,
        title: 'Test Article',
        slug: 'test-article',
        content: 'Test HTML content',
        subTitle: 'Test Subtitle',
        cover: 'cover.jpg',
        tags: ['casino', 'promotions'] as any,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        endsAt: new Date('2024-12-31'),
        updatedBy: 'test-user-id',
      };

      mockBlogService.getArticleBySlug.mockResolvedValue(mockResponse);

      const result = await controller.getArticleBySlug('test-article');

      expect(mockBlogService.getArticleBySlug).toHaveBeenCalledWith({ slug: 'test-article' });
      expect(result?.id).toBe(1);
      expect(result?.title).toBe('Test Article');
      expect(result?.slug).toBe('test-article');
    });

    it('should throw NotFoundException for non-existent article', async () => {
      mockBlogService.getArticleBySlug.mockResolvedValue(null);

      await expect(controller.getArticleBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
