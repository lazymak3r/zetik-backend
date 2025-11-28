import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@zetik/shared-entities';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

/**
 * Unit tests for RolesGuard
 *
 * Verifies that the guard correctly:
 * - Allows access when user has required role
 * - Denies access when user lacks required role
 * - Handles missing user (not authenticated)
 * - Handles no role requirements (public access)
 * - Supports multiple required roles (OR logic)
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when user has the required role', () => {
      const context = createMockContext(
        { id: '1', email: 'super@test.com', role: AdminRole.SUPER_ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user lacks the required role', () => {
      const context = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions. Required role(s): super_admin',
      );
    });

    it('should allow access when no roles are required', () => {
      const context = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        undefined,
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when required roles array is empty', () => {
      const context = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        [],
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      const context = createMockContext(null, [AdminRole.SUPER_ADMIN]);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should allow access when user has any of multiple required roles', () => {
      const regularAdminContext = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        [AdminRole.SUPER_ADMIN, AdminRole.ADMIN],
      );

      const result1 = guard.canActivate(regularAdminContext);
      expect(result1).toBe(true);

      const superAdminContext = createMockContext(
        { id: '1', email: 'super@test.com', role: AdminRole.SUPER_ADMIN },
        [AdminRole.SUPER_ADMIN, AdminRole.ADMIN],
      );

      const result2 = guard.canActivate(superAdminContext);
      expect(result2).toBe(true);
    });

    it('should deny access when user has none of the multiple required roles', () => {
      const context = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should check roles at both method and class level', () => {
      const getAllAndOverrideSpy = jest.spyOn(reflector, 'getAllAndOverride');

      const context = createMockContext(
        { id: '1', email: 'super@test.com', role: AdminRole.SUPER_ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      guard.canActivate(context);

      // Verify that getAllAndOverride was called with correct parameters
      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should log warning when access is denied', () => {
      const loggerSpy = jest.spyOn(guard['logger'], 'warn');

      const context = createMockContext(
        { id: '2', email: 'admin@test.com', role: AdminRole.ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      try {
        guard.canActivate(context);
      } catch (error) {
        // Expected to throw
      }

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Access denied for user 2'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('admin@test.com'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('with role admin'));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Required roles: super_admin'),
      );
    });

    it('should log debug when access is granted', () => {
      const loggerSpy = jest.spyOn(guard['logger'], 'debug');

      const context = createMockContext(
        { id: '1', email: 'super@test.com', role: AdminRole.SUPER_ADMIN },
        [AdminRole.SUPER_ADMIN],
      );

      guard.canActivate(context);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Access granted for user 1'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('super@test.com'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('with role super_admin'));
    });

    it('should log error when user object is missing', () => {
      const loggerSpy = jest.spyOn(guard['logger'], 'error');

      const context = createMockContext(null, [AdminRole.SUPER_ADMIN]);

      try {
        guard.canActivate(context);
      } catch (error) {
        // Expected to throw
      }

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('User not found in request'));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ensure JwtAuthGuard runs first'),
      );
    });
  });

  /**
   * Helper function to create a mock ExecutionContext
   */
  function createMockContext(
    user: { id: string; email: string; role: AdminRole } | null,
    requiredRoles: AdminRole[] | undefined,
  ): ExecutionContext {
    const mockRequest = {
      user,
    };

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn().mockReturnValue({}),
      getClass: jest.fn().mockReturnValue({}),
    } as unknown as ExecutionContext;

    // Mock Reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

    return context;
  }
});
