import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedPairEntity } from '@zetik/shared-entities';
import { AuditModule } from '../audit/audit.module';
import { ProvablyFairController } from './provably-fair.controller';
import { ProvablyFairService } from './provably-fair.service';

@Module({
  imports: [TypeOrmModule.forFeature([SeedPairEntity]), AuditModule],
  controllers: [ProvablyFairController],
  providers: [ProvablyFairService],
  exports: [ProvablyFairService],
})
export class ProvablyFairModule {}
