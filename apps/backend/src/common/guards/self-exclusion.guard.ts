import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SelfExclusionTypeEnum } from '@zetik/shared-entities';
import { SelfExclusionService } from '../../users/self-exclusion.service';

// Define a decorator metadata key for endpoints that should be allowed for users with self-exclusion
export const ALLOW_SELF_EXCLUDED = 'allowSelfExcluded';

@Injectable()
export class SelfExclusionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private selfExclusionService: SelfExclusionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the endpoint is explicitly allowed for self-excluded users
    const isAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_SELF_EXCLUDED, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If the endpoint is explicitly allowed, skip the check
    if (isAllowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is found, let the auth guard handle it
    if (!user) {
      return true;
    }

    // Check if the user has active self-exclusion
    const activeSelfExclusion = await this.selfExclusionService.hasActiveSelfExclusion(user.id);

    // If user has no active self-exclusion, allow access
    if (!activeSelfExclusion) {
      return true;
    }

    // User has active self-exclusion, block betting and provide appropriate error message
    if (activeSelfExclusion.type === SelfExclusionTypeEnum.PERMANENT) {
      throw new ForbiddenException(
        'You have permanently excluded yourself from the platform. You can only withdraw your funds.',
      );
    } else if (activeSelfExclusion.type === SelfExclusionTypeEnum.TEMPORARY) {
      const formattedTime = activeSelfExclusion.remainingTime
        ? this.selfExclusionService.formatRemainingTime(activeSelfExclusion.remainingTime)
        : 'the exclusion period';

      throw new ForbiddenException(
        `You have temporarily excluded yourself from the platform. You can only withdraw your funds. Your exclusion will end in ${formattedTime}.`,
      );
    } else if (activeSelfExclusion.type === SelfExclusionTypeEnum.COOLDOWN) {
      const formattedTime = activeSelfExclusion.remainingTime
        ? this.selfExclusionService.formatRemainingTime(activeSelfExclusion.remainingTime)
        : 'the cooldown period';

      // Check if user is in post-cooldown window (24h extension after cooldown expires)
      if (activeSelfExclusion.isInPostCooldownWindow) {
        throw new ForbiddenException(
          `You are currently in a 24-hour post-cooldown window. Betting is not allowed during this time. You can extend your cooldown to a self-exclusion or wait for the window to expire in ${formattedTime}.`,
        );
      } else {
        throw new ForbiddenException(
          `You have activated a cooldown period. Betting is not allowed during this time. Your cooldown will end in ${formattedTime}.`,
        );
      }
    }

    return false;
  }
}
