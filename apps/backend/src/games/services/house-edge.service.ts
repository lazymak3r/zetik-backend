import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HouseEdgeEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class HouseEdgeService implements OnModuleInit {
  private readonly logger = new Logger(HouseEdgeService.name);
  private edges = new Map<string, number>();
  private readonly ttlMs = 30 * 60 * 1000;
  // Games that must have a configured house edge
  private static readonly REQUIRED_EDGE_GAMES: readonly string[] = [
    'crash',
    'dice',
    'plinko',
    'limbo',
    'mines',
    'keno',
  ] as const;

  constructor(
    @InjectRepository(HouseEdgeEntity)
    private readonly houseEdgeRepo: Repository<HouseEdgeEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadEdges();
    this.validateRequiredEdges();
    setInterval(() => {
      void this.refreshEdges();
    }, this.ttlMs);
  }

  private async loadEdges(): Promise<void> {
    try {
      const records = await this.houseEdgeRepo.find();
      this.edges.clear();
      records.forEach(({ game, edge }) => this.edges.set(game, Number(edge)));
      this.logger.log(`Loaded ${this.edges.size} house edge records`);
    } catch (error) {
      this.logger.error('Error loading house edges', error);
    }
  }

  private async refreshEdges(): Promise<void> {
    this.logger.log('Refreshing house edge cache');
    await this.loadEdges();
    // Optional: warn (do not crash) if edges become invalid during runtime
    try {
      this.validateRequiredEdges(true);
    } catch (error) {
      // Do not rethrow during periodic refresh; only warn
      this.logger.error('House edge validation failed during refresh', error);
    }
  }

  getEdge(game: string): number | undefined {
    return this.edges.get(game);
  }

  getAllEdges(): Record<string, number> {
    const result: Record<string, number> = {};
    this.edges.forEach((value, key) => (result[key] = value));
    return result;
  }

  private validateRequiredEdges(warnOnly = false): void {
    const missingOrInvalid: { game: string; value: number | undefined }[] = [];
    for (const game of HouseEdgeService.REQUIRED_EDGE_GAMES) {
      const value = this.edges.get(game);
      if (value === undefined || value === null || Number.isNaN(value) || value < 1.0) {
        missingOrInvalid.push({ game, value });
      }
    }

    if (missingOrInvalid.length > 0) {
      const details = missingOrInvalid
        .map(({ game, value }) => `${game}=${value ?? 'undefined'}`)
        .join(', ');
      const message = `House edge validation failed. Required games must have edge >= 1.0%. Invalid: ${details}`;

      if (warnOnly) {
        this.logger.error(message);
        return;
      }

      // Crash startup to avoid running with exploitable RTP
      throw new Error(message);
    }

    this.logger.log(
      `House edge validation passed for required games: ${HouseEdgeService.REQUIRED_EDGE_GAMES.join(
        ', ',
      )}`,
    );
  }
}
