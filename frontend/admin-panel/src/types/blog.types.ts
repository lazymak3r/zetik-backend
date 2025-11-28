export enum BlogArticleContentTypeEnum {
  BLOG = 'blog',
  PROMO = 'promo',
}

export const getContentTypeLabel = (contentType: BlogArticleContentTypeEnum): string => {
  switch (contentType) {
    case BlogArticleContentTypeEnum.BLOG:
      return 'Blog Article';
    case BlogArticleContentTypeEnum.PROMO:
      return 'Promotion';
    default:
      return contentType;
  }
};
