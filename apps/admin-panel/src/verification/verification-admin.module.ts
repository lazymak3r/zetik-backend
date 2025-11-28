import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserVerificationEntity,
  VerificationBasicInfoEntity,
  VerificationDocumentEntity,
} from '@zetik/shared-entities';
import { VerificationAdminController } from './verification-admin.controller';
import { VerificationAdminService } from './verification-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserVerificationEntity,
      VerificationDocumentEntity,
      VerificationBasicInfoEntity,
    ]),
  ],
  controllers: [VerificationAdminController],
  providers: [VerificationAdminService],
  exports: [VerificationAdminService],
})
export class VerificationAdminModule {}
