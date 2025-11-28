import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProviderGameEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class ProviderHouseEdgeService {
  private readonly logger = new Logger(ProviderHouseEdgeService.name);
  private houseEdgeCache = new Map<string, number>();

  constructor(
    @InjectRepository(ProviderGameEntity)
    private readonly providerGameRepository: Repository<ProviderGameEntity>,
  ) {}

  /**
   * Get house edge for provider game by game code
   * Returns cached value if available, otherwise fetches from database
   * Returns default 1% (0.01) if game not found
   */
  async getHouseEdgeByGameCode(gameCode: string): Promise<number> {
    try {
      // Check cache first
      if (this.houseEdgeCache.has(gameCode)) {
        return this.houseEdgeCache.get(gameCode) || 0.01;
      }

      // Fetch from database
      const providerGame = await this.providerGameRepository.findOne({
        where: { code: gameCode, enabled: true },
        select: ['houseEdge'],
      });

      let houseEdgeDecimal = 0.01; // Default 1%

      if (providerGame?.houseEdge) {
        const houseEdge = parseFloat(providerGame.houseEdge);

        if (!isNaN(houseEdge) && houseEdge > 0) {
          // Convert percentage to decimal (e.g., 2.50 -> 0.025)
          houseEdgeDecimal = houseEdge / 100;
          this.logger.debug(
            `Provider game ${gameCode} house edge: ${houseEdge}% (${houseEdgeDecimal})`,
          );
        } else {
          this.logger.warn(
            `Invalid house edge for provider game ${gameCode}: ${providerGame.houseEdge}, using default 1%`,
          );
        }
      } else {
        this.logger.debug(
          `Provider game ${gameCode} not found in database, using default 1% house edge`,
        );
      }

      // Cache the result (either from DB or default)
      this.houseEdgeCache.set(gameCode, houseEdgeDecimal);
      return houseEdgeDecimal;
    } catch (error) {
      this.logger.error(
        `Failed to get house edge for provider game ${gameCode}, using default 1%:`,
        error,
      );
      // Cache default value to prevent repeated DB calls
      this.houseEdgeCache.set(gameCode, 0.01);
      return 0.01;
    }
  }

  /**
   * Clear house edge cache (useful for admin updates)
   */
  clearCache(): void {
    this.houseEdgeCache.clear();
    this.logger.debug('Provider house edge cache cleared');
  }

  /**
   * Clear cache for specific game code
   */
  clearCacheForGame(gameCode: string): void {
    this.houseEdgeCache.delete(gameCode);
    this.logger.debug(`Provider house edge cache cleared for game: ${gameCode}`);
  }
}
