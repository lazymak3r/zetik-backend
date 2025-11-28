import { PartialType } from '@nestjs/mapped-types';
import { CreateBlogArticleDto } from './create-blog-article.dto';

export class UpdateBlogArticleDto extends PartialType(CreateBlogArticleDto) {}
