import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Asset, CurrencyRates, PaymentsState, UserStatistics, WithdrawRequest } from '../config';
import {
  approveWithdrawRequest,
  createAsset,
  fetchAssets,
  fetchCurrencyRates,
  fetchUserBalanceStatistics,
  fetchUserStatistics,
  fetchWithdrawRequests,
  rejectWithdrawRequest,
  updateAssetStatus,
} from './payments.thunks';

const initialState: PaymentsState = {
  assets: [],
  withdrawRequests: [],
  currencyRates: null,
  userStatistics: null,
  userBalanceStatistics: null,
  total: 0,
  loading: false,
  error: null,
};

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearUserStatistics: (state) => {
      state.userStatistics = null;
      state.userBalanceStatistics = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch assets
      .addCase(fetchAssets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssets.fulfilled, (state, action: PayloadAction<Asset[]>) => {
        state.loading = false;
        state.assets = action.payload;
      })
      .addCase(fetchAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch currency rates
      .addCase(fetchCurrencyRates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrencyRates.fulfilled, (state, action: PayloadAction<CurrencyRates>) => {
        state.loading = false;
        state.currencyRates = action.payload;
      })
      .addCase(fetchCurrencyRates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user statistics
      .addCase(fetchUserStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserStatistics.fulfilled, (state, action: PayloadAction<UserStatistics>) => {
        state.loading = false;
        state.userStatistics = action.payload;
      })
      .addCase(fetchUserStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user balance statistics
      .addCase(fetchUserBalanceStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserBalanceStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.userBalanceStatistics = action.payload;
      })
      .addCase(fetchUserBalanceStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch balance statistics';
      })

      // Create asset
      .addCase(createAsset.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAsset.fulfilled, (state, action: PayloadAction<Asset>) => {
        state.loading = false;
        state.assets.push(action.payload);
      })
      .addCase(createAsset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update asset status
      .addCase(updateAssetStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAssetStatus.fulfilled, (state, action: PayloadAction<Asset>) => {
        state.loading = false;
        const index = state.assets.findIndex((asset) => asset.symbol === action.payload.symbol);
        if (index !== -1) {
          state.assets[index] = action.payload;
        }
      })
      .addCase(updateAssetStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch withdrawal requests
      .addCase(fetchWithdrawRequests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchWithdrawRequests.fulfilled,
        (
          state,
          action: PayloadAction<{
            requests: WithdrawRequest[];
            total: number;
          }>,
        ) => {
          state.loading = false;
          state.withdrawRequests = action.payload.requests;
          state.total = action.payload.total;
        },
      )
      .addCase(fetchWithdrawRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Approve withdrawal request
      .addCase(
        approveWithdrawRequest.fulfilled,
        (state, action: PayloadAction<WithdrawRequest>) => {
          const index = state.withdrawRequests.findIndex((req) => req.id === action.payload.id);
          if (index !== -1) {
            state.withdrawRequests[index] = action.payload;
          }
        },
      )
      .addCase(approveWithdrawRequest.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Reject withdrawal request
      .addCase(rejectWithdrawRequest.fulfilled, (state, action: PayloadAction<WithdrawRequest>) => {
        const index = state.withdrawRequests.findIndex((req) => req.id === action.payload.id);
        if (index !== -1) {
          state.withdrawRequests[index] = action.payload;
        }
      })
      .addCase(rejectWithdrawRequest.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearUserStatistics } = paymentsSlice.actions;
export default paymentsSlice.reducer;
