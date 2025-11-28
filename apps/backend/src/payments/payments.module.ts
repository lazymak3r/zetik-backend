import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity, WalletEntity, WithdrawRequestEntity } from '@zetik/shared-entities';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { BalanceModule } from '../balance/balance.module';
import { EmailModule } from '../email/email.module';
import { ProvablyFairModule } from '../games/services/provably-fair.module';
import { FireblocksService } from './fireblocks/fireblocks.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CurrenciesService } from './services/currencies.service';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, WalletEntity, WithdrawRequestEntity]),
    AuthGuardsModule,
    forwardRef(() => BalanceModule),
    ProvablyFairModule,
    EmailModule,
  ],
  providers: [PaymentsService, FireblocksService, WalletService, CurrenciesService],
  controllers: [PaymentsController],
  exports: [PaymentsService, WalletService, CurrenciesService, FireblocksService],
})
export class PaymentsModule {}
