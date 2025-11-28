import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthStrategyEnum, UserEntity } from '@zetik/shared-entities';
import { TwoFactorValidationService } from '../services/two-factor-validation.service';
import { TwoFactorGuard } from './two-factor.guard';

describe('TwoFactorGuard', () => {
  let guard: TwoFactorGuard;
  let reflector: jest.Mocked<Reflector>;
  let twoFactorValidationService: jest.Mocked<TwoFactorValidationService>;

  const createMockUser = (overrides?: Partial<UserEntity>): UserEntity =>
    ({
      id: 'test-user-id',
      username: 'testuser',
      is2FAEnabled: true,
      twoFactorSecret: 'test-secret',
      registrationStrategy: AuthStrategyEnum.EMAIL,
      getActiveAvatarUrl: () => undefined,
      ...overrides,
    }) as UserEntity;

  const mockUser = createMockUser();

  const createMockExecutionContext = (user?: UserEntity, body?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          body: body || {},
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: TwoFactorValidationService,
          useValue: {
            validateUserTwoFactor: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TwoFactorGuard>(TwoFactorGuard);
    reflector = module.get(Reflector);
    twoFactorValidationService = module.get(TwoFactorValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when 2FA is not required', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(twoFactorValidationService.validateUserTwoFactor).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when user is not in request', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(InternalServerErrorException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Guard misconfiguration: user not found in request',
      );
    });

    it('should validate 2FA when required', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext(mockUser, { twoFactorCode: '123456' });
      twoFactorValidationService.validateUserTwoFactor.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(twoFactorValidationService.validateUserTwoFactor).toHaveBeenCalledWith(
        mockUser,
        '123456',
      );
    });

    it('should pass undefined code when not provided', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext(mockUser, {});
      twoFactorValidationService.validateUserTwoFactor.mockResolvedValue(undefined);

      await guard.canActivate(context);

      expect(twoFactorValidationService.validateUserTwoFactor).toHaveBeenCalledWith(
        mockUser,
        undefined,
      );
    });

    it('should propagate errors from validateUserTwoFactor', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext(mockUser, { twoFactorCode: '123456' });
      const error = new Error('Invalid 2FA code');
      twoFactorValidationService.validateUserTwoFactor.mockRejectedValue(error);

      await expect(guard.canActivate(context)).rejects.toThrow(error);
    });

    it('should work with user without 2FA enabled', async () => {
      const userWithout2FA = createMockUser({ is2FAEnabled: false });
      reflector.getAllAndOverride.mockReturnValue({ strict: false });
      const context = createMockExecutionContext(userWithout2FA, {});
      twoFactorValidationService.validateUserTwoFactor.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
