import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelfExclusionEntity } from '@zetik/shared-entities';
import { SelfExclusionTestingController } from './self-exclusion-testing.controller';
import { SelfExclusionTestingService } from './self-exclusion-testing.service';

/**
 * Testing module for self-exclusion functionality
 *
 * IMPORTANT: This module should only be available in development/staging environments
 */
@Module({
  imports: [TypeOrmModule.forFeature([SelfExclusionEntity])],
  controllers: [SelfExclusionTestingController],
  providers: [SelfExclusionTestingService],
  exports: [SelfExclusionTestingService],
})
export class SelfExclusionTestingModule {}
