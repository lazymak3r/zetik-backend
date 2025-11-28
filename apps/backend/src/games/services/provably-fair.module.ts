import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BlackjackGameEntity,
  CrashBetEntity,
  DiceBetEntity,
  GameSessionEntity,
  HouseEdgeEntity,
  KenoGameEntity,
  LimboGameEntity,
  MinesGameEntity,
  PlinkoGameEntity,
  RouletteGame,
  SeedPairEntity,
  UserBetEntity,
} from '@zetik/shared-entities';
import { BytesToFloatService } from './bytes-to-float.service';
import { HouseEdgeService } from './house-edge.service';
import { ProvablyFairService } from './provably-fair.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SeedPairEntity,
      DiceBetEntity,
      CrashBetEntity,
      BlackjackGameEntity,
      KenoGameEntity,
      LimboGameEntity,
      MinesGameEntity,
      PlinkoGameEntity,
      RouletteGame,
      GameSessionEntity,
      UserBetEntity,
      HouseEdgeEntity,
    ]),
  ],
  providers: [BytesToFloatService, ProvablyFairService, HouseEdgeService],
  exports: [
    BytesToFloatService,
    ProvablyFairService,
    HouseEdgeService,
    TypeOrmModule.forFeature([
      SeedPairEntity,
      DiceBetEntity,
      CrashBetEntity,
      BlackjackGameEntity,
      KenoGameEntity,
      LimboGameEntity,
      MinesGameEntity,
      PlinkoGameEntity,
      RouletteGame,
      GameSessionEntity,
      UserBetEntity,
      HouseEdgeEntity,
    ]),
  ],
})
export class ProvablyFairModule {}
