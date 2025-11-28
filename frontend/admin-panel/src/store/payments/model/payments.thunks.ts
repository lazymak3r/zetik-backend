import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../../config/api';

export const fetchAssets = createAsyncThunk(
  'payments/fetchAssets',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/payments/assets');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch assets');
    }
  },
);

export const fetchCurrencyRates = createAsyncThunk(
  'payments/fetchCurrencyRates',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/payments/currency-rates');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch currency rates');
    }
  },
);

export const fetchUserStatistics = createAsyncThunk(
  'payments/fetchUserStatistics',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/payments/user-statistics/${userId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user statistics');
    }
  },
);

export const fetchUserBalanceStatistics = createAsyncThunk(
  'payments/fetchUserBalanceStatistics',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/payments/user-balance-statistics/${userId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch balance statistics');
    }
  },
);

export const createAsset = createAsyncThunk(
  'payments/createAsset',
  async ({ symbol, status }: { symbol: string; status?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/payments/assets', { symbol, status: status || 'ACTIVE' });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create asset');
    }
  },
);

export const updateAssetStatus = createAsyncThunk(
  'payments/updateAssetStatus',
  async ({ symbol, status }: { symbol: string; status: string }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/payments/assets/${symbol}`, { status });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update asset status');
    }
  },
);

export const fetchWithdrawRequests = createAsyncThunk(
  'payments/fetchWithdrawRequests',
  async (
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      userId?: string;
      asset?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const params = new URLSearchParams();

      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.asset) params.append('asset', filters.asset);

      const response = await api.get(`/payments/withdraw-requests?${params}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch withdrawal requests',
      );
    }
  },
);

export const approveWithdrawRequest = createAsyncThunk(
  'payments/approveWithdrawRequest',
  async ({ id, comment }: { id: string; comment?: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/payments/withdraw-requests/${id}/approve`, {
        comment,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to approve withdrawal request',
      );
    }
  },
);

export const rejectWithdrawRequest = createAsyncThunk(
  'payments/rejectWithdrawRequest',
  async ({ id, reason }: { id: string; reason: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/payments/withdraw-requests/${id}/reject`, {
        reason,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to reject withdrawal request',
      );
    }
  },
);
