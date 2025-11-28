import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../config/api';
import {
  Developer,
  GamesProvidersApiResponse,
  ProviderGame,
  SlotImageApiResponse,
} from '../../pages/SlotsManagement/types';

export const fetchProviders = createAsyncThunk('slots/fetchProviders', async () => {
  const { data } = await api.get<GamesProvidersApiResponse>('/provider-games/developers');
  const zetikOriginals: Developer = {
    name: 'Zetik Originals',
    code: 'zetik',
    gamesCount: 8,
    enabled: true,
  };
  return [zetikOriginals, ...data.developers];
});

export const updateProviderEnabled = createAsyncThunk(
  'slots/updateProviderEnabled',
  async ({ name, enabled }: { name: string; enabled: boolean }) => {
    await api.patch(`/provider-games/developers/${encodeURIComponent(name)}`, { enabled });
    return { name, enabled };
  },
);

export const fetchSlotImages = createAsyncThunk(
  'slots/fetchSlotImages',
  async (directory: string) => {
    const { data } = await api.get<SlotImageApiResponse[]>('/slot-images/list', {
      params: { directory },
    });
    return { directory, images: data };
  },
);

export const fetchGamesByDeveloper = createAsyncThunk(
  'slots/fetchGamesByDeveloper',
  async (developerName: string) => {
    const { data } = await api.get<ProviderGame[]>('/provider-games/games', {
      params: { developerName },
    });
    return { developerName, games: data };
  },
);

export const uploadSlotImages = createAsyncThunk(
  'slots/uploadSlotImages',
  async ({ formData, directory }: { formData: FormData; directory: string }) => {
    const { data } = await api.post<SlotImageApiResponse[]>('/slot-images/upload/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { directory, images: data };
  },
);

export const deleteSlotImage = createAsyncThunk(
  'slots/deleteSlotImage',
  async ({ key, directory }: { key: string; directory: string }) => {
    await api.delete('/slot-images/bulk', { data: { keys: [key] } });
    return { key, directory };
  },
);

export const updateGameDescription = createAsyncThunk(
  'slots/updateGameDescription',
  async ({ code, description }: { code: string; description: string | null }) => {
    await api.patch(`/provider-games/games/${encodeURIComponent(code)}`, { description });
    return { code, description };
  },
);
