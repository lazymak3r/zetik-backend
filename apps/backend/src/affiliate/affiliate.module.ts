import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  AffiliateCommissionEntity,
  AffiliateCommissionHistoryEntity,
  AffiliateEarningsEntity,
  AffiliateWalletEntity,
  RaceEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { BalanceModule } from '../balance/balance.module';
import { BonusesModule } from '../bonus/bonuses.module';
import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { UsersModule } from '../users/users.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AffiliateAdminController } from './affiliate-admin.controller';
import { AffiliateAdminService } from './affiliate-admin.service';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { AffiliateRaceController } from './controllers/affiliate-race.controller';
import { AffiliateRaceService } from './services/affiliate-race.service';
import { AffiliateWalletService } from './services/affiliate-wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateCampaignEntity,
      AffiliateCommissionEntity,
      AffiliateCommissionHistoryEntity,
      AffiliateEarningsEntity,
      AffiliateWalletEntity,
      RaceEntity,
      UserEntity,
    ]),
    forwardRef(() => BalanceModule),
    forwardRef(() => BonusesModule),
    forwardRef(() => WebSocketModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [AffiliateController, AffiliateAdminController, AffiliateRaceController],
  providers: [
    AffiliateCommissionService,
    AffiliateService,
    AffiliateAdminService,
    AffiliateRaceService,
    AffiliateWalletService,
  ],
  exports: [
    AffiliateCommissionService,
    AffiliateService,
    AffiliateAdminService,
    AffiliateRaceService,
  ],
})
export class AffiliateModule {}
