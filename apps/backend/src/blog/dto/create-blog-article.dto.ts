import { BlogArticleTagDbEnum } from '@zetik/shared-entities';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBlogArticleDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  subTitle?: string;

  @IsString()
  cover!: string;

  @IsArray()
  @IsEnum(BlogArticleTagDbEnum, { each: true })
  tags!: BlogArticleTagDbEnum[];

  @IsOptional()
  endsAt?: Date;

  @IsOptional()
  @IsString()
  updatedBy?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
