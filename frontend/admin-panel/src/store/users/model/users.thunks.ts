import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../../config/api';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params: Record<string, any>) => {
    const response = await api.get('/users', { params });
    return response.data;
  },
);

export const fetchUserDetails = createAsyncThunk(
  'users/fetchUserDetails',
  async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, data }: { userId: string; data: any }) => {
    const response = await api.patch(`/users/${userId}`, data);
    return response.data;
  },
);

export const adjustBalance = createAsyncThunk(
  'users/adjustBalance',
  async ({ userId, data }: { userId: string; data: any }) => {
    const response = await api.post(`/users/${userId}/adjust-balance`, data);
    return response.data;
  },
);

export const searchUsers = createAsyncThunk('users/searchUsers', async (query: string) => {
  const response = await api.get('/users', { params: { search: query, limit: 20 } });
  return response.data.items;
});

export const assignAdminRole = createAsyncThunk(
  'users/assignAdminRole',
  async ({
    userId,
    role,
    email,
    name,
  }: {
    userId: string;
    role: string;
    email?: string;
    name?: string;
  }) => {
    const response = await api.patch(`/users/${userId}/assign-admin-role`, { role, email, name });
    return response.data;
  },
);

export const removeAdminRole = createAsyncThunk('users/removeAdminRole', async (userId: string) => {
  const response = await api.delete(`/users/${userId}/admin-role`);
  return response.data;
});

export const getUserAdminRole = createAsyncThunk(
  'users/getUserAdminRole',
  async (userId: string) => {
    const response = await api.get(`/users/${userId}/admin-role`);
    return response.data;
  },
);

export const muteUser = createAsyncThunk(
  'users/muteUser',
  async ({
    userId,
    durationMinutes,
    reason,
  }: {
    userId: string;
    durationMinutes: number;
    reason?: string;
  }) => {
    const response = await api.post(`/users/${userId}/mute`, { durationMinutes, reason });
    return { ...response.data, userId, durationMinutes, reason };
  },
);

export const unmuteUser = createAsyncThunk('users/unmuteUser', async (userId: string) => {
  const response = await api.delete(`/users/${userId}/mute`);
  return { ...response.data, userId };
});

export const fetchUserTransactions = createAsyncThunk(
  'users/fetchUserTransactions',
  async ({ userId, page, limit }: { userId: string; page: number; limit: number }) => {
    const response = await api.get(`/users/${userId}/transactions`, {
      params: {
        page: page + 1,
        limit,
      },
    });
    return {
      items: response.data.items || [],
      total: response.data.total || 0,
    };
  },
);
