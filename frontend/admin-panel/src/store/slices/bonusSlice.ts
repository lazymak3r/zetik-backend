import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

interface BonusState {
  vipTiers: any[];
  bonuses: any[];
  total: number;
  loading: boolean;
  error: string | null;
  weeklyRacePrizes: Array<{ place: number; amount: number }>;
}

const initialState: BonusState = {
  vipTiers: [],
  bonuses: [],
  total: 0,
  loading: false,
  error: null,
  weeklyRacePrizes: [],
};

export const fetchVipTiers = createAsyncThunk('bonus/fetchVipTiers', async () => {
  const res = await api.get('/vip-tiers');
  return res.data;
});

export const fetchBonuses = createAsyncThunk(
  'bonus/fetchBonuses',
  async ({ page, limit }: { page: number; limit: number }) => {
    const res = await api.get('/bonuses/with-filters', { params: { page, limit } });
    return res.data;
  },
);

export const cancelBonuses = createAsyncThunk(
  'bonus/cancelBonuses',
  async ({ bonusIds, reason }: { bonusIds: string[]; reason?: string }) => {
    const res = await api.post('/bonuses/cancel-batch', { bonusIds, reason });
    return res.data;
  },
);

export const updateVipTier = createAsyncThunk(
  'bonus/updateVipTier',
  async ({ level, data }: { level: number; data: any }) => {
    const res = await api.put(`/vip-tiers/${level}`, data);
    return res.data;
  },
);

export const fetchWeeklyRacePrizes = createAsyncThunk('bonus/fetchWeeklyRacePrizes', async () => {
  const res = await api.get('/bonuses/weekly-race/prizes');
  return res.data as Array<{ place: number; amount: number }>;
});

export const updateWeeklyRacePrizes = createAsyncThunk(
  'bonus/updateWeeklyRacePrizes',
  async (prizes: Array<{ place: number; amount: number }>) => {
    const res = await api.put('/bonuses/weekly-race/prizes', { prizes });
    return res.data as Array<{ place: number; amount: number }>;
  },
);

const bonusSlice = createSlice({
  name: 'bonus',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVipTiers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVipTiers.fulfilled, (state, action) => {
        state.loading = false;
        state.vipTiers = action.payload || [];
      })
      .addCase(fetchVipTiers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch VIP tiers';
      })
      .addCase(fetchBonuses.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBonuses.fulfilled, (state, action) => {
        state.loading = false;
        state.bonuses = action.payload?.bonuses || [];
        state.total = action.payload?.total || 0;
      })
      .addCase(fetchBonuses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch bonuses';
      })
      .addCase(cancelBonuses.pending, (state) => {
        state.loading = true;
      })
      .addCase(cancelBonuses.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(cancelBonuses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to cancel bonuses';
      })
      .addCase(updateVipTier.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateVipTier.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateVipTier.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update VIP tier';
      })
      .addCase(fetchWeeklyRacePrizes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWeeklyRacePrizes.fulfilled, (state, action) => {
        state.loading = false;
        state.weeklyRacePrizes = action.payload || [];
      })
      .addCase(fetchWeeklyRacePrizes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch weekly race prizes';
      })
      .addCase(updateWeeklyRacePrizes.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateWeeklyRacePrizes.fulfilled, (state, action) => {
        state.loading = false;
        state.weeklyRacePrizes = action.payload || [];
      })
      .addCase(updateWeeklyRacePrizes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update weekly race prizes';
      });
  },
});

export const { clearError } = bonusSlice.actions;
export default bonusSlice.reducer;
