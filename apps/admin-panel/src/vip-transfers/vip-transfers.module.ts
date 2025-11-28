import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserVipStatusEntity, VipTransferSubmissionEntity } from '@zetik/shared-entities';
import { VipTransfersController } from './vip-transfers.controller';
import { VipTransfersService } from './vip-transfers.service';

@Module({
  imports: [TypeOrmModule.forFeature([VipTransferSubmissionEntity, UserVipStatusEntity])],
  controllers: [VipTransfersController],
  providers: [VipTransfersService],
  exports: [VipTransfersService],
})
export class VipTransfersModule {}
