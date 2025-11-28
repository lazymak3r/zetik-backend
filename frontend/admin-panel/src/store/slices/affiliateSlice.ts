import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../config/api';

interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string;
  userId: string;
  owner?: {
    id: string;
    email: string;
    username?: string;
  };
  totalCommission: string;
  totalReferrals: number;
  uniqueReferrals: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignDetails extends Campaign {
  referrals: Array<{
    userId: string;
    email: string;
    username?: string;
    totalCommission: string;
    commissionsCount: number;
    lastCommissionDate: Date;
  }>;
}

interface AffiliateState {
  campaigns: Campaign[];
  selectedCampaign: CampaignDetails | null;
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
}

const initialState: AffiliateState = {
  campaigns: [],
  selectedCampaign: null,
  total: 0,
  page: 1,
  limit: 10,
  loading: false,
  error: null,
};

export const fetchCampaigns = createAsyncThunk(
  'affiliate/fetchCampaigns',
  async (params: Record<string, any>) => {
    const response = await api.get('/affiliate/campaigns', { params });
    return response.data;
  },
);

export const fetchCampaignDetails = createAsyncThunk(
  'affiliate/fetchCampaignDetails',
  async (campaignId: string) => {
    const response = await api.get(`/affiliate/campaigns/${campaignId}`);
    return response.data;
  },
);

export const deleteCampaign = createAsyncThunk(
  'affiliate/deleteCampaign',
  async (campaignId: string, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/affiliate/campaigns/${campaignId}`);
      return { campaignId, message: response.data.message };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete campaign');
    }
  },
);

const affiliateSlice = createSlice({
  name: 'affiliate',
  initialState,
  reducers: {
    clearSelectedCampaign: (state) => {
      state.selectedCampaign = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCampaigns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch campaigns';
      })
      .addCase(fetchCampaignDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCampaignDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCampaign = action.payload;
      })
      .addCase(fetchCampaignDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch campaign details';
      })
      .addCase(deleteCampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCampaign.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns = state.campaigns.filter((c) => c.id !== action.payload.campaignId);
        state.total = state.total - 1;
      })
      .addCase(deleteCampaign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearSelectedCampaign } = affiliateSlice.actions;
export default affiliateSlice.reducer;
