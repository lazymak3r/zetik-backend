import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@zetik/shared-entities';

/**
 * Roles metadata key for Reflector
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify required admin roles for a route or controller
 *
 * @param roles - One or more AdminRole values required to access the endpoint
 * @returns Method or class decorator
 *
 * @example
 * // Single role
 * @Roles(AdminRole.SUPER_ADMIN)
 * async deleteUser() { ... }
 *
 * @example
 * // Multiple roles (OR logic)
 * @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
 * async viewUsers() { ... }
 *
 * @example
 * // Controller-level (applies to all methods)
 * @Roles(AdminRole.SUPER_ADMIN)
 * @Controller('sensitive')
 * class SensitiveController { ... }
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
