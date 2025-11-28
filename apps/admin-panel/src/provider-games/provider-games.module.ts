import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
} from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { ProviderGamesController } from './provider-games.controller';
import { ProviderGamesService } from './provider-games.service';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([ProviderDeveloperEntity, ProviderGameEntity, ProviderCategoryEntity]),
  ],
  controllers: [ProviderGamesController],
  providers: [ProviderGamesService],
  exports: [ProviderGamesService],
})
export class ProviderGamesModule {}
