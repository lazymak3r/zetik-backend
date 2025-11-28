import { forwardRef, Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBetEntity, UserRecentGamesEntity } from '@zetik/shared-entities';
import { BalanceModule } from '../../balance/balance.module';
import { CommonModule } from '../../common/common.module';
import { UserBetService } from './user-bet.service';
import { UserRecentGamesService } from './user-recent-games.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserBetEntity, UserRecentGamesEntity]),
    ScheduleModule,
    forwardRef(() => BalanceModule),
    forwardRef(() => CommonModule),
  ],
  providers: [UserBetService, UserRecentGamesService],
  exports: [UserBetService, UserRecentGamesService],
})
export class UserBetModule {}
