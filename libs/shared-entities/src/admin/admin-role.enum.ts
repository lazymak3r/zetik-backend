/**
 * Admin role enum defining permission levels
 *
 * @enum {string}
 * @property {string} MODERATOR - Moderator role with chat moderation permissions
 * @property {string} ADMIN - Standard admin with basic permissions
 * @property {string} SUPER_ADMIN - Super admin with full system access including sensitive operations
 */
export enum AdminRole {
  /**
   * Moderator role with chat moderation permissions (mute users, delete messages)
   */
  MODERATOR = 'moderator',

  /**
   * Standard admin role with limited permissions
   */
  ADMIN = 'admin',

  /**
   * Super admin role with full system access
   * Required for sensitive operations like provably fair system management
   */
  SUPER_ADMIN = 'super_admin',
}
