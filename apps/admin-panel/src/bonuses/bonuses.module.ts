import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BonusTransactionEntity, WeeklyRacePrizeEntity } from '@zetik/shared-entities';
import { BonusesController } from './bonuses.controller';
import { BonusesService } from './bonuses.service';

@Module({
  imports: [TypeOrmModule.forFeature([BonusTransactionEntity, WeeklyRacePrizeEntity])],
  controllers: [BonusesController],
  providers: [BonusesService],
  exports: [BonusesService],
})
export class BonusesModule {}
