import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminEntity,
  ApiKeyEntity,
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  SystemSettingEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { AuthModule } from '../auth/auth.module';
import { GamesService } from '../games/games.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSettingEntity,
      AdminEntity,
      ApiKeyEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
      UserEntity,
    ]),
    AuthModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, GamesService],
  exports: [SettingsService],
})
export class SettingsModule {}
