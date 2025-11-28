import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  KenoGameEntity,
  UserBetEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../../balance/balance.module';
import { BonusesModule } from '../../bonus/bonuses.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { ProvablyFairModule } from '../services/provably-fair.module';
import { UserBetService } from '../services/user-bet.service';
import { KenoController } from './keno.controller';
import { KenoService } from './keno.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KenoGameEntity,
      UserBetEntity,
      GameConfigEntity,
      GameBetLimitsEntity,
      GameBetTypeLimitsEntity,
    ]),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => UsersModule),
    ProvablyFairModule,
    forwardRef(() => CommonModule),
  ],
  controllers: [KenoController],
  providers: [KenoService, UserBetService, GameConfigService, FiatPreservationService],
  exports: [KenoService],
})
export class KenoModule {}
