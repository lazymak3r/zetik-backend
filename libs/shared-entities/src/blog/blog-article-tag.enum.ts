// API enum for validation (camelCase for backwards compatibility)
export enum BlogArticleTagEnum {
  ALL = 'all', // For API filtering only, not used in actual articles
  CASINO = 'casino',
  SPORTS = 'sports',
  HOW_TO_GUIDES = 'howToGuides',
  CRYPTO = 'crypto',
  PROMOTIONS = 'promotions',
  ZETIK_NEWS = 'zetikNews',
  NEW_ARRIVALS = 'newArrivals',
  OTHER = 'other',
}

// Database enum for storage (human-readable format)
export enum BlogArticleTagDbEnum {
  ALL = 'All', // For API filtering only, not used in actual articles
  CASINO = 'Casino',
  SPORTS = 'Sports',
  HOW_TO_GUIDES = 'How To Guides',
  CRYPTO = 'Crypto',
  PROMOTIONS = 'Promotions',
  ZETIK_NEWS = 'Zetik News',
  NEW_ARRIVALS = 'New Arrivals',
  OTHER = 'Other',
}

// Mapping functions between API and DB formats
export const tagApiToDb = (apiTag: BlogArticleTagEnum): BlogArticleTagDbEnum => {
  const mapping: Record<BlogArticleTagEnum, BlogArticleTagDbEnum> = {
    [BlogArticleTagEnum.ALL]: BlogArticleTagDbEnum.ALL,
    [BlogArticleTagEnum.CASINO]: BlogArticleTagDbEnum.CASINO,
    [BlogArticleTagEnum.SPORTS]: BlogArticleTagDbEnum.SPORTS,
    [BlogArticleTagEnum.HOW_TO_GUIDES]: BlogArticleTagDbEnum.HOW_TO_GUIDES,
    [BlogArticleTagEnum.CRYPTO]: BlogArticleTagDbEnum.CRYPTO,
    [BlogArticleTagEnum.PROMOTIONS]: BlogArticleTagDbEnum.PROMOTIONS,
    [BlogArticleTagEnum.ZETIK_NEWS]: BlogArticleTagDbEnum.ZETIK_NEWS,
    [BlogArticleTagEnum.NEW_ARRIVALS]: BlogArticleTagDbEnum.NEW_ARRIVALS,
    [BlogArticleTagEnum.OTHER]: BlogArticleTagDbEnum.OTHER,
  };
  return mapping[apiTag];
};

export const tagDbToApi = (dbTag: BlogArticleTagDbEnum): BlogArticleTagEnum => {
  const mapping: Record<BlogArticleTagDbEnum, BlogArticleTagEnum> = {
    [BlogArticleTagDbEnum.ALL]: BlogArticleTagEnum.ALL,
    [BlogArticleTagDbEnum.CASINO]: BlogArticleTagEnum.CASINO,
    [BlogArticleTagDbEnum.SPORTS]: BlogArticleTagEnum.SPORTS,
    [BlogArticleTagDbEnum.HOW_TO_GUIDES]: BlogArticleTagEnum.HOW_TO_GUIDES,
    [BlogArticleTagDbEnum.CRYPTO]: BlogArticleTagEnum.CRYPTO,
    [BlogArticleTagDbEnum.PROMOTIONS]: BlogArticleTagEnum.PROMOTIONS,
    [BlogArticleTagDbEnum.ZETIK_NEWS]: BlogArticleTagEnum.ZETIK_NEWS,
    [BlogArticleTagDbEnum.NEW_ARRIVALS]: BlogArticleTagEnum.NEW_ARRIVALS,
    [BlogArticleTagDbEnum.OTHER]: BlogArticleTagEnum.OTHER,
  };
  return mapping[dbTag];
};
