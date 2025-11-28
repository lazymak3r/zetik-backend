import { BlogArticleContentTypeEnum, BlogArticleTagDbEnum } from '@zetik/shared-entities';

export interface IGetArticlesInput {
  tag?: BlogArticleTagDbEnum | string;
  page?: number;
  limit?: number;
  search?: string;
  contentType?: BlogArticleContentTypeEnum;
}

export interface IGetArticleByIdInput {
  id: number;
}

export interface IGetArticleBySlugInput {
  slug: string;
}

export interface IArticleResponse {
  id: number;
  title: string;
  slug: string;
  content: string;
  subTitle?: string;
  cover: string;
  tags: BlogArticleTagDbEnum[];
  createdAt: Date;
  updatedAt: Date;
  endsAt?: Date;
  updatedBy?: string;
  contentType: BlogArticleContentTypeEnum;
}

export interface IArticlesListResponse {
  articles: IArticleResponse[];
  total: number;
  page: number;
  pageSize: number;
}
