import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthStrategyEnum, UserEntity } from '@zetik/shared-entities';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RequireTwoFactor } from './decorators/require-two-factor.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { EmailValidationStatusDto } from './dto/email-validation-status.dto';
import { EmailVerificationRequestDto } from './dto/email-verification-request.dto';
import { EmailRegisterDto } from './dto/email.register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { MetamaskLoginOrRegisterDto } from './dto/metamask-login-or-register.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PendingAuthResponseDto } from './dto/pending-auth-response.dto';
import { PhantomLoginOrRegisterDto } from './dto/phantom-login-or-register.dto';
import { PhoneVerificationStatusDto } from './dto/phone-verification-status.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendPhoneVerificationDto } from './dto/send-phone-verification.dto';
import { SteamLoginDto } from './dto/steam-login.dto';
import { SteamRegisterDto } from './dto/steam-register.dto';
import {
  Disable2FADto,
  Enable2FAResponseDto,
  TwoFactorStatusDto,
  Verify2FADto,
} from './dto/two-factor-auth.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { DeleteSessionsResponseDto, UserSessionsResponseDto } from './dto/user-session.dto';
import { Verify2FALoginDto } from './dto/verify-2fa-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneCodeDto } from './dto/verify-phone-code.dto';
import { TwoFactorGuard } from './guards/two-factor.guard';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { PhoneVerificationService } from './services/phone-verification.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly usersService: UsersService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
  ) {}

  @ApiOperation({ summary: 'Register a new user with email' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post('register/email')
  async registerWithEmail(
    @Body() registerDto: EmailRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.registerWithEmail(registerDto, response);
  }

  @ApiOperation({
    summary: 'Login with email or username and password',
    description:
      'If 2FA is enabled and device is new, returns pending auth token. Otherwise returns auth tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in or pending 2FA verification',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @Post('login/email')
  async loginWithEmail(
    @Body() loginDto: EmailLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    return this.authService.loginWithEmailOrUsername(loginDto, response);
  }

  @ApiOperation({
    summary: 'Verify 2FA code to complete login from new device',
    description: 'Complete login process by verifying 2FA code after receiving pending auth token',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code or pending auth token' })
  @HttpCode(HttpStatus.OK)
  @Post('login/verify-2fa')
  async verifyTwoFactorLogin(
    @Body() dto: Verify2FALoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyTwoFactorLogin(dto, response);
  }

  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiResponse({
    status: 200,
    description: 'Tokens successfully refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto, response);
  }

  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser() user: UserEntity, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.id, response);
    return { success: true, message: 'Logged out successfully' };
  }

  @ApiOperation({
    summary: 'Update user password - REQUIRES 2FA',
    description: 'Critical operation: 2FA must be enabled and code provided to change password',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Current password is incorrect, 2FA not enabled, or invalid 2FA code',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @RequireTwoFactor()
  @HttpCode(HttpStatus.OK)
  @Patch('password')
  async updatePassword(
    @CurrentUser() user: UserEntity,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<MessageResponseDto> {
    await this.authService.updatePassword(user.id, updatePasswordDto);
    return { message: 'Password updated successfully' };
  }

  @ApiOperation({ summary: 'Get email validation status' })
  @ApiResponse({
    status: 200,
    description: 'Email validation status retrieved successfully',
    type: EmailValidationStatusDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('email-validation-status')
  async getEmailValidationStatus(
    @CurrentUser() user: UserEntity,
  ): Promise<EmailValidationStatusDto> {
    return this.authService.getEmailValidationStatus(user.id);
  }

  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user',
    type: UserEntity,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@CurrentUser() user: UserEntity) {
    // Return user without sensitive data
    return {
      id: user.id,
      username: user.username,
      email: user.registrationStrategy === AuthStrategyEnum.EMAIL ? user.email || '' : '',
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phoneNumber,
      isPhoneVerified: user.isPhoneVerified,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      affiliateCampaignId: user.affiliateCampaignId,
      currentFiatFormat: user.currentFiatFormat,
      currentCurrency: user.currentCurrency,
      registrationStrategy: user.registrationStrategy,
      isBanned: user.isBanned,
      isPrivate: user.isPrivate,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @ApiOperation({ summary: 'Get all active sessions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns all active sessions for the current user',
    type: UserSessionsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getUserSessions(
    @CurrentUser() user: UserEntity,
    @Req() request: Request,
  ): Promise<UserSessionsResponseDto> {
    return this.authService.getUserSessions(user.id, request);
  }

  @ApiOperation({ summary: 'Delete sessions' })
  @ApiResponse({
    status: 200,
    description: 'Sessions have been deleted',
    type: DeleteSessionsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request - Missing required parameters' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  async deleteSessions(
    @CurrentUser() user: UserEntity,
    @Query('keepSessionId') keepSessionId?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<DeleteSessionsResponseDto> {
    if (!keepSessionId && !sessionId) {
      throw new BadRequestException(
        'Missing required parameter: either keepSessionId or sessionId must be provided',
      );
    }

    if (sessionId) {
      return this.authService.deleteSessionById(user.id, sessionId);
    } else {
      return this.authService.deleteAllSessionsExceptCurrent(user.id, keepSessionId!);
    }
  }

  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: MessageResponseDto,
  })
  @Post('verify-email')
  async verifyEmail(@Query() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    await this.emailVerificationService.verify(dto.token);
    return { message: 'Email verified' };
  }

  @ApiOperation({ summary: 'Send email verification link' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Verification email sent', type: MessageResponseDto })
  @Post('verify-email/request')
  async sendVerification(@Body() dto: EmailVerificationRequestDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');
    await this.emailVerificationService.createAndSend(user);
    return { message: 'Verification email sent' };
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent', type: MessageResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Password reset email sent', type: MessageResponseDto })
  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');
    await this.passwordResetService.createAndSend(user);
    return { message: 'Password reset email sent' };
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password has been reset', type: MessageResponseDto })
  @Post('password-reset')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.passwordResetService.reset(dto.token, dto.newPassword);
    return { message: 'Password has been reset' };
  }

  @ApiOperation({
    summary: 'Login or register with Metamask',
    description:
      'If 2FA is enabled and device is new, returns pending auth token. Otherwise returns auth tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in or pending 2FA verification',
    type: AuthResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login-or-register/metamask')
  async loginOrRegisterWithMetamask(
    @Body() metamaskLoginDto: MetamaskLoginOrRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    return this.authService.loginOrRegisterWithMetamask(metamaskLoginDto, response);
  }

  @ApiOperation({
    summary: 'Login or register with Phantom',
    description:
      'If 2FA is enabled and device is new, returns pending auth token. Otherwise returns auth tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in or pending 2FA verification',
    type: AuthResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login-or-register/phantom')
  async loginOrRegisterWithPhantom(
    @Body() phantomLoginDto: PhantomLoginOrRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    return this.authService.loginOrRegisterWithPhantom(phantomLoginDto, response);
  }

  @ApiOperation({
    summary: 'Login or register with Google',
    description:
      'Unified endpoint for Google OAuth. Automatically registers new users or logs in existing ones. If 2FA is enabled and device is new, returns pending auth token.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in/registered or pending 2FA verification',
    type: AuthResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login-or-register/google')
  async loginOrRegisterWithGoogle(
    @Body() googleLoginDto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    return this.authService.loginOrRegisterWithGoogle(googleLoginDto, response);
  }

  @ApiOperation({ summary: 'Register with Steam' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: AuthResponseDto })
  @Post('register/steam')
  async registerWithSteam(
    @Body() steamRegisterDto: SteamRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.registerWithSteam(steamRegisterDto, response);
  }

  @ApiOperation({
    summary: 'Login with Steam',
    description:
      'If 2FA is enabled and device is new, returns pending auth token. Otherwise returns auth tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in or pending 2FA verification',
    type: AuthResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login/steam')
  async loginWithSteam(
    @Body() steamLoginDto: SteamLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    return this.authService.loginWithSteam(steamLoginDto, response);
  }

  @ApiOperation({ summary: 'Initialize Steam OpenID login flow' })
  @ApiResponse({
    status: 200,
    description: 'Returns Steam OpenID authentication URL',
  })
  @Get('steam/init')
  initSteamLogin(): { redirectUrl: string } {
    const steamLoginUrl = this.authService.buildSteamOpenIdUrl();
    return { redirectUrl: steamLoginUrl };
  }

  @ApiOperation({ summary: 'Steam OpenID callback handler' })
  @ApiResponse({
    status: 303,
    description: 'Redirects to frontend after authentication',
  })
  @Get('steam/callback')
  async steamCallback(@Query() query: any, @Res() response: Response): Promise<void> {
    const steamData = {
      openidAssocHandle: query['openid.assoc_handle'],
      openidSigned: query['openid.signed'],
      openidSig: query['openid.sig'],
      openidNs: query['openid.ns'],
      openidMode: query['openid.mode'],
      openidOpEndpoint: query['openid.op_endpoint'],
      openidClaimedId: query['openid.claimed_id'],
      openidIdentity: query['openid.identity'],
      openidReturnTo: query['openid.return_to'],
      openidResponseNonce: query['openid.response_nonce'],
    };

    const steamLoginDto: SteamLoginDto = {
      openidAssocHandle: steamData.openidAssocHandle,
      openidSigned: steamData.openidSigned,
      openidSig: steamData.openidSig,
      openidNs: steamData.openidNs,
      openidMode: steamData.openidMode,
      openidOpEndpoint: steamData.openidOpEndpoint,
      openidClaimedId: steamData.openidClaimedId,
      openidIdentity: steamData.openidIdentity,
      openidReturnTo: steamData.openidReturnTo,
      openidResponseNonce: steamData.openidResponseNonce,
    };

    const frontendUrl = process.env.FRONTEND_URL;

    // Validate that frontend URL is set
    if (!frontendUrl) {
      response.status(500).send('Server configuration error');
      return;
    }

    // Verify Steam OpenID signature (only once!)
    const isValidSignature = await this.authService.verifySteamSignature(steamLoginDto);

    if (!isValidSignature) {
      const params = new URLSearchParams({
        error: 'invalid_signature',
      });
      response.redirect(303, `${frontendUrl}/auth/error?${params.toString()}`);
      return;
    }

    // Try to login or register (signature already verified, don't verify again)
    try {
      const result = await this.authService.loginOrRegisterWithSteamVerified(
        steamLoginDto,
        response,
      );

      // If 2FA is required
      if ('requiresTwoFactor' in result) {
        const params = new URLSearchParams({
          pending_token: result.pendingAuthToken,
        });
        response.redirect(303, `${frontendUrl}/auth/2fa?${params.toString()}`);
        return;
      }

      // Successful login/registration - redirect to callback success page
      response.redirect(303, `${frontendUrl}`);
      return;
    } catch {
      const params = new URLSearchParams({
        action: 'register',
        openidAssocHandle: steamData.openidAssocHandle,
        openidSigned: steamData.openidSigned,
        openidSig: steamData.openidSig,
        openidNs: steamData.openidNs,
        openidMode: steamData.openidMode,
        openidOpEndpoint: steamData.openidOpEndpoint,
        openidClaimedId: steamData.openidClaimedId,
        openidIdentity: steamData.openidIdentity,
        openidReturnTo: steamData.openidReturnTo,
        openidResponseNonce: steamData.openidResponseNonce,
      });
      response.redirect(303, `${frontendUrl}/auth/steam?${params.toString()}`);
      return;
    }
  }

  @ApiOperation({ summary: 'Get 2FA status' })
  @ApiResponse({
    status: 200,
    description: '2FA status retrieved successfully',
    type: TwoFactorStatusDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  async get2FAStatus(@CurrentUser() user: UserEntity): Promise<TwoFactorStatusDto> {
    return this.twoFactorAuthService.getTwoFactorAuthenticationStatus(user.id);
  }

  @ApiOperation({ summary: 'Generate 2FA setup QR code' })
  @ApiResponse({
    status: 200,
    description: '2FA setup data generated successfully',
    type: Enable2FAResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/generate')
  async generate2FA(@CurrentUser() user: UserEntity): Promise<Enable2FAResponseDto> {
    const { secret, qrCodeDataUrl } =
      await this.twoFactorAuthService.generateTwoFactorAuthenticationSecret(user);

    return {
      qrCodeDataUrl,
      manualEntryKey: secret,
    };
  }

  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({
    status: 200,
    description: '2FA enabled successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid authentication code or unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/enable')
  async enable2FA(
    @CurrentUser() user: UserEntity,
    @Body() verify2FADto: Verify2FADto,
    @Body('secret') secret: string,
  ): Promise<MessageResponseDto> {
    await this.twoFactorAuthService.enableTwoFactorAuthentication(
      user.id,
      verify2FADto.token,
      secret,
    );
    return { message: '2FA enabled successfully' };
  }

  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({
    status: 200,
    description: '2FA disabled successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid authentication code or unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  async disable2FA(
    @CurrentUser() user: UserEntity,
    @Body() disable2FADto: Disable2FADto,
  ): Promise<MessageResponseDto> {
    await this.twoFactorAuthService.disableTwoFactorAuthentication(user.id, disable2FADto.token);
    return { message: '2FA disabled successfully' };
  }

  @ApiOperation({ summary: 'Link Google account to existing user' })
  @ApiResponse({
    status: 200,
    description: 'Google account linked successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Google account already linked to another user' })
  @ApiResponse({ status: 401, description: 'Unauthorized or invalid Google token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('google/link')
  async linkGoogleAccount(
    @CurrentUser() user: UserEntity,
    @Body() googleLoginDto: GoogleLoginDto,
  ): Promise<MessageResponseDto> {
    await this.authService.linkGoogleAccount(user.id, googleLoginDto);
    return { message: 'Google account linked successfully' };
  }

  @ApiOperation({ summary: 'Unlink Google account from user' })
  @ApiResponse({
    status: 200,
    description: 'Google account unlinked successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete('google/link')
  async unlinkGoogleAccount(@CurrentUser() user: UserEntity): Promise<MessageResponseDto> {
    await this.authService.unlinkGoogleAccount(user.id);
    return { message: 'Google account unlinked successfully' };
  }

  @ApiOperation({ summary: 'Get Google account link status' })
  @ApiResponse({
    status: 200,
    description: 'Google link status retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('google/status')
  async getGoogleLinkStatus(
    @CurrentUser() user: UserEntity,
  ): Promise<{ linked: boolean; email?: string }> {
    return this.authService.getGoogleLinkStatus(user.id);
  }

  @ApiOperation({ summary: 'Send phone verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - phone already verified or rate limited' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('phone-verification/send')
  async sendPhoneVerification(
    @CurrentUser() user: UserEntity,
    @Body() dto: SendPhoneVerificationDto,
  ): Promise<MessageResponseDto> {
    await this.phoneVerificationService.sendVerificationCode(user.id, dto.phoneNumber);
    return { message: 'Verification code sent to your phone' };
  }

  @ApiOperation({ summary: 'Verify phone number with code' })
  @ApiResponse({
    status: 200,
    description: 'Phone number verified successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('phone-verification/verify')
  async verifyPhoneNumber(
    @CurrentUser() user: UserEntity,
    @Body() dto: VerifyPhoneCodeDto,
  ): Promise<MessageResponseDto> {
    await this.phoneVerificationService.verifyCode(user.id, dto.phoneNumber, dto.code);
    return { message: 'Phone number verified successfully' };
  }

  @ApiOperation({ summary: 'Get phone verification status' })
  @ApiResponse({
    status: 200,
    description: 'Phone verification status retrieved successfully',
    type: PhoneVerificationStatusDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('phone-verification/status')
  getPhoneVerificationStatus(@CurrentUser() user: UserEntity): PhoneVerificationStatusDto {
    return {
      isVerified: user.isPhoneVerified,
      phoneNumber: user.isPhoneVerified ? user.phoneNumber : undefined,
      verifiedAt: user.isPhoneVerified ? user.phoneVerifiedAt : undefined,
    };
  }

  @ApiOperation({ summary: 'Remove phone number' })
  @ApiResponse({
    status: 200,
    description: 'Phone number removed successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete('phone-verification')
  async removePhoneNumber(@CurrentUser() user: UserEntity): Promise<MessageResponseDto> {
    await this.phoneVerificationService.removePhoneNumber(user.id);
    return { message: 'Phone number removed successfully' };
  }
}
