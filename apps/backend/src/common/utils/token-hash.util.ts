import { createHash } from 'crypto';

/**
 * Generate a deterministic SHA256 hash from a refresh token
 * Used for tracking active sessions in Redis
 * @param token The refresh token string
 * @returns SHA256 hex digest of the token
 */
export function computeTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
