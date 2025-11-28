import { Test, TestingModule } from '@nestjs/testing';
import { BlogArticleEntity } from '@zetik/shared-entities';
import { BlogAdminController } from './blog-admin.controller';
import { BlogAdminService } from './blog-admin.service';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';

describe('BlogAdminController', () => {
  let controller: BlogAdminController;

  const mockBlogAdminService = {
    createArticle: jest.fn(),
    getArticleById: jest.fn(),
    getAllArticles: jest.fn(),
    deleteArticle: jest.fn(),
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
    isPublished: false,
    contentType: 'blog' as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogAdminController],
      providers: [
        {
          provide: BlogAdminService,
          useValue: mockBlogAdminService,
        },
      ],
    }).compile();

    controller = module.get<BlogAdminController>(BlogAdminController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create and return new article', async () => {
      const createDto: CreateBlogArticleDto = {
        title: 'Test Article',
        content: 'Test HTML content',
        subTitle: 'Test Subtitle',
        cover: 'cover.jpg',
        tags: ['casino', 'promotions'] as any,
        endsAt: new Date('2024-12-31'),
        updatedBy: 'test-user-id',
      };

      mockBlogAdminService.createArticle.mockResolvedValue(mockArticle);

      const result = await controller.create(createDto);

      expect(mockBlogAdminService.createArticle).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockArticle);
    });

    it('should handle service errors', async () => {
      const createDto: CreateBlogArticleDto = {
        title: 'Test',
        content: 'Test',
        cover: 'test.jpg',
        tags: ['promotions'] as any,
      };

      const serviceError = new Error('Service error');
      mockBlogAdminService.createArticle.mockRejectedValue(serviceError);

      await expect(controller.create(createDto)).rejects.toThrow(serviceError);
      expect(mockBlogAdminService.createArticle).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all articles', async () => {
      const mockResponse = {
        articles: [mockArticle],
        total: 1,
        page: 1,
        pageSize: 25,
      };
      mockBlogAdminService.getAllArticles.mockResolvedValue(mockResponse);

      const result = await controller.findAll({ page: 1, limit: 25 });

      expect(mockBlogAdminService.getAllArticles).toHaveBeenCalledWith({ page: 1, limit: 25 });
      expect(result).toEqual(mockResponse);
    });

    it('should return empty array when no articles', async () => {
      const mockResponse = {
        articles: [],
        total: 0,
        page: 1,
        pageSize: 25,
      };
      mockBlogAdminService.getAllArticles.mockResolvedValue(mockResponse);

      const result = await controller.findAll({});

      expect(result).toEqual(mockResponse);
    });
  });

  describe('findOne', () => {
    it('should return article by id', async () => {
      mockBlogAdminService.getArticleById.mockResolvedValue(mockArticle);

      const result = await controller.findOne(1);

      expect(mockBlogAdminService.getArticleById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockArticle);
    });

    it('should return null for non-existent article', async () => {
      mockBlogAdminService.getArticleById.mockResolvedValue(null);

      const result = await controller.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete article successfully', async () => {
      mockBlogAdminService.deleteArticle.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(mockBlogAdminService.deleteArticle).toHaveBeenCalledWith(1);
    });

    it('should handle service errors during deletion', async () => {
      const serviceError = new Error('Article not found');
      mockBlogAdminService.deleteArticle.mockRejectedValue(serviceError);

      await expect(controller.remove(999)).rejects.toThrow(serviceError);
      expect(mockBlogAdminService.deleteArticle).toHaveBeenCalledWith(999);
    });
  });
});
