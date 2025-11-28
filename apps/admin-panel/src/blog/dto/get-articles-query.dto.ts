import { BlogArticleContentTypeEnum, BlogArticleTagEnum } from '@zetik/shared-entities';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetArticlesQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 6;

  @IsOptional()
  @IsEnum(BlogArticleTagEnum)
  tag?: BlogArticleTagEnum;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(BlogArticleContentTypeEnum)
  contentType?: BlogArticleContentTypeEnum;
}
