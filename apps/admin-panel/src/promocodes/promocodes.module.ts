import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminEntity,
  PromocodeAuditEntity,
  PromocodeClaimEntity,
  PromocodeEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { PromocodesAdminController } from './controllers/promocodes-admin.controller';
import { PromocodesAdminService } from './services/promocodes-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromocodeEntity,
      PromocodeClaimEntity,
      PromocodeAuditEntity,
      AdminEntity,
      UserEntity,
    ]),
    AuditModule,
  ],
  providers: [PromocodesAdminService],
  controllers: [PromocodesAdminController],
  exports: [PromocodesAdminService],
})
export class PromocodesModule {}
