import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotImageEntity } from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { UploadModule } from '../upload/upload.module';
import { SlotImagesController } from './slot-images.controller';
import { SlotImagesService } from './slot-images.service';

@Module({
  imports: [AuditModule, UploadModule, TypeOrmModule.forFeature([SlotImageEntity])],
  controllers: [SlotImagesController],
  providers: [SlotImagesService],
  exports: [SlotImagesService],
})
export class SlotImagesModule {}
