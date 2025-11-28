import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SportsbookBetEntity } from '@zetik/shared-entities';
import { BalanceModule } from '../balance/balance.module';
import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { UserBetModule } from '../games/services/user-bet.module';
import { UsersModule } from '../users/users.module';
import { BetbyExternalApiService } from './betby-external-api.service';
import { BetbyJwtService } from './betby-jwt.service';
import { BetbyController } from './betby.controller';
import { BetbyService } from './betby.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SportsbookBetEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => {
        // For Betby JWT we use asymmetric keys (ES256)
        // Secret is not needed as we use privateKey/publicKey in BetbyJwtService
        return {
          // Empty configuration - keys are passed directly to BetbyJwtService
        };
      },
    }),
    ConfigModule,
    UsersModule,
    BalanceModule,
    UserBetModule,
  ],
  controllers: [BetbyController],
  providers: [BetbyService, BetbyExternalApiService, BetbyJwtService, AffiliateCommissionService],
  exports: [BetbyService, BetbyExternalApiService, BetbyJwtService],
})
export class SportsbookModule {}
