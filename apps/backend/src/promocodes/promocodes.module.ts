import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  BonusVipTierEntity,
  PromocodeClaimEntity,
  PromocodeEntity,
  UserEntity,
  UserVerificationEntity,
  UserVipStatusEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../balance/balance.module';
import { PromocodesController } from './controllers/promocodes.controller';
import { PromocodeEligibilityService } from './services/promocode-eligibility.service';
import { PromocodesSchedulerService } from './services/promocodes-scheduler.service';
import { PromocodesService } from './services/promocodes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromocodeEntity,
      PromocodeClaimEntity,
      UserEntity,
      UserVipStatusEntity,
      UserVerificationEntity,
      AffiliateCampaignEntity,
      BonusVipTierEntity,
    ]),
    BalanceModule,
  ],
  providers: [PromocodesService, PromocodeEligibilityService, PromocodesSchedulerService],
  controllers: [PromocodesController],
  exports: [PromocodesService],
})
export class PromocodesModule {}
