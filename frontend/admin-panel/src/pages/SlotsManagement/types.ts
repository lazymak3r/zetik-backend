export interface ImageItem {
  id: string;
  key: string;
  src: string;
  name: string;
  sizeBytes: number;
  format: string;
  createdAt: string;
  folder: string;
  description?: string | null;
  gameCode?: string;
}

export interface GamesProvidersApiResponse {
  developers: Developer[];
}

export interface Developer {
  name: string;
  code: string;
  gamesCount?: number;
  enabled: boolean;
}

export interface ProviderGame {
  code: string;
  name: string;
  description?: string | null;
}

export interface SlotImageApiResponse {
  id: string;
  directory: string;
  fileName: string;
  key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}
