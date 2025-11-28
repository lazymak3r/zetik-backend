import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MailTokenEntity,
  PhoneVerificationEntity,
  RefreshTokenEntity,
  SessionTrackingEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { BalanceModule } from '../balance/balance.module';
import { CommonModule } from '../common/common.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthGuardsModule } from './auth-guards.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { PendingAuthTokenService } from './services/pending-auth-token.service';
import { PhoneVerificationService } from './services/phone-verification.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionTrackingService } from './services/session-tracking.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { TwilioService } from './services/twilio.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      MailTokenEntity,
      PhoneVerificationEntity,
      SessionTrackingEntity,
      UserEntity,
    ]),
    AuthGuardsModule,
    EmailModule,
    forwardRef(() => UsersModule),
    forwardRef(() => BalanceModule),
    forwardRef(() => AffiliateModule),
    forwardRef(() => CommonModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.getOrThrow<string>('JWT_SECRET');
        const expiresIn = configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION');

        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    RefreshTokenService,
    SessionTrackingService,
    TokenBlacklistService,
    TwoFactorAuthService,
    EmailVerificationService,
    PasswordResetService,
    PendingAuthTokenService,
    TwilioService,
    PhoneVerificationService,
  ],
  exports: [
    AuthService,
    RefreshTokenService,
    SessionTrackingService,
    TokenBlacklistService,
    TwoFactorAuthService,
    EmailVerificationService,
    PhoneVerificationService,
  ],
})
export class AuthModule {}
