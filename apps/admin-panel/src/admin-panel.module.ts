import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AvatarsModule } from './avatars/avatars.module';
import { BlogAdminModule } from './blog/blog-admin.module';
import { BonusesModule } from './bonuses/bonuses.module';
import { authConfig } from './config/auth.config';
import { commonConfig } from './config/common.config';
import { databaseConfig } from './config/database.config';
import { defaultAdminConfig } from './config/default-admin.config';
import jwtConfig from './config/jwt.config';
import minioConfig from './config/minio.config';
import { securityConfig } from './config/security.config';
import { CurrenciesModule } from './currencies/currencies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { AdminGamesModule } from './games/games.module';
import { PaymentsModule } from './payments/payments.module';
import { PromocodesModule } from './promocodes/promocodes.module';
import { ProvablyFairModule } from './provably-fair/provably-fair.module';
import { ProviderGamesModule } from './provider-games/provider-games.module';
import { SettingsModule } from './settings/settings.module';
import { SlotImagesModule } from './slot-images/slot-images.module';
import { St8BonusModule } from './st8-bonus/st8-bonus.module';
import { SelfExclusionTestingModule } from './testing/self-exclusion/self-exclusion-testing.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';
import { VerificationAdminModule } from './verification/verification-admin.module';
import { VipTiersModule } from './vip-tiers/vip-tiers.module';
import { VipTransfersModule } from './vip-transfers/vip-transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/admin-panel/.env', '.env'],
      load: [
        commonConfig,
        authConfig,
        databaseConfig,
        defaultAdminConfig,
        jwtConfig,
        securityConfig,
        minioConfig,
      ],
    }),
    AffiliateModule,
    AuditModule,
    AuthModule,
    AvatarsModule,
    BlogAdminModule,
    BonusesModule,
    CurrenciesModule,
    DashboardModule,
    DatabaseModule,
    AdminGamesModule,
    PaymentsModule,
    TransactionsModule,
    SettingsModule,
    UsersModule,
    VerificationAdminModule,
    VipTiersModule,
    VipTransfersModule,
    PromocodesModule,
    St8BonusModule,
    UploadModule,
    ProvablyFairModule,
    SelfExclusionTestingModule,
    ProviderGamesModule,
    SlotImagesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AdminPanelModule {}
