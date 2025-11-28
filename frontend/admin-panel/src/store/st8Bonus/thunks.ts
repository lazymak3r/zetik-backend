import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  FetchLocalBonusesParams,
  St8AvailableOffer,
  st8BonusApi,
  St8BonusDetailsResponse,
  St8BonusOffer,
  St8Game,
  St8LocalBonus,
} from '../../services/st8BonusService';
import { parseErrorMessage } from '../../utils/parseError';

export const fetchSt8Games = createAsyncThunk<St8Game[]>('st8Bonus/fetchGames', async () => {
  try {
    const res = await st8BonusApi.getGames();
    return res.data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to load games');
  }
});

export const fetchSt8Offers = createAsyncThunk(
  'st8Bonus/fetchOffers',
  async (params: {
    game_codes?: string;
    currency?: string;
    type?: 'free_bets' | 'free_money' | 'bonus_game';
    site?: string;
  }) => {
    try {
      const res = await st8BonusApi.getOffers(params);
      const data = res.data as { status?: string; offers?: St8BonusOffer[] } | St8BonusOffer[];

      if (data && typeof data === 'object' && 'status' in data && data.status === 'error') {
        const errorMsg =
          (data as any).error || (data as any).message || 'ST8 API returned error status';
        throw new Error(errorMsg);
      }

      return data;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to load offers');
    }
  },
);

export const createSt8Bonus = createAsyncThunk(
  'st8Bonus/create',
  async (payload: Record<string, unknown>) => {
    try {
      const res = await st8BonusApi.create(payload);
      const data = res.data;

      if (data && typeof data === 'object' && 'status' in data && data.status === 'error') {
        const errorMsg = data.error || data.message || 'ST8 API returned error status';
        throw new Error(errorMsg);
      }

      return data;
    } catch (err: any) {
      const errorMessage = parseErrorMessage(err);
      throw new Error(errorMessage || 'Failed to create bonus');
    }
  },
);

export const fetchSt8BonusById = createAsyncThunk<
  St8BonusDetailsResponse,
  { bonusId: string; site?: string }
>('st8Bonus/fetchById', async (params: { bonusId: string; site?: string }) => {
  try {
    const res = await st8BonusApi.getById(params.bonusId, params.site);
    const data = res.data as St8BonusDetailsResponse;

    if (data && typeof data === 'object' && 'status' in data && data.status === 'error') {
      const errorMsg =
        (data as any).error || (data as any).message || 'ST8 API returned error status';
      throw new Error(errorMsg);
    }

    return data;
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to fetch bonus');
  }
});

export const cancelSt8Bonus = createAsyncThunk(
  'st8Bonus/cancel',
  async (payload: { bonusId: string; site?: string; players?: string[] }) => {
    try {
      const res = await st8BonusApi.cancel(payload.bonusId, {
        site: payload.site,
        players: payload.players,
      });
      const data = res.data;

      if (data && typeof data === 'object' && 'status' in data && data.status === 'error') {
        const errorMsg = data.error || data.message || 'ST8 API returned error status';
        throw new Error(errorMsg);
      }

      return { bonusId: payload.bonusId, data };
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to cancel bonus');
    }
  },
);

export const fetchLocalSt8Bonuses = createAsyncThunk<St8LocalBonus[], FetchLocalBonusesParams>(
  'st8Bonus/fetchLocalBonuses',
  async (params = {}) => {
    try {
      const res = await st8BonusApi.getLocalBonuses(params);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to load local bonuses');
    }
  },
);

export const fetchAvailableOffers = createAsyncThunk<
  St8AvailableOffer[],
  { gameCodes: string[]; type?: string }
>('st8Bonus/fetchAvailableOffers', async ({ gameCodes, type }) => {
  try {
    const res = await st8BonusApi.getAvailableOffers(gameCodes, type);
    const data = res.data;

    if (data && typeof data === 'object' && 'status' in data && data.status === 'error') {
      const errorMsg =
        (data as any).error || (data as any).message || 'ST8 API returned error status';
      throw new Error(errorMsg);
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object' && 'offers' in data) {
      const offersData = data as { offers?: St8AvailableOffer[] };
      if (Array.isArray(offersData.offers)) {
        return offersData.offers;
      }
    }

    if (data && typeof data === 'object' && 'status' in data && 'offers' in data) {
      const statusData = data as { status?: string; offers?: St8AvailableOffer[] };
      if (Array.isArray(statusData.offers)) {
        return statusData.offers;
      }
    }

    return [];
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to load available offers');
  }
});
