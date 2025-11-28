import { api } from '../config/api';
import {
  ICreatePromocode,
  IPromocodeAdminResponse,
  IPromocodeListQuery,
  IUpdatePromocode,
} from '../types/promocode.types';

export const promocodesApi = {
  getPromocodes: (params: IPromocodeListQuery) =>
    api.get<{ data: IPromocodeAdminResponse[]; total: number }>('/promocodes', { params }),

  create: (dto: ICreatePromocode) => api.post<IPromocodeAdminResponse>('/promocodes', dto),

  getDetails: (id: string) => api.get<IPromocodeAdminResponse>(`/promocodes/${id}`),

  update: (id: string, dto: IUpdatePromocode) =>
    api.patch<IPromocodeAdminResponse>(`/promocodes/${id}`, dto),

  getHistory: (id: string) => api.get(`/promocodes/${id}/history`),

  getClaims: (id: string) => api.get(`/promocodes/${id}/claims`),
};
