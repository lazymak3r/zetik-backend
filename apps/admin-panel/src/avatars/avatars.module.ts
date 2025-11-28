import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefaultAvatarEntity } from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { UploadModule } from '../upload/upload.module';
import { DefaultAvatarsController } from './default-avatars.controller';
import { DefaultAvatarsService } from './default-avatars.service';

@Module({
  imports: [TypeOrmModule.forFeature([DefaultAvatarEntity]), AuditModule, UploadModule],
  controllers: [DefaultAvatarsController],
  providers: [DefaultAvatarsService],
  exports: [DefaultAvatarsService],
})
export class AvatarsModule {}
