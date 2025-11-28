import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity, WalletEntity, WithdrawRequestEntity } from '@zetik/shared-entities';
import { AffiliateModule } from '../../../backend/src/affiliate/affiliate.module';
import { BalanceModule } from '../../../backend/src/balance/balance.module';
import { EmailModule } from '../../../backend/src/email/email.module';
import { ProvablyFairModule } from '../../../backend/src/games/services/provably-fair.module';
import { FireblocksWebhookController } from '../../../backend/src/payments/fireblocks/fireblocks-webhook.controller';
import { FireblocksService } from '../../../backend/src/payments/fireblocks/fireblocks.service';
import { PaymentsService } from '../../../backend/src/payments/payments.service';
import { CurrenciesService } from '../../../backend/src/payments/services/currencies.service';
import { WalletService } from '../../../backend/src/payments/wallet.service';

/**
 * Fireblocks Webhook Module
 *
 * This module provides the Fireblocks webhook endpoint and all required dependencies.
 * It's a focused module that only handles webhook processing without exposing
 * the full PaymentsModule API endpoints.
 *
 * Dependencies:
 * - BalanceModule: For balance updates after deposits/withdrawals
 * - AffiliateModule: For affiliate reward processing
 * - ProvablyFairModule: For generating client seeds
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, WalletEntity, WithdrawRequestEntity]),
    forwardRef(() => BalanceModule),
    forwardRef(() => AffiliateModule),
    ProvablyFairModule,
    EmailModule,
  ],
  controllers: [FireblocksWebhookController],
  providers: [PaymentsService, FireblocksService, WalletService, CurrenciesService],
  exports: [PaymentsService, FireblocksService],
})
export class WebhookModule {}
