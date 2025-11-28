import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
} from '@zetik/shared-entities';
import { AdminPanelGamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameConfigEntity, GameBetLimitsEntity, GameBetTypeLimitsEntity]),
  ],
  controllers: [AdminPanelGamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class AdminGamesModule {
  constructor() {}
}
