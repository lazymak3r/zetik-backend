import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Developer, ProviderGame, SlotImageApiResponse } from '../../pages/SlotsManagement/types';
import {
  deleteSlotImage,
  fetchGamesByDeveloper,
  fetchProviders,
  fetchSlotImages,
  updateGameDescription,
  updateProviderEnabled,
  uploadSlotImages,
} from './thunks';

interface SlotsState {
  providers: Developer[];
  providersLoading: boolean;
  providersError: string | null;

  games: Record<string, ProviderGame[]>;
  gamesLoading: Record<string, boolean>;
  gamesError: Record<string, string | null>;

  images: Record<string, SlotImageApiResponse[]>;
  imagesLoading: Record<string, boolean>;
  imagesError: Record<string, string | null>;

  actionLoading: boolean;
  actionError: string | null;
}

const initialState: SlotsState = {
  providers: [],
  providersLoading: false,
  providersError: null,

  games: {},
  gamesLoading: {},
  gamesError: {},

  images: {},
  imagesLoading: {},
  imagesError: {},

  actionLoading: false,
  actionError: null,
};

const slotsSlice = createSlice({
  name: 'slots',
  initialState,
  reducers: {
    clearError: (state) => {
      state.actionError = null;
    },
    clearProvidersError: (state) => {
      state.providersError = null;
    },
    clearGamesError: (state, action: PayloadAction<string>) => {
      state.gamesError[action.payload] = null;
    },
    clearImagesError: (state, action: PayloadAction<string>) => {
      state.imagesError[action.payload] = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviders.pending, (state) => {
        state.providersLoading = true;
        state.providersError = null;
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.providersLoading = false;
        state.providers = action.payload;
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.providersLoading = false;
        state.providersError = action.error.message || 'Failed to fetch providers';
      })
      .addCase(updateProviderEnabled.pending, (state) => {
        state.actionLoading = true;
        state.actionError = null;
      })
      .addCase(updateProviderEnabled.fulfilled, (state, action) => {
        state.actionLoading = false;
        const provider = state.providers.find((p) => p.name === action.payload.name);
        if (provider) {
          provider.enabled = action.payload.enabled;
        }
      })
      .addCase(updateProviderEnabled.rejected, (state, action) => {
        state.actionLoading = false;
        state.actionError = action.error.message || 'Failed to update provider';
      })
      .addCase(fetchGamesByDeveloper.pending, (state, action) => {
        state.gamesLoading[action.meta.arg] = true;
        state.gamesError[action.meta.arg] = null;
      })
      .addCase(fetchGamesByDeveloper.fulfilled, (state, action) => {
        state.gamesLoading[action.meta.arg] = false;
        state.games[action.meta.arg] = action.payload.games;
      })
      .addCase(fetchGamesByDeveloper.rejected, (state, action) => {
        state.gamesLoading[action.meta.arg] = false;
        state.gamesError[action.meta.arg] = action.error.message || 'Failed to fetch games';
      })
      .addCase(fetchSlotImages.pending, (state, action) => {
        state.imagesLoading[action.meta.arg] = true;
        state.imagesError[action.meta.arg] = null;
      })
      .addCase(fetchSlotImages.fulfilled, (state, action) => {
        state.imagesLoading[action.meta.arg] = false;
        state.images[action.payload.directory] = Array.isArray(action.payload.images)
          ? action.payload.images
          : [];
      })
      .addCase(fetchSlotImages.rejected, (state, action) => {
        state.imagesLoading[action.meta.arg] = false;
        state.imagesError[action.meta.arg] = action.error.message || 'Failed to fetch images';
      })
      .addCase(uploadSlotImages.pending, (state) => {
        state.actionLoading = true;
        state.actionError = null;
      })
      .addCase(uploadSlotImages.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.images[action.payload.directory] = Array.isArray(action.payload.images)
          ? action.payload.images
          : [];
      })
      .addCase(uploadSlotImages.rejected, (state, action) => {
        state.actionLoading = false;
        state.actionError = action.error.message || 'Failed to upload images';
      })
      .addCase(deleteSlotImage.pending, (state) => {
        state.actionLoading = true;
        state.actionError = null;
      })
      .addCase(deleteSlotImage.fulfilled, (state, action) => {
        state.actionLoading = false;
        const directory = action.payload.directory;
        if (state.images[directory]) {
          state.images[directory] = state.images[directory].filter(
            (img) => img.key !== action.payload.key,
          );
        }
      })
      .addCase(deleteSlotImage.rejected, (state, action) => {
        state.actionLoading = false;
        state.actionError = action.error.message || 'Failed to delete image';
      })
      .addCase(updateGameDescription.pending, (state) => {
        state.actionLoading = true;
        state.actionError = null;
      })
      .addCase(updateGameDescription.fulfilled, (state, action) => {
        state.actionLoading = false;
        const { code, description } = action.payload;
        Object.keys(state.games).forEach((developerName) => {
          const gameIndex = state.games[developerName].findIndex((g) => g.code === code);
          if (gameIndex !== -1) {
            state.games[developerName][gameIndex].description = description;
          }
        });
      })
      .addCase(updateGameDescription.rejected, (state, action) => {
        state.actionLoading = false;
        state.actionError = action.error.message || 'Failed to update game description';
      });
  },
});

export const { clearError, clearProvidersError, clearGamesError, clearImagesError } =
  slotsSlice.actions;
export default slotsSlice.reducer;
