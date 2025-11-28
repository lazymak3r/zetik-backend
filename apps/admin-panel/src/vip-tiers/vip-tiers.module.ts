import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BonusVipTierEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { VipTiersController } from './vip-tiers.controller';
import { VipTiersService } from './vip-tiers.service';

@Module({
  imports: [TypeOrmModule.forFeature([BonusVipTierEntity, UserVipStatusEntity]), AuditModule],
  controllers: [VipTiersController],
  providers: [VipTiersService],
  exports: [VipTiersService],
})
export class VipTiersModule {}
