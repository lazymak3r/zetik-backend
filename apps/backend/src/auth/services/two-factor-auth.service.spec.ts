import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthStrategyEnum, UserEntity } from '@zetik/shared-entities';
import { UsersService } from '../../users/users.service';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { TwoFactorValidationService } from './two-factor-validation.service';

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;
  let usersService: jest.Mocked<UsersService>;
  let validationService: jest.Mocked<TwoFactorValidationService>;

  const createMockUser = (overrides?: Partial<UserEntity>): UserEntity =>
    ({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      is2FAEnabled: true,
      twoFactorSecret: 'test-secret',
      registrationStrategy: AuthStrategyEnum.EMAIL,
      getActiveAvatarUrl: () => undefined,
      ...overrides,
    }) as UserEntity;

  const mockUser = createMockUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorAuthService,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            enable2FA: jest.fn(),
            disable2FA: jest.fn(),
          },
        },
        {
          provide: TwoFactorValidationService,
          useValue: {
            verifyTwoFactorAuthenticationToken: jest.fn(),
            validateUserTwoFactor: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorAuthService>(TwoFactorAuthService);
    usersService = module.get(UsersService);
    validationService = module.get(TwoFactorValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTwoFactorAuthenticationSecret', () => {
    it('should generate a secret and QR code', async () => {
      const result = await service.generateTwoFactorAuthenticationSecret(mockUser);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result.secret).toBeTruthy();
      expect(result.qrCodeDataUrl).toContain('data:image/png;base64');
    });
  });

  describe('verifyTwoFactorAuthenticationToken', () => {
    const validToken = '123456';
    const secret = 'JBSWY3DPEHPK3PXP';
    const userId = 'test-user-id';

    it('should delegate to validation service', async () => {
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(true);

      const result = await service.verifyTwoFactorAuthenticationToken(validToken, secret, userId);

      expect(result).toBe(true);
      expect(validationService.verifyTwoFactorAuthenticationToken).toHaveBeenCalledWith(
        validToken,
        secret,
        userId,
      );
    });

    it('should delegate failure to validation service', async () => {
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(false);

      const result = await service.verifyTwoFactorAuthenticationToken(validToken, secret, userId);

      expect(result).toBe(false);
    });
  });

  describe('enableTwoFactorAuthentication', () => {
    const token = '123456';
    const secret = 'test-secret';
    const userId = 'test-user-id';

    it('should enable 2FA with valid token', async () => {
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(true);
      usersService.enable2FA.mockResolvedValue(undefined);

      await service.enableTwoFactorAuthentication(userId, token, secret);

      expect(usersService.enable2FA).toHaveBeenCalledWith(userId, secret);
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(false);

      await expect(service.enableTwoFactorAuthentication(userId, token, secret)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(usersService.enable2FA).not.toHaveBeenCalled();
    });
  });

  describe('disableTwoFactorAuthentication', () => {
    const token = '123456';
    const userId = 'test-user-id';

    it('should disable 2FA with valid token', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(true);
      usersService.disable2FA.mockResolvedValue(undefined);

      await service.disableTwoFactorAuthentication(userId, token);

      expect(usersService.disable2FA).toHaveBeenCalledWith(userId);
    });

    it('should throw UnauthorizedException if 2FA is not enabled', async () => {
      const userWithout2FA = createMockUser({ is2FAEnabled: false });
      usersService.findById.mockResolvedValue(userWithout2FA);

      await expect(service.disableTwoFactorAuthentication(userId, token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(usersService.disable2FA).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      validationService.verifyTwoFactorAuthenticationToken.mockResolvedValue(false);

      await expect(service.disableTwoFactorAuthentication(userId, token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(usersService.disable2FA).not.toHaveBeenCalled();
    });
  });

  describe('getTwoFactorAuthenticationStatus', () => {
    it('should return enabled status for user with 2FA', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.getTwoFactorAuthenticationStatus(mockUser.id);

      expect(result).toEqual({ enabled: true });
    });

    it('should return disabled status for user without 2FA', async () => {
      const userWithout2FA = createMockUser({ is2FAEnabled: false });
      usersService.findById.mockResolvedValue(userWithout2FA);

      const result = await service.getTwoFactorAuthenticationStatus(mockUser.id);

      expect(result).toEqual({ enabled: false });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getTwoFactorAuthenticationStatus(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateUserTwoFactor', () => {
    it('should delegate to validation service', async () => {
      validationService.validateUserTwoFactor.mockResolvedValue(undefined);

      await expect(service.validateUserTwoFactor(mockUser, '123456')).resolves.not.toThrow();

      expect(validationService.validateUserTwoFactor).toHaveBeenCalledWith(mockUser, '123456');
    });

    it('should throw when validation service throws', async () => {
      validationService.validateUserTwoFactor.mockRejectedValue(
        new ForbiddenException({
          message: 'Invalid 2FA code',
          error: 'TwoFactorCodeInvalid',
          statusCode: 403,
        }),
      );

      await expect(service.validateUserTwoFactor(mockUser, '123456')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
