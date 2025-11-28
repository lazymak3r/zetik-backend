import { api } from '../config/api';
import {
  RotateSeedPairDto,
  RotateSeedPairResponse,
  SeedPair,
  SeedPairsListResponse,
  UpdateSeedPairDto,
} from '../types/provably-fair.types';

/**
 * Service for managing provably fair seed pairs via admin panel
 */
class ProvablyFairService {
  /**
   * Get all seed pairs for a user with pagination
   */
  async getSeedPairs(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<SeedPairsListResponse> {
    const response = await api.get<SeedPairsListResponse>(
      `/provably-fair/users/${userId}/seed-pairs`,
      {
        params: { page, limit },
      },
    );
    return response.data;
  }

  /**
   * Get the active seed pair for a user
   */
  async getActiveSeedPair(userId: string): Promise<SeedPair | null> {
    const response = await api.get<SeedPair | null>(
      `/provably-fair/users/${userId}/seed-pairs/active`,
    );
    return response.data;
  }

  /**
   * Get a specific seed pair by ID
   */
  async getSeedPair(userId: string, seedPairId: number): Promise<SeedPair> {
    const response = await api.get<SeedPair>(
      `/provably-fair/users/${userId}/seed-pairs/${seedPairId}`,
    );
    return response.data;
  }

  /**
   * Update a seed pair
   */
  async updateSeedPair(
    userId: string,
    seedPairId: number,
    data: UpdateSeedPairDto,
  ): Promise<SeedPair> {
    const response = await api.patch<SeedPair>(
      `/provably-fair/users/${userId}/seed-pairs/${seedPairId}`,
      data,
    );
    return response.data;
  }

  /**
   * Force rotate to a new seed pair
   */
  async rotateSeedPair(userId: string, clientSeed: string): Promise<RotateSeedPairResponse> {
    const response = await api.post<RotateSeedPairResponse>(
      `/provably-fair/users/${userId}/seed-pairs/rotate`,
      { clientSeed } as RotateSeedPairDto,
    );
    return response.data;
  }
}

export const provablyFairService = new ProvablyFairService();
