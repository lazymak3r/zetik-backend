import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { ArticlesListResponseDto } from './dto/articles-list-response.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('articles')
  @ApiOperation({
    summary: 'Get published blog articles',
    description:
      'Retrieve a paginated list of published blog articles with optional filtering by tag and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved articles',
    type: ArticlesListResponseDto,
  })
  async getArticles(@Query() queryDto: GetArticlesQueryDto): Promise<ArticlesListResponseDto> {
    return await this.blogService.getArticles({
      tag: queryDto.tag || 'all',
      page: queryDto.page,
      limit: queryDto.limit,
      search: queryDto.search,
      contentType: queryDto.contentType,
    });
  }

  @Get('article/:slug')
  @ApiOperation({
    summary: 'Get single blog article by slug',
    description: 'Retrieve a single published blog article by its slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved article',
    type: ArticleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found or not published',
  })
  async getArticleBySlug(@Param('slug') slug: string): Promise<ArticleResponseDto> {
    const result = await this.blogService.getArticleBySlug({ slug });

    if (!result) {
      throw new NotFoundException('Article not found or not published');
    }

    return result;
  }
}
