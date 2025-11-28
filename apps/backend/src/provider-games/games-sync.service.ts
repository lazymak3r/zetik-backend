import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { ICategoryEntity } from './interfaces/category.interface';
import { IDeveloperEntity } from './interfaces/developer.interface';
import { IGameEntity } from './interfaces/game.interface';
import { St8Service } from './st8.service';

@Injectable()
export class GamesSyncService {
  private readonly logger = new Logger(GamesSyncService.name);

  constructor(
    private readonly st8Service: St8Service,
    @InjectRepository(ProviderGameEntity)
    private readonly gameRepository: Repository<ProviderGameEntity>,
    @InjectRepository(ProviderDeveloperEntity)
    private readonly developerRepository: Repository<ProviderDeveloperEntity>,
    @InjectRepository(ProviderCategoryEntity)
    private readonly categoryRepository: Repository<ProviderCategoryEntity>,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncGames(): Promise<void> {
    this.logger.log('Starting games synchronization');

    try {
      const gamesData = await this.st8Service.getGames();

      if (gamesData.status !== 'ok') {
        this.logger.error('Failed to get games data from ST8');
        return;
      }

      await this.syncDevelopers(gamesData.developers);
      await this.syncCategories(gamesData.categories);
      await this.syncGamesData(gamesData.games);

      this.logger.log('Games synchronization completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? String(error.stack).substring(0, 1500) : String(error);
      this.logger.error(`Error during games synchronization: ${errorMessage}`);
    }
  }

  private async syncDevelopers(
    developers: Array<{
      name: string;
      code: string;
      restricted_territories: string[];
      prohibited_territories: string[];
    }>,
  ): Promise<void> {
    this.logger.log(`Synchronizing ${developers.length} developers`);

    // Process developers in batches to avoid blocking event loop
    const BATCH_SIZE = 10;

    for (let i = 0; i < developers.length; i += BATCH_SIZE) {
      const batch = developers.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batch.map(async (dev) => {
        return this.developerRepository.save({
          code: dev.code,
          name: dev.name,
          restrictedTerritories: dev.restricted_territories,
          prohibitedTerritories: dev.prohibited_territories,
        } as IDeveloperEntity);
      });

      await Promise.all(batchPromises);

      // Yield control to event loop between batches
      if (i + BATCH_SIZE < developers.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  private async syncCategories(
    categories: Array<{
      name: string;
      type: string;
    }>,
  ): Promise<void> {
    this.logger.log(`Synchronizing ${categories.length} categories`);

    // Process categories in batches to avoid blocking event loop
    const BATCH_SIZE = 10;

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      const batch = categories.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batch.map(async (cat) => {
        return this.categoryRepository.save({
          type: cat.type,
          name: cat.name,
        } as ICategoryEntity);
      });

      await Promise.all(batchPromises);

      // Yield control to event loop between batches
      if (i + BATCH_SIZE < categories.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  private async syncGamesData(
    games: Array<{
      code: string;
      name: string;
      enabled: boolean;
      developer: string;
      bonus_types: string[];
      category: string;
      themes: string[];
      features: string[];
      rtp: number | null;
      volatility: number | null;
      max_payout_coeff: string;
      hit_ratio: string;
      fun_mode: boolean;
      release_date: string | null;
      deprecation_date: string | null;
      restricted_territories: string[];
      prohibited_territories: string[];
    }>,
  ): Promise<void> {
    this.logger.log(`Synchronizing ${games.length} games`);

    // Process games in smaller batches to avoid blocking event loop
    const BATCH_SIZE = 5; // Smaller batch size due to DB lookups per game

    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batch.map(async (game) => {
        try {
          // Check if a developer exists first
          const developer = await this.developerRepository.findOne({
            where: { name: game.developer },
          });

          if (!developer) {
            this.logger.warn(`Developer ${game.developer} not found, skipping game ${game.code}`);
            return null;
          }

          // Check if a category exists
          const category = await this.categoryRepository.findOne({
            where: { name: game.category },
          });

          if (!category) {
            this.logger.warn(`Category ${game.category} not found, skipping game ${game.code}`);
            return null;
          }

          return this.gameRepository.save({
            code: game.code,
            name: game.name,
            enabled: game.enabled,
            developerName: game.developer,
            categoryName: game.category,
            bonusTypes: game.bonus_types,
            themes: game.themes,
            features: game.features,
            rtp: game.rtp && String(game.rtp),
            houseEdge: game.rtp ? String(100 - game.rtp) : '1.00',
            volatility: game.volatility && String(game.volatility),
            maxPayoutCoeff: game.max_payout_coeff,
            hitRatio: game.hit_ratio,
            funMode: game.fun_mode,
            releaseDate: game.release_date ? new Date(game.release_date) : null,
            deprecationDate: game.deprecation_date ? new Date(game.deprecation_date) : null,
            restrictedTerritories: game.restricted_territories,
            prohibitedTerritories: game.prohibited_territories,
          } as IGameEntity);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.stack : String(error);
          this.logger.error(`Error saving game ${game.code}: ${errorMessage}`);
          return null;
        }
      });

      await Promise.all(batchPromises);

      // Yield control to event loop between batches
      if (i + BATCH_SIZE < games.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  }

  // Method to manually trigger synchronization
  async triggerSync(): Promise<void> {
    this.logger.log('Manually triggering games synchronization');
    return this.syncGames();
  }
}
