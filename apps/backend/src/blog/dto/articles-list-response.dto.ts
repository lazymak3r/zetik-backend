import { ApiProperty } from '@nestjs/swagger';
import { ArticleResponseDto } from './article-response.dto';

export class ArticlesListResponseDto {
  @ApiProperty({
    type: [ArticleResponseDto],
    description: 'Array of articles',
  })
  articles!: ArticleResponseDto[];

  @ApiProperty({ example: 25, description: 'Total number of articles' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Number of articles per page' })
  pageSize!: number;
}
