import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateCampaignEntity, AffiliateCommissionEntity } from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AffiliateCampaignEntity, AffiliateCommissionEntity]),
    AuditModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
