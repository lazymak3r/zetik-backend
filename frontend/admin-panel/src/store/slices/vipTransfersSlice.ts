import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

export interface VipTransferSubmission {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  name: string;
  country: string;
  contactMethod: string;
  contactUsername: string;
  casino: string;
  casinoUsername: string;
  totalWager: string;
  rank: string;
  howDidYouHear?: string;
  tag?: string;
  customNote?: string;
  taggedByAdminId?: string;
  taggedByAdmin?: {
    id: string;
    name: string;
    email: string;
  };
  taggedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface VipTransfersState {
  submissions: VipTransferSubmission[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: VipTransfersState = {
  submissions: [],
  total: 0,
  loading: false,
  error: null,
};

export const fetchVipTransfers = createAsyncThunk(
  'vipTransfers/fetchVipTransfers',
  async (params: Record<string, any>) => {
    const response = await api.get('/vip-transfers', { params });
    return response.data;
  },
);

export const updateTag = createAsyncThunk(
  'vipTransfers/updateTag',
  async ({ id, tag, vipLevel }: { id: string; tag: string; vipLevel?: number }) => {
    const response = await api.patch(`/vip-transfers/${id}/tag`, { tag, vipLevel });
    return response.data;
  },
);

export const updateNote = createAsyncThunk(
  'vipTransfers/updateNote',
  async ({ id, customNote }: { id: string; customNote?: string }) => {
    const response = await api.patch(`/vip-transfers/${id}/note`, { customNote });
    return response.data;
  },
);

const vipTransfersSlice = createSlice({
  name: 'vipTransfers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVipTransfers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVipTransfers.fulfilled, (state, action) => {
        state.loading = false;
        state.submissions = action.payload.submissions;
        state.total = action.payload.total;
      })
      .addCase(fetchVipTransfers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch VIP transfers';
      })
      .addCase(updateTag.fulfilled, (state, action) => {
        const index = state.submissions.findIndex((s) => s.id === action.meta.arg.id);
        if (index !== -1) {
          state.submissions[index] = { ...state.submissions[index], ...action.payload };
        }
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        const index = state.submissions.findIndex((s) => s.id === action.meta.arg.id);
        if (index !== -1) {
          state.submissions[index] = { ...state.submissions[index], ...action.payload };
        }
      });
  },
});

export default vipTransfersSlice.reducer;
