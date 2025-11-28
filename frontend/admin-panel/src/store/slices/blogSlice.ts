import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';
import { BlogArticleContentTypeEnum } from '../../types/blog.types';

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

// Helper function to get human-readable tag labels
export const getTagLabel = (tag: BlogArticleTagEnum): string => {
  const tagLabels: Record<BlogArticleTagEnum, string> = {
    [BlogArticleTagEnum.ALL]: 'All',
    [BlogArticleTagEnum.CASINO]: 'Casino',
    [BlogArticleTagEnum.SPORTS]: 'Sports',
    [BlogArticleTagEnum.HOW_TO_GUIDES]: 'How To Guides',
    [BlogArticleTagEnum.CRYPTO]: 'Crypto',
    [BlogArticleTagEnum.PROMOTIONS]: 'Promotions',
    [BlogArticleTagEnum.ZETIK_NEWS]: 'Zetik News',
    [BlogArticleTagEnum.NEW_ARRIVALS]: 'New Arrivals',
    [BlogArticleTagEnum.OTHER]: 'Other',
  };
  return tagLabels[tag] || tag;
};

interface BlogArticle {
  id: number;
  title: string;
  slug: string;
  content: string;
  subTitle?: string;
  cover: string;
  tags: BlogArticleTagEnum[];
  createdAt: Date;
  updatedAt: Date;
  endsAt?: Date;
  updatedBy?: string;
  isPublished: boolean;
  contentType: BlogArticleContentTypeEnum;
}

interface CreateBlogArticleDto {
  title: string;
  slug?: string;
  content: string;
  subTitle?: string;
  cover: string;
  tags: BlogArticleTagEnum[];
  endsAt?: Date;
  updatedBy?: string;
  isPublished?: boolean;
  contentType?: BlogArticleContentTypeEnum;
}

type UpdateBlogArticleDto = Partial<CreateBlogArticleDto>;

interface BlogState {
  articles: BlogArticle[];
  selectedArticle: BlogArticle | null;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const initialState: BlogState = {
  articles: [],
  selectedArticle: null,
  total: 0,
  page: 1,
  pageSize: 6,
  loading: false,
  error: null,
};

export const fetchArticles = createAsyncThunk(
  'blog/fetchArticles',
  async (params?: {
    page?: number;
    limit?: number;
    tag?: string;
    search?: string;
    contentType?: BlogArticleContentTypeEnum;
  }) => {
    const searchParams = new URLSearchParams();

    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.tag && params.tag !== 'all') searchParams.append('tag', params.tag);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.contentType) searchParams.append('contentType', params.contentType);

    const queryString = searchParams.toString();
    const url = `/blog${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  },
);

export const fetchArticleById = createAsyncThunk('blog/fetchArticleById', async (id: number) => {
  const response = await api.get(`/blog/${id}`);
  return response.data;
});

export const createArticle = createAsyncThunk(
  'blog/createArticle',
  async (data: CreateBlogArticleDto) => {
    const response = await api.post('/blog', data);
    return response.data;
  },
);

export const updateArticle = createAsyncThunk(
  'blog/updateArticle',
  async ({ id, data }: { id: number; data: UpdateBlogArticleDto }) => {
    const response = await api.patch(`/blog/${id}`, data);
    return response.data;
  },
);

export const deleteArticle = createAsyncThunk('blog/deleteArticle', async (id: number) => {
  await api.delete(`/blog/${id}`);
  return id;
});

const blogSlice = createSlice({
  name: 'blog',
  initialState,
  reducers: {
    clearSelectedArticle: (state) => {
      state.selectedArticle = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch articles
      .addCase(fetchArticles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload && typeof action.payload === 'object' && 'articles' in action.payload) {
          // Response with pagination
          state.articles = action.payload.articles || [];
          state.total = action.payload.total || 0;
          state.page = action.payload.page || 1;
          state.pageSize = action.payload.pageSize || 6;
        } else {
          // Old format (array)
          const articles = Array.isArray(action.payload) ? action.payload : [];
          state.articles = articles.filter(
            (article) => article && typeof article.id !== 'undefined',
          );
          state.total = state.articles.length;
        }
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch articles';
      })
      // Fetch article by ID
      .addCase(fetchArticleById.fulfilled, (state, action) => {
        state.selectedArticle = action.payload;
      })
      // Create article
      .addCase(createArticle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createArticle.fulfilled, (state, action) => {
        state.loading = false;
        state.articles.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createArticle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create article';
      })
      // Update article
      .addCase(updateArticle.fulfilled, (state, action) => {
        const index = state.articles.findIndex((article) => article.id === action.payload.id);
        if (index !== -1) {
          state.articles[index] = action.payload;
        }
        if (state.selectedArticle?.id === action.payload.id) {
          state.selectedArticle = action.payload;
        }
      })
      // Delete article
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.articles = state.articles.filter((article) => article.id !== action.payload);
        state.total -= 1;
        if (state.selectedArticle?.id === action.payload) {
          state.selectedArticle = null;
        }
      });
  },
});

export const { clearSelectedArticle, clearError } = blogSlice.actions;
export default blogSlice.reducer;
