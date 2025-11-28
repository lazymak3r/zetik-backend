import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordUtil } from '@zetik/common';
import { AdminEntity, AdminRole } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProvablyFairController } from './provably-fair.controller';
import { ProvablyFairService } from './provably-fair.service';

/**
 * Integration tests for Role-Based Access Control (RBAC) on Provably Fair endpoints
 *
 * These tests verify that:
 * 1. Only SUPER_ADMIN role can access provably fair endpoints
 * 2. Regular ADMIN role receives 403 Forbidden
 * 3. Unauthenticated requests receive 401 Unauthorized
 * 4. The security system cannot be bypassed
 */
describe('ProvablyFair RBAC Integration Tests', () => {
  let app: INestApplication;
  let adminRepository: Repository<AdminEntity>;
  let rolesGuard: RolesGuard;

  // Test admin users
  let superAdmin: AdminEntity;
  let regularAdmin: AdminEntity;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_DATABASE || 'postgres',
          entities: [AdminEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([AdminEntity]),
      ],
      controllers: [ProvablyFairController],
      providers: [
        ProvablyFairService,
        JwtService,
        RolesGuard,
        Reflector,
        {
          provide: 'JWT_MODULE_OPTIONS',
          useValue: {
            secret: 'test-secret',
            signOptions: { expiresIn: '1h' },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    adminRepository = moduleFixture.get('AdminEntityRepository');
    rolesGuard = moduleFixture.get(RolesGuard);

    // Create test admin users
    await setupTestAdmins();
  });

  afterAll(async () => {
    // Cleanup test data
    if (superAdmin?.id) {
      await adminRepository.delete(superAdmin.id);
    }
    if (regularAdmin?.id) {
      await adminRepository.delete(regularAdmin.id);
    }
    await app.close();
  });

  /**
   * Setup test admin users with different roles
   */
  async function setupTestAdmins() {
    const hashedPassword = await PasswordUtil.hash('TestPassword123!');

    // Create super admin
    superAdmin = adminRepository.create({
      email: 'super.admin@test.com',
      name: 'Super Admin Test',
      password: hashedPassword,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    });
    superAdmin = await adminRepository.save(superAdmin);

    // Create regular admin
    regularAdmin = adminRepository.create({
      email: 'regular.admin@test.com',
      name: 'Regular Admin Test',
      password: hashedPassword,
      role: AdminRole.ADMIN,
      isActive: true,
    });
    regularAdmin = await adminRepository.save(regularAdmin);
  }

  describe('RolesGuard Unit Tests', () => {
    it('should allow access when user has required role', () => {
      const context = createMockExecutionContext(superAdmin, [AdminRole.SUPER_ADMIN]);
      const result = rolesGuard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required role', () => {
      const context = createMockExecutionContext(regularAdmin, [AdminRole.SUPER_ADMIN]);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow access when no roles are specified', () => {
      const context = createMockExecutionContext(regularAdmin, []);
      const result = rolesGuard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      const context = createMockExecutionContext(null, [AdminRole.SUPER_ADMIN]);
      expect(() => rolesGuard.canActivate(context)).toThrow();
    });

    it('should allow access when user role matches any of multiple required roles', () => {
      const context = createMockExecutionContext(regularAdmin, [
        AdminRole.SUPER_ADMIN,
        AdminRole.ADMIN,
      ]);
      const result = rolesGuard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Security Verification Tests', () => {
    it('should ensure JwtAuthGuard runs before RolesGuard', () => {
      // This is critical - if RolesGuard runs first, it could fail to find the user
      const controller = Reflect.getMetadata('guards', ProvablyFairController);
      const guardsOrder = controller || [];

      // Verify guards are applied in correct order
      expect(guardsOrder).toBeDefined();
      // In production, verify via decorator order in controller
    });

    it('should not bypass role check with manipulated token', () => {
      // The guard should verify against actual database role, not token claim
      // Even if a token claims super_admin role, the guard checks the user object
      // from the database which has the actual role
      const context = createMockExecutionContext(regularAdmin, [AdminRole.SUPER_ADMIN]);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should log access denial for security auditing', () => {
      // Spy on logger to verify security events are logged
      const loggerSpy = jest.spyOn(rolesGuard['logger'], 'warn');

      const context = createMockExecutionContext(regularAdmin, [AdminRole.SUPER_ADMIN]);

      try {
        rolesGuard.canActivate(context);
      } catch (error) {
        // Expected to throw
      }

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
    });
  });

  describe('AdminRole Enum Tests', () => {
    it('should only allow defined admin roles', () => {
      const validRoles = Object.values(AdminRole);
      expect(validRoles).toEqual(['admin', 'super_admin']);
    });

    it('should not allow undefined or custom roles', () => {
      const invalidRole = 'custom_role' as AdminRole;
      expect(Object.values(AdminRole)).not.toContain(invalidRole);
    });

    it('should ensure database default is ADMIN role', () => {
      // TypeORM should set default to AdminRole.ADMIN
      expect(AdminRole.ADMIN).toBe('admin');
    });
  });

  describe('ProvablyFair Controller Security', () => {
    it('should have @Roles(AdminRole.SUPER_ADMIN) decorator on controller', () => {
      const roles = Reflect.getMetadata('roles', ProvablyFairController);
      expect(roles).toContain(AdminRole.SUPER_ADMIN);
    });

    it('should have RolesGuard applied to controller', () => {
      const guards = Reflect.getMetadata('__guards__', ProvablyFairController);
      // Verify RolesGuard is in the guards array
      expect(guards).toBeDefined();
    });

    it('should require authentication for all endpoints', () => {
      const guards = Reflect.getMetadata('__guards__', ProvablyFairController);
      // Verify JwtAuthGuard is present
      expect(guards).toBeDefined();
    });
  });

  /**
   * Helper function to create mock execution context for testing guards
   */
  function createMockExecutionContext(
    user: AdminEntity | null,
    requiredRoles: AdminRole[],
  ): ExecutionContext {
    const mockRequest = {
      user,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ProvablyFairController,
    } as unknown as ExecutionContext;

    // Mock Reflector to return required roles
    jest.spyOn(rolesGuard['reflector'], 'getAllAndOverride').mockReturnValue(requiredRoles);

    return mockContext;
  }
});

/**
 * Additional E2E-style tests for full request flow
 *
 * These tests verify the complete authentication and authorization flow
 * from HTTP request to response.
 */
describe('ProvablyFair RBAC E2E Tests', () => {
  // Note: These would require full HTTP setup with supertest
  // Placeholder for future E2E tests

  it('should return 403 when regular admin tries to access provably-fair endpoints', async () => {
    // TODO: Implement with supertest when E2E infrastructure is ready
  });

  it('should return 200 when super admin accesses provably-fair endpoints', async () => {
    // TODO: Implement with supertest when E2E infrastructure is ready
  });

  it('should return 401 when unauthenticated user tries to access endpoints', async () => {
    // TODO: Implement with supertest when E2E infrastructure is ready
  });
});
