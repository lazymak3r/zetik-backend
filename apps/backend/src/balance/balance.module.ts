import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BalanceHistoryEntity,
  BalanceStatisticEntity,
  BalanceWalletEntity,
  CurrencyRateHistoryEntity,
  FiatRateHistoryEntity,
} from '@zetik/shared-entities';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { AdminAccessGuard } from '../bonus/guards/admin-access.guard';
import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { BalanceAdminController } from './controllers/balance-admin.controller';
import { AdminBalanceService } from './services/admin-balance.service';
import { CryptoConverterService } from './services/crypto-converter.service';
import { CurrencyRateService } from './services/currency-rate.service';
import { FiatRateService } from './services/fiat-rate.service';
import { FireblocksRateService } from './services/fireblocks-rate.service';

@Module({
  imports: [
    AuthGuardsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => WebSocketModule),
    TypeOrmModule.forFeature([
      BalanceWalletEntity,
      BalanceHistoryEntity,
      BalanceStatisticEntity,
      CurrencyRateHistoryEntity,
      FiatRateHistoryEntity,
    ]),
  ],
  controllers: [BalanceController, BalanceAdminController],
  providers: [
    BalanceService,
    AdminBalanceService,
    CryptoConverterService,
    CurrencyRateService,
    FiatRateService,
    FireblocksRateService,
    AdminAccessGuard,
    AffiliateCommissionService,
  ],
  exports: [
    BalanceService,
    CryptoConverterService,
    CurrencyRateService,
    FiatRateService,
    FireblocksRateService,
  ],
})
export class BalanceModule {}
