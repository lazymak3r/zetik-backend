import { SetMetadata } from '@nestjs/common';
import { ALLOW_SELF_EXCLUDED } from '../guards/self-exclusion.guard';

/**
 * Decorator to mark endpoints that should be allowed for users with self-exclusion
 * @returns Decorator function
 */
export const AllowSelfExcluded = () => SetMetadata(ALLOW_SELF_EXCLUDED, true);
