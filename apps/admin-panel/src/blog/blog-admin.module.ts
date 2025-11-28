import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogArticleEntity } from '@zetik/shared-entities';
import { BlogAdminController } from './blog-admin.controller';
import { BlogAdminService } from './blog-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlogArticleEntity])],
  controllers: [BlogAdminController],
  providers: [BlogAdminService],
  exports: [BlogAdminService],
})
export class BlogAdminModule {}
