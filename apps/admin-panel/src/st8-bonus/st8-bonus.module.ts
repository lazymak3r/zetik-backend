import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderGameEntity } from '@zetik/shared-entities';
import { St8BonusController } from './st8-bonus.controller';
import { St8BonusService } from './st8-bonus.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ProviderGameEntity])],
  controllers: [St8BonusController],
  providers: [St8BonusService],
  exports: [St8BonusService],
})
export class St8BonusModule {}
