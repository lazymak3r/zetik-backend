import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlogArticleEntity } from '@zetik/shared-entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlogAdminService } from './blog-admin.service';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';
import { UpdateBlogArticleDto } from './dto/update-blog-article.dto';

@ApiTags('Blog')
@Controller('blog')
@UseGuards(JwtAuthGuard)
export class BlogAdminController {
  constructor(private readonly blogAdminService: BlogAdminService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new blog article',
    description: 'Create a new blog article in the admin panel',
  })
  @ApiResponse({
    status: 201,
    description: 'Article successfully created',
    type: BlogArticleEntity,
    example: {
      id: 1,
      title: 'How to Trade Crypto Safely',
      slug: 'how-to-trade-crypto-safely',
      content: '<p>Complete guide to cryptocurrency trading...</p>',
      subTitle: 'Essential tips for beginners',
      cover: 'https://example.com/crypto-guide.jpg',
      tags: ['crypto', 'promotions'],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      endsAt: null,
      updatedBy: 'admin-user-id',
      isPublished: false,
    },
  })
  async create(@Body() createBlogArticleDto: CreateBlogArticleDto): Promise<BlogArticleEntity> {
    return this.blogAdminService.createArticle(createBlogArticleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all blog articles for admin',
    description:
      'Retrieve all blog articles (published and drafts) with pagination, filtering, and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved articles',
    example: {
      articles: [
        {
          id: 1,
          title: 'How to Trade Crypto Safely',
          slug: 'how-to-trade-crypto-safely',
          content: '<p>Complete guide to cryptocurrency trading...</p>',
          subTitle: 'Essential tips for beginners',
          cover: 'https://example.com/crypto-guide.jpg',
          tags: ['crypto', 'promotions'],
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
          endsAt: null,
          updatedBy: 'admin-user-id',
          isPublished: true,
        },
      ],
      total: 15,
      page: 1,
      pageSize: 25,
    },
  })
  async findAll(@Query() queryDto: GetArticlesQueryDto) {
    return this.blogAdminService.getAllArticles(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single blog article by ID for admin',
    description: 'Retrieve a single blog article by its ID (including drafts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved article',
    type: BlogArticleEntity,
    example: {
      id: 1,
      title: 'How to Trade Crypto Safely',
      slug: 'how-to-trade-crypto-safely',
      content: '<p>Complete guide to cryptocurrency trading...</p>',
      subTitle: 'Essential tips for beginners',
      cover: 'https://example.com/crypto-guide.jpg',
      tags: ['crypto', 'promotions'],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      endsAt: null,
      updatedBy: 'admin-user-id',
      isPublished: false,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found',
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<BlogArticleEntity | null> {
    return this.blogAdminService.getArticleById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBlogArticleDto: UpdateBlogArticleDto,
  ): Promise<BlogArticleEntity> {
    return this.blogAdminService.updateArticle(id, updateBlogArticleDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.blogAdminService.deleteArticle(id);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get single blog article by slug for admin',
    description: 'Retrieve a single blog article by its slug (including drafts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved article',
    type: BlogArticleEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found',
  })
  async findOneBySlug(@Param('slug') slug: string): Promise<BlogArticleEntity | null> {
    return this.blogAdminService.getArticleBySlug(slug);
  }

  @Patch('slug/:slug')
  @ApiOperation({
    summary: 'Update blog article by slug for admin',
    description: 'Update a blog article by its slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully updated article',
    type: BlogArticleEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found',
  })
  async updateBySlug(
    @Param('slug') slug: string,
    @Body() updateBlogArticleDto: UpdateBlogArticleDto,
  ): Promise<BlogArticleEntity> {
    return this.blogAdminService.updateArticleBySlug(slug, updateBlogArticleDto);
  }

  @Delete('slug/:slug')
  @ApiOperation({
    summary: 'Delete blog article by slug for admin',
    description: 'Delete a blog article by its slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted article',
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found',
  })
  async removeBySlug(@Param('slug') slug: string): Promise<void> {
    return this.blogAdminService.deleteArticleBySlug(slug);
  }
}
