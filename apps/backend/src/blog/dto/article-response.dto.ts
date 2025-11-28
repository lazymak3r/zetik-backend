import { ApiProperty } from '@nestjs/swagger';
import { BlogArticleContentTypeEnum, BlogArticleTagDbEnum } from '@zetik/shared-entities';

export class ArticleResponseDto {
  @ApiProperty({ example: 1, description: 'Article ID' })
  id!: number;

  @ApiProperty({ example: 'How to Trade Crypto Safely', description: 'Article title' })
  title!: string;

  @ApiProperty({ example: 'how-to-trade-crypto-safely', description: 'Article slug' })
  slug!: string;

  @ApiProperty({
    example: '<p>Complete guide to cryptocurrency trading...</p>',
    description: 'Article content in HTML',
  })
  content!: string;

  @ApiProperty({
    example: 'Essential tips for beginners',
    description: 'Article subtitle',
    required: false,
  })
  subTitle?: string;

  @ApiProperty({
    example: 'https://example.com/crypto-guide.jpg',
    description: 'Cover image URL',
  })
  cover!: string;

  @ApiProperty({
    enum: BlogArticleTagDbEnum,
    isArray: true,
    example: ['Crypto', 'News'],
    description: 'Article tags',
  })
  tags!: BlogArticleTagDbEnum[];

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Creation date' })
  createdAt!: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Last update date' })
  updatedAt!: Date;

  @ApiProperty({ example: null, description: 'Article expiration date', required: false })
  endsAt?: Date;

  @ApiProperty({
    example: 'admin-user-id',
    description: 'Last updated by user ID',
    required: false,
  })
  updatedBy?: string;

  @ApiProperty({
    enum: BlogArticleContentTypeEnum,
    example: BlogArticleContentTypeEnum.BLOG,
    description: 'Content type (blog or promo)',
  })
  contentType!: BlogArticleContentTypeEnum;
}
