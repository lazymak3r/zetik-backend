import { api } from '../config/api';

export interface St8BonusOffer {
  bonus_id: string;
  type: 'free_bets' | 'free_money' | 'bonus_game';
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
}

export interface FetchOffersParams {
  game_codes?: string;
  currency?: string;
  type?: 'free_bets' | 'free_money' | 'bonus_game';
  site?: string;
}

export interface St8Game {
  code: string;
  name: string;
  enabled: boolean;
  developerName: string;
  categoryName: string;
  bonusTypes?: string[] | null;
  themes?: string[] | null;
  features?: string[] | null;
  rtp?: string | null;
  houseEdge: string;
  volatility?: string | null;
  maxPayoutCoeff?: string | null;
  hitRatio?: string | null;
  funMode: boolean;
  releaseDate: string | null;
  deprecationDate?: string | null;
  restrictedTerritories?: string[] | null;
  prohibitedTerritories?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface St8LocalBonus {
  bonus_id: string;
  gameCodes?: string[];
  type: 'free_bets' | 'free_money' | 'bonus_game';
  status: 'processing' | 'finished' | 'error' | 'canceled' | 'expired';
  value: string;
  currency: string;
  players?: string[];
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
  createdByAdmin?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface St8AvailableOffer {
  type: 'free_bets' | 'free_money' | 'bonus_game';
  value: string;
  currency: string;
}

export interface St8BonusInstance {
  instance_id: string;
  player: string;
  status: string;
  cancel_status: string | null;
  start_time: string;
  end_time: string;
}

export interface St8BonusDetailsResponse {
  status: 'ok' | 'error';
  bonus: {
    bonus_id: string;
    site?: string;
    game_codes: string[];
    value: string;
    currency: string;
    count?: number;
    type: 'free_bets' | 'free_money' | 'bonus_game';
    status: string;
    instances: St8BonusInstance[];
  };
}

export interface FetchLocalBonusesParams {
  gameCode?: string;
  type?: 'free_bets' | 'free_money' | 'bonus_game';
  currency?: string;
  status?: 'processing' | 'finished' | 'error' | 'canceled' | 'expired';
  createdByAdminId?: string;
  limit?: number;
  offset?: number;
}

export const st8BonusApi = {
  getGames: () => api.get<St8Game[]>('/st8/bonus/games'),

  getOffers: (params: FetchOffersParams) =>
    api.get<{ status?: string; offers?: St8BonusOffer[] } | St8BonusOffer[]>('/st8/bonus/offers', {
      params,
    }),

  create: (payload: Record<string, unknown>) => api.post(`/st8/bonus`, payload),

  getById: (bonusId: string, site?: string) =>
    api.get(`/st8/bonus/${encodeURIComponent(bonusId)}`, { params: site ? { site } : undefined }),

  cancel: (bonusId: string, payload?: { site?: string; players?: string[] }) =>
    api.post(`/st8/bonus/${encodeURIComponent(bonusId)}/cancel`, payload),

  getLocalBonuses: (params: FetchLocalBonusesParams) =>
    api.get<St8LocalBonus[]>('/st8/bonus/local', { params }),

  getAvailableOffers: (gameCodes: string[], type?: string) =>
    api.get<St8AvailableOffer[]>(`/st8/bonus/offers`, {
      params: {
        game_codes: gameCodes.join(','),
        type,
      },
    }),
};
