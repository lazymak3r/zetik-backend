import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserEntity } from '@zetik/shared-entities';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { UsersService } from '../../users/users.service';
import { TwoFactorValidationService } from './two-factor-validation.service';

@Injectable()
export class TwoFactorAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly twoFactorValidationService: TwoFactorValidationService,
  ) {}

  /**
   * Generate a new 2FA secret and QR code for a user
   */
  async generateTwoFactorAuthenticationSecret(user: UserEntity) {
    const secret = authenticator.generateSecret();

    const otpauthUrl = authenticator.keyuri(user.email || user.username, 'Zetik Casino', secret);

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeDataUrl,
    };
  }

  async verifyTwoFactorAuthenticationToken(
    token: string,
    secret: string,
    userId: string,
  ): Promise<boolean> {
    return this.twoFactorValidationService.verifyTwoFactorAuthenticationToken(
      token,
      secret,
      userId,
    );
  }

  /**
   * Enable 2FA for a user by verifying the setup token
   */
  async enableTwoFactorAuthentication(
    userId: string,
    token: string,
    secret: string,
  ): Promise<void> {
    const isValidToken = await this.verifyTwoFactorAuthenticationToken(token, secret, userId);

    if (!isValidToken) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.usersService.enable2FA(userId, secret);
  }

  /**
   * Disable 2FA for a user by verifying their current token
   */
  async disableTwoFactorAuthentication(userId: string, token: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.is2FAEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA is not enabled for this user');
    }

    const isValidToken = await this.verifyTwoFactorAuthenticationToken(
      token,
      user.twoFactorSecret,
      userId,
    );

    if (!isValidToken) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.usersService.disable2FA(userId);
  }

  /**
   * Get 2FA status for a user
   */
  async getTwoFactorAuthenticationStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { enabled: user.is2FAEnabled };
  }

  async validateUserTwoFactor(user: UserEntity, twoFactorCode?: string): Promise<void> {
    return this.twoFactorValidationService.validateUserTwoFactor(user, twoFactorCode);
  }
}
