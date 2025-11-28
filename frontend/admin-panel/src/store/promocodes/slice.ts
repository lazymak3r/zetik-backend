import { createSlice } from '@reduxjs/toolkit';
import {
  IPromocodeAdminResponse,
  IPromocodeAuditItem,
  IPromocodeClaim,
} from '../../types/promocode.types';
import {
  cancelPromocode,
  createPromocode,
  fetchPromocodes,
  getPromocodeClaims,
  getPromocodeDetails,
  getPromocodeHistory,
  pausePromocode,
  resumePromocode,
  updatePromocode,
} from './thunks';

interface PromocodesState {
  promocodes: IPromocodeAdminResponse[];
  total: number;
  loading: boolean;
  error: string | null;
  currentPromocode: IPromocodeAdminResponse | null;
  claims: IPromocodeClaim[];
  auditHistory: IPromocodeAuditItem[];
  claimsHistory: IPromocodeClaim[];
}

const initialState: PromocodesState = {
  promocodes: [],
  total: 0,
  loading: false,
  error: null,
  currentPromocode: null,
  claims: [],
  auditHistory: [],
  claimsHistory: [],
};

const promocodesSlice = createSlice({
  name: 'promocodes',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentPromocode: (state) => {
      state.currentPromocode = null;
      state.claims = [];
      state.auditHistory = [];
      state.claimsHistory = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPromocodes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPromocodes.fulfilled, (state, action) => {
        state.loading = false;
        state.promocodes = action.payload.data;
        state.total = action.payload.total;
      })
      .addCase(fetchPromocodes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch promocodes';
      });

    builder
      .addCase(createPromocode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPromocode.fulfilled, (state, action) => {
        state.loading = false;
        state.promocodes.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createPromocode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create promocode';
      });

    builder
      .addCase(updatePromocode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePromocode.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.promocodes.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.promocodes[index] = action.payload;
        }
        if (state.currentPromocode?.id === action.payload.id) {
          state.currentPromocode = action.payload;
        }
      })
      .addCase(updatePromocode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update promocode';
      });

    builder
      .addCase(pausePromocode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(pausePromocode.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.promocodes.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.promocodes[index] = action.payload;
        }
        if (state.currentPromocode?.id === action.payload.id) {
          state.currentPromocode = action.payload;
        }
      })
      .addCase(pausePromocode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to pause promocode';
      });

    builder
      .addCase(resumePromocode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resumePromocode.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.promocodes.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.promocodes[index] = action.payload;
        }
        if (state.currentPromocode?.id === action.payload.id) {
          state.currentPromocode = action.payload;
        }
      })
      .addCase(resumePromocode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to resume promocode';
      });

    builder
      .addCase(cancelPromocode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelPromocode.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.promocodes.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.promocodes[index] = action.payload;
        }
        if (state.currentPromocode?.id === action.payload.id) {
          state.currentPromocode = action.payload;
        }
      })
      .addCase(cancelPromocode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to cancel promocode';
      });

    builder
      .addCase(getPromocodeDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPromocodeDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPromocode = action.payload;
        state.claims = action.payload.claims || [];
      })
      .addCase(getPromocodeDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get promocode details';
      });

    builder.addCase(getPromocodeHistory.fulfilled, (state, action) => {
      state.auditHistory = action.payload;
    });

    builder.addCase(getPromocodeClaims.fulfilled, (state, action) => {
      state.claimsHistory = action.payload;
    });
  },
});

export const { clearError, clearCurrentPromocode } = promocodesSlice.actions;
export default promocodesSlice.reducer;
