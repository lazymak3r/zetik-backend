export interface SeedPair {
  id: string;
  userId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  nextServerSeed: string;
  nextServerSeedHash: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SeedPairsListResponse {
  seedPairs: SeedPair[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface UpdateSeedPairDto {
  serverSeed?: string;
  clientSeed?: string;
  nonce?: number;
  nextServerSeed?: string;
  nextServerSeedHash?: string;
}

export interface RotateSeedPairDto {
  clientSeed: string;
}

export interface RotateSeedPairResponse {
  old: SeedPair;
  new: SeedPair;
}
