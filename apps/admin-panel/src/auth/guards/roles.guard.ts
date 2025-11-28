import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@zetik/shared-entities';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that enforces role-based access control for admin endpoints
 *
 * This guard must be used AFTER JwtAuthGuard as it relies on the user object
 * being attached to the request by the authentication guard.
 *
 * @example
 * // Controller-level usage
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(AdminRole.SUPER_ADMIN)
 * @Controller('provably-fair')
 * export class ProvablyFairController { ... }
 *
 * @example
 * // Method-level usage
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(AdminRole.SUPER_ADMIN)
 * @Delete(':id')
 * async deleteUser(@Param('id') id: string) { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  /**
   * Determines if the current request can proceed based on role requirements
   *
   * @param context - Execution context containing request information
   * @returns true if user has required role, throws exception otherwise
   * @throws UnauthorizedException if user is not authenticated
   * @throws ForbiddenException if user lacks required role
   */
  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator metadata (checks both method and class level)
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access (no role restriction)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (populated by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (this should be caught by JwtAuthGuard, but double-check)
    if (!user) {
      this.logger.error('RolesGuard: User not found in request. Ensure JwtAuthGuard runs first.');
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user's role matches any of the required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied for user ${user.id} (${user.email}) with role ${user.role}. ` +
          `Required roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    this.logger.debug(`Access granted for user ${user.id} (${user.email}) with role ${user.role}`);

    return true;
  }
}
