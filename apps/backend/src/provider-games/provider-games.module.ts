import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminEntity,
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
  ProviderGameSessionEntity,
  St8BonusEntity,
  UserProviderGameFavoritesEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../balance/balance.module';
import { GamesModule } from '../games/games.module';
import { UsersModule } from '../users/users.module';
import { GameSessionService } from './game-session.service';
import { GamesSyncService } from './games-sync.service';
import { ProviderGamesController } from './provider-games.controller';
import { ProviderGamesService } from './provider-games.service';
import { ProviderFavoritesService } from './services/provider-favorites.service';
import { ProviderHouseEdgeService } from './services/provider-house-edge.service';
import { St8ApiClient } from './st8-api-client.service';
import { St8BonusSchedulerService } from './st8-bonus-scheduler.service';
import { St8BonusController } from './st8-bonus.controller';
import { St8BonusService } from './st8-bonus.service';
import { St8Controller } from './st8.controller';
import { St8Service } from './st8.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        ProviderGameEntity,
        ProviderDeveloperEntity,
        ProviderCategoryEntity,
        ProviderGameSessionEntity,
        UserProviderGameFavoritesEntity,
        St8BonusEntity,
        AdminEntity,
      ],
      'default',
    ),
    BalanceModule,
    UsersModule,
    /**
     * Circular dependency: ProviderGamesModule ⇄ GamesModule
     *
     * Why needed:
     * - St8Service emits 'user-bet.created' events for provider game bets
     * - UserBetService (in GamesModule) listens to these events and publishes to Redis pub/sub
     * - BetFeedService (microservice) subscribes to Redis and updates bet feed cache
     * - GamesModule may also depend on ProviderGamesModule for provider game data
     *
     * Using forwardRef resolves circular dependency at runtime without breaking module initialization.
     * This is acceptable as the coupling is via event emission (loose coupling) rather than direct service calls.
     *
     * Architecture: St8Service → EventEmitter2 → UserBetService → Redis pub/sub → BetFeedService
     */
    forwardRef(() => GamesModule),
  ],
  controllers: [ProviderGamesController, St8Controller, St8BonusController],
  providers: [
    St8ApiClient,
    St8Service,
    St8BonusService,
    St8BonusSchedulerService,
    GamesSyncService,
    ProviderGamesService,
    GameSessionService,
    ProviderFavoritesService,
    ProviderHouseEdgeService,
  ],
  exports: [
    St8Service,
    St8BonusService,
    GamesSyncService,
    ProviderGamesService,
    GameSessionService,
    ProviderFavoritesService,
  ],
})
export class ProviderGamesModule {}
