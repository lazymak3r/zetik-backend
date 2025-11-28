import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import { AuthStrategyEnum, UserEntity } from '@zetik/shared-entities';
import { UsersService } from '../../users/users.service';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { EmailValidationStatusDto } from '../dto/email-validation-status.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import { TwoFactorGuard } from '../guards/two-factor.guard';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordResetService } from '../services/password-reset.service';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';
import { TwoFactorValidationService } from '../services/two-factor-validation.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const createMockUser = (overrides?: Partial<UserEntity>): UserEntity =>
    ({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      isEmailVerified: false,
      registrationStrategy: AuthStrategyEnum.EMAIL,
      registrationData: {
        passwordHash: 'hashed-password',
      },
      isBanned: false,
      isPrivate: false,
      currentFiatFormat: FiatFormatEnum.STANDARD,
      currentCurrency: CurrencyEnum.USD,
      createdAt: new Date(),
      updatedAt: new Date(),
      displayName: 'Test User',
      avatarUrl: undefined,
      getActiveAvatarUrl: () => undefined,
      ...overrides,
    }) as UserEntity;

  const mockUser = createMockUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            registerWithEmail: jest.fn(),
            loginWithEmail: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            updatePassword: jest.fn(),
            getEmailValidationStatus: jest.fn(),
            loginOrRegisterWithMetamask: jest.fn(),
            loginOrRegisterWithPhantom: jest.fn(),
            registerWithGoogle: jest.fn(),
            loginWithGoogle: jest.fn(),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            verify: jest.fn(),
            createAndSend: jest.fn(),
          },
        },
        {
          provide: PasswordResetService,
          useValue: {
            createAndSend: jest.fn(),
            reset: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
        {
          provide: TwoFactorGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: TwoFactorValidationService,
          useValue: {
            validateUserTwoFactor: jest.fn(),
          },
        },
        {
          provide: PhoneVerificationService,
          useValue: {
            verify: jest.fn(),
            createAndSend: jest.fn(),
          },
        },
        {
          provide: TwoFactorAuthService,
          useValue: {
            generateTwoFactorAuthenticationSecret: jest.fn(),
            verifyTwoFactorAuthenticationToken: jest.fn(),
            enableTwoFactorAuthentication: jest.fn(),
            disableTwoFactorAuthentication: jest.fn(),
            getTwoFactorAuthenticationStatus: jest.fn(),
            validateUserTwoFactor: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('updatePassword', () => {
    const updatePasswordDto: UpdatePasswordDto = {
      currentPassword: 'currentPassword123',
      newPassword: 'newPassword123',
    };

    it('should update password successfully', async () => {
      jest.spyOn(authService, 'updatePassword').mockResolvedValue(undefined);

      const result = await controller.updatePassword(mockUser, updatePasswordDto);

      expect(authService.updatePassword).toHaveBeenCalledWith(mockUser.id, updatePasswordDto);
      expect(result).toEqual({ message: 'Password updated successfully' });
    });

    it('should propagate service errors', async () => {
      const serviceError = new Error('Service error');
      jest.spyOn(authService, 'updatePassword').mockRejectedValue(serviceError);

      await expect(controller.updatePassword(mockUser, updatePasswordDto)).rejects.toThrow(
        serviceError,
      );

      expect(authService.updatePassword).toHaveBeenCalledWith(mockUser.id, updatePasswordDto);
    });

    it('should handle UnauthorizedException from service', async () => {
      const unauthorizedError = new Error('Current password is incorrect');
      jest.spyOn(authService, 'updatePassword').mockRejectedValue(unauthorizedError);

      await expect(controller.updatePassword(mockUser, updatePasswordDto)).rejects.toThrow(
        unauthorizedError,
      );

      expect(authService.updatePassword).toHaveBeenCalledWith(mockUser.id, updatePasswordDto);
    });

    it('should pass user ID correctly to service', async () => {
      const differentUser = createMockUser({ id: 'different-user-id' });
      jest.spyOn(authService, 'updatePassword').mockResolvedValue(undefined);

      await controller.updatePassword(differentUser, updatePasswordDto);

      expect(authService.updatePassword).toHaveBeenCalledWith(differentUser.id, updatePasswordDto);
    });

    it('should return consistent message format', async () => {
      jest.spyOn(authService, 'updatePassword').mockResolvedValue(undefined);

      const result = await controller.updatePassword(mockUser, updatePasswordDto);

      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
      expect(result.message).toBe('Password updated successfully');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user without sensitive data for email user', () => {
      const result = controller.getCurrentUser(mockUser);

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: 'test@example.com',
        isEmailVerified: mockUser.isEmailVerified,
        registrationStrategy: mockUser.registrationStrategy,
        isBanned: mockUser.isBanned,
        isPrivate: mockUser.isPrivate,
        currentFiatFormat: mockUser.currentFiatFormat,
        currentCurrency: mockUser.currentCurrency,
        displayName: mockUser.displayName,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('registrationData');
    });

    it('should return empty email for non-email users', () => {
      const metamaskUser = createMockUser({
        email: undefined,
        isEmailVerified: false,
        registrationStrategy: AuthStrategyEnum.METAMASK,
        registrationData: { address: '0x123' },
      });

      const result = controller.getCurrentUser(metamaskUser);

      expect(result.email).toBe('');
    });
  });

  describe('getEmailValidationStatus', () => {
    it('should return email validation status for email user', async () => {
      const mockResponse: EmailValidationStatusDto = {
        registrationStrategy: AuthStrategyEnum.EMAIL,
        isValidated: true,
      };
      jest.spyOn(authService, 'getEmailValidationStatus').mockResolvedValue(mockResponse);

      const result = await controller.getEmailValidationStatus(mockUser);

      expect(authService.getEmailValidationStatus).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockResponse);
    });

    it('should return registration strategy without validation for non-email user', async () => {
      const metamaskUser = createMockUser({
        registrationStrategy: AuthStrategyEnum.METAMASK,
      });
      const mockResponse: EmailValidationStatusDto = {
        registrationStrategy: AuthStrategyEnum.METAMASK,
        isValidated: undefined,
      };
      jest.spyOn(authService, 'getEmailValidationStatus').mockResolvedValue(mockResponse);

      const result = await controller.getEmailValidationStatus(metamaskUser);

      expect(authService.getEmailValidationStatus).toHaveBeenCalledWith(metamaskUser.id);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate service errors', async () => {
      const serviceError = new Error('Service error');
      jest.spyOn(authService, 'getEmailValidationStatus').mockRejectedValue(serviceError);

      await expect(controller.getEmailValidationStatus(mockUser)).rejects.toThrow(serviceError);

      expect(authService.getEmailValidationStatus).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle user not found error', async () => {
      const notFoundError = new Error('User not found');
      jest.spyOn(authService, 'getEmailValidationStatus').mockRejectedValue(notFoundError);

      await expect(controller.getEmailValidationStatus(mockUser)).rejects.toThrow(notFoundError);

      expect(authService.getEmailValidationStatus).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return correct response structure', async () => {
      const mockResponse: EmailValidationStatusDto = {
        registrationStrategy: AuthStrategyEnum.EMAIL,
        isValidated: false,
      };
      jest.spyOn(authService, 'getEmailValidationStatus').mockResolvedValue(mockResponse);

      const result = await controller.getEmailValidationStatus(mockUser);

      expect(result).toHaveProperty('registrationStrategy');
      expect(result).toHaveProperty('isValidated');
      expect(typeof result.registrationStrategy).toBe('string');
      expect(typeof result.isValidated).toBe('boolean');
    });
  });
});
