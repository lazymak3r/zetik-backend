import { createAsyncThunk } from '@reduxjs/toolkit';
import { promocodesApi } from '../../services/promocodesService';
import {
  ICreatePromocode,
  IPromocodeListQuery,
  IUpdatePromocode,
} from '../../types/promocode.types';

export const fetchPromocodes = createAsyncThunk(
  'promocodes/fetchPromocodes',
  async (query: IPromocodeListQuery) => {
    const response = await promocodesApi.getPromocodes(query);
    return response.data;
  },
);

export const createPromocode = createAsyncThunk(
  'promocodes/createPromocode',
  async (dto: ICreatePromocode) => {
    const response = await promocodesApi.create(dto);
    return response.data;
  },
);

export const updatePromocode = createAsyncThunk(
  'promocodes/updatePromocode',
  async ({ id, dto }: { id: string; dto: IUpdatePromocode }) => {
    const response = await promocodesApi.update(id, dto);
    return response.data;
  },
);

export const pausePromocode = createAsyncThunk('promocodes/pausePromocode', async (id: string) => {
  const response = await promocodesApi.update(id, { status: 'PAUSED' });
  return response.data;
});

export const resumePromocode = createAsyncThunk(
  'promocodes/resumePromocode',
  async (id: string) => {
    const response = await promocodesApi.update(id, { status: 'ACTIVE' });
    return response.data;
  },
);

export const cancelPromocode = createAsyncThunk(
  'promocodes/cancelPromocode',
  async (id: string) => {
    const response = await promocodesApi.update(id, { status: 'CANCELLED' });
    return response.data;
  },
);

export const getPromocodeDetails = createAsyncThunk(
  'promocodes/getPromocodeDetails',
  async (id: string) => {
    const response = await promocodesApi.getDetails(id);
    return response.data;
  },
);

export const getPromocodeHistory = createAsyncThunk(
  'promocodes/getPromocodeHistory',
  async (id: string) => {
    const response = await promocodesApi.getHistory(id);
    return response.data;
  },
);

export const getPromocodeClaims = createAsyncThunk(
  'promocodes/getPromocodeClaims',
  async (id: string) => {
    const response = await promocodesApi.getClaims(id);
    return response.data;
  },
);
