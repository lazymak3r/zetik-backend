import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogArticleEntity } from '@zetik/shared-entities';
import { BlogAdminService } from './blog-admin.service';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';

describe('BlogAdminService', () => {
  let service: BlogAdminService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    }),
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
      providers: [
        BlogAdminService,
        {
          provide: getRepositoryToken(BlogArticleEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BlogAdminService>(BlogAdminService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createArticle', () => {
    it('should create and save an article successfully', async () => {
      const createDto: CreateBlogArticleDto = {
        title: 'Test Article',
        content: 'Test HTML content',
        subTitle: 'Test Subtitle',
        cover: 'cover.jpg',
        tags: ['casino', 'promotions'] as any,
        endsAt: new Date('2024-12-31'),
        updatedBy: 'test-user-id',
      };

      mockRepository.create.mockReturnValue(mockArticle);
      mockRepository.save.mockResolvedValue(mockArticle);

      const result = await service.createArticle(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: createDto.title,
        slug: 'test-article',
        content: createDto.content,
        subTitle: createDto.subTitle,
        cover: createDto.cover,
        tags: createDto.tags,
        endsAt: createDto.endsAt,
        updatedBy: createDto.updatedBy,
        isPublished: false,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockArticle);
      expect(result).toEqual(mockArticle);
    });

    it('should create article with minimal required fields', async () => {
      const createDto: CreateBlogArticleDto = {
        title: 'Test Article',
        content: 'Test content',
        cover: 'test.jpg',
        tags: ['promotions'] as any,
      };

      mockRepository.create.mockReturnValue(mockArticle);
      mockRepository.save.mockResolvedValue(mockArticle);

      await service.createArticle(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: createDto.title,
        slug: 'test-article',
        content: createDto.content,
        subTitle: undefined,
        cover: createDto.cover,
        tags: createDto.tags,
        endsAt: undefined,
        updatedBy: undefined,
        isPublished: false,
      });
    });
  });

  describe('getArticleById', () => {
    it('should return article by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockArticle);

      const result = await service.getArticleById(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockArticle);
    });

    it('should return null if article not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getArticleById(999);

      expect(result).toBeNull();
    });
  });

  describe('getAllArticles', () => {
    it('should return all articles ordered by date', async () => {
      const mockArticles = [mockArticle];
      mockRepository.find.mockResolvedValue(mockArticles);

      const result = await service.getAllArticles();

      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockArticles);
    });
  });

  describe('deleteArticle', () => {
    it('should delete article successfully', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.deleteArticle(1);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if article not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.deleteArticle(999)).rejects.toThrow('Article with ID 999 not found');
      expect(mockRepository.delete).toHaveBeenCalledWith(999);
    });
  });
});
