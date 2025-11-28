import { ApiProperty } from '@nestjs/swagger';
import { BlogArticleContentTypeEnum, BlogArticleTagDbEnum } from '@zetik/shared-entities';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetArticlesQueryDto {
  @ApiProperty({
    example: '1',
    description: 'Page number',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 6,
    description: 'Number of articles per page',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 6;

  @ApiProperty({
    enum: BlogArticleTagDbEnum,
    example: 'All',
    description: 'Filter articles by tag. Defaults to "All" if not specified.',
    required: false,
  })
  @IsOptional()
  @IsEnum(BlogArticleTagDbEnum)
  tag?: BlogArticleTagDbEnum = BlogArticleTagDbEnum.ALL;

  @ApiProperty({
    example: '',
    description: 'Search articles by title or subtitle',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: BlogArticleContentTypeEnum,
    example: BlogArticleContentTypeEnum.BLOG,
    description: 'Filter articles by content type (blog or promo)',
    required: false,
  })
  @IsOptional()
  @IsEnum(BlogArticleContentTypeEnum)
  contentType?: BlogArticleContentTypeEnum;
}
