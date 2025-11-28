import { AdminRole } from '@zetik/shared-entities';

export const MODERATION_LIMITS = {
  [AdminRole.MODERATOR]: {
    maxMuteDuration: 1440, // 24 hours in minutes
  },
  [AdminRole.ADMIN]: {
    maxMuteDuration: 10080, // 7 days in minutes
  },
  [AdminRole.SUPER_ADMIN]: {
    maxMuteDuration: 525600, // 1 year in minutes
  },
} as const;
