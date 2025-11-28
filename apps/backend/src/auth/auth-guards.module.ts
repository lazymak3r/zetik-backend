import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';

import { TwoFactorGuard } from './guards/two-factor.guard';

import { TwoFactorRateLimitService } from './services/two-factor-rate-limit.service';

import { TwoFactorValidationService } from './services/two-factor-validation.service';

@Module({
  imports: [CommonModule],
  providers: [TwoFactorGuard, TwoFactorValidationService, TwoFactorRateLimitService],
  exports: [TwoFactorGuard, TwoFactorValidationService],
})
export class AuthGuardsModule {}
