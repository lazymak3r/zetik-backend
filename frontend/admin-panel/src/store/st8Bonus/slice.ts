import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  St8AvailableOffer,
  St8BonusDetailsResponse,
  St8BonusOffer,
  St8Game,
  St8LocalBonus,
} from '../../services/st8BonusService';
import {
  cancelSt8Bonus,
  createSt8Bonus,
  fetchAvailableOffers,
  fetchLocalSt8Bonuses,
  fetchSt8BonusById,
  fetchSt8Games,
  fetchSt8Offers,
} from './thunks';

interface St8BonusState {
  offers: St8BonusOffer[];
  isLoading: boolean;
  error: string | null;
  creating: boolean;
  cancelling: Record<string, boolean>;
  selected?: any;
  games: St8Game[];
  // Local database state
  localBonuses: St8LocalBonus[];
  localLoading: boolean;
  localError: string | null;
  // Available offers for selected game
  availableOffers: St8AvailableOffer[];
  offersLoading: boolean;
  offersError: string | null;
  // Bonus details from ST8 API
  bonusDetails: Record<string, St8BonusDetailsResponse | null>;
  bonusDetailsLoading: Record<string, boolean>;
  bonusDetailsError: Record<string, string | null>;
}

const initialState: St8BonusState = {
  games: [],
  offers: [],
  isLoading: false,
  error: null,
  creating: false,
  cancelling: {},
  // Local database state
  localBonuses: [],
  localLoading: false,
  localError: null,
  // Available offers
  availableOffers: [],
  offersLoading: false,
  offersError: null,
  // Bonus details from ST8 API
  bonusDetails: {},
  bonusDetailsLoading: {},
  bonusDetailsError: {},
};

const st8BonusSlice = createSlice({
  name: 'st8Bonus',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSt8Games.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchSt8Games.fulfilled, (state, action: PayloadAction<St8Game[]>) => {
        state.games = action.payload || [];
      })
      .addCase(fetchSt8Games.rejected, (state, action) => {
        state.error = action.error.message || 'Unknown error';
      })
      .addCase(fetchSt8Offers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSt8Offers.fulfilled, (state, action: PayloadAction<any>) => {
        state.isLoading = false;
        const data = action.payload;
        state.offers = Array.isArray(data) ? data : data.offers || [];
      })
      .addCase(fetchSt8Offers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Unknown error';
      })
      .addCase(createSt8Bonus.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createSt8Bonus.fulfilled, (state) => {
        state.creating = false;
      })
      .addCase(createSt8Bonus.rejected, (state, action) => {
        state.creating = false;
        state.error = action.error.message || 'Unknown error';
      })
      .addCase(fetchSt8BonusById.pending, (state, action) => {
        const bonusId = action.meta.arg.bonusId;
        state.bonusDetailsLoading[bonusId] = true;
        state.bonusDetailsError[bonusId] = null;
      })
      .addCase(fetchSt8BonusById.fulfilled, (state, action) => {
        const bonusId = action.meta.arg.bonusId;
        state.bonusDetailsLoading[bonusId] = false;
        state.bonusDetails[bonusId] = action.payload;
        state.selected = action.payload;
      })
      .addCase(fetchSt8BonusById.rejected, (state, action) => {
        const bonusId = action.meta.arg.bonusId;
        state.bonusDetailsLoading[bonusId] = false;
        state.bonusDetailsError[bonusId] = action.error.message || 'Failed to fetch bonus details';
      })
      .addCase(cancelSt8Bonus.pending, (state, action) => {
        const id = action.meta.arg.bonusId;
        state.cancelling[id] = true;
      })
      .addCase(cancelSt8Bonus.fulfilled, (state, action) => {
        const id = action.payload.bonusId;
        delete state.cancelling[id];
      })
      .addCase(cancelSt8Bonus.rejected, (state, action) => {
        const id = action.meta.arg.bonusId;
        delete state.cancelling[id];
        state.error = action.error.message || 'Unknown error';
      })
      // Local bonuses reducers
      .addCase(fetchLocalSt8Bonuses.pending, (state) => {
        state.localLoading = true;
        state.localError = null;
      })
      .addCase(fetchLocalSt8Bonuses.fulfilled, (state, action: PayloadAction<St8LocalBonus[]>) => {
        state.localLoading = false;
        state.localBonuses = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchLocalSt8Bonuses.rejected, (state, action) => {
        state.localLoading = false;
        state.localError = action.error.message || 'Unknown error';
      })
      // Available offers reducers
      .addCase(fetchAvailableOffers.pending, (state) => {
        state.offersLoading = true;
        state.offersError = null;
      })
      .addCase(
        fetchAvailableOffers.fulfilled,
        (state, action: PayloadAction<St8AvailableOffer[]>) => {
          state.offersLoading = false;
          state.availableOffers = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchAvailableOffers.rejected, (state, action) => {
        state.offersLoading = false;
        state.offersError = action.error.message || 'Unknown error';
      });
  },
});

export default st8BonusSlice.reducer;
