import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PlatformTypeEnum, UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { SelfExclusionService } from '../../users/self-exclusion.service';

@Injectable()
export class SelfExclusionInterceptor implements NestInterceptor {
  // List of URL patterns and HTTP methods that should be checked for self-exclusion
  private readonly BETTING_ENDPOINTS = [
    // Game betting endpoints
    { method: 'POST', pattern: /^\/v1\/games\/.*\/bet$/ },
    { method: 'POST', pattern: /^\/v1\/games\/.*\/place-bet$/ },
    { method: 'POST', pattern: /^\/v1\/games\/.*\/start$/ },
    { method: 'POST', pattern: /^\/v1\/games\/.*\/play$/ },

    // Specific game endpoints
    { method: 'POST', pattern: /^\/v1\/games\/dice\/bet$/ },
    { method: 'POST', pattern: /^\/v1\/games\/roulette\/bet$/ },
    { method: 'POST', pattern: /^\/v1\/games\/blackjack\/.*$/ },
    { method: 'POST', pattern: /^\/v1\/games\/crash\/.*$/ },
    { method: 'POST', pattern: /^\/v1\/games\/mines\/.*$/ },
    { method: 'POST', pattern: /^\/v1\/games\/plinko\/.*$/ },
    { method: 'POST', pattern: /^\/v1\/games\/limbo\/.*$/ },
    { method: 'POST', pattern: /^\/v1\/games\/keno\/.*$/ },

    // Provider games
    { method: 'POST', pattern: /^\/v1\/provider-games\/.*$/ },

    // WebSocket betting endpoints (handled by gateways)
    // These are handled separately since they don't go through HTTP interceptors
  ];

  constructor(private readonly selfExclusionService: SelfExclusionService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as UserEntity;

    // Skip if no user (unauthenticated requests)
    if (!user) {
      return next.handle();
    }

    // Check if this endpoint should be protected by self-exclusion
    if (this.shouldCheckSelfExclusion(request)) {
      // Check for active self-exclusions
      const activeExclusions = await this.selfExclusionService.getActiveSelfExclusions(
        user.id,
        PlatformTypeEnum.CASINO, // Default to CASINO, could be made dynamic based on endpoint
      );

      if (activeExclusions.length > 0) {
        // Find the most restrictive exclusion (platform-wide takes precedence)
        const platformExclusion = activeExclusions.find(
          (e) => e.platformType === PlatformTypeEnum.PLATFORM,
        );
        const casinoExclusion = activeExclusions.find(
          (e) => e.platformType === PlatformTypeEnum.CASINO,
        );

        const exclusion = platformExclusion || casinoExclusion;

        if (exclusion) {
          const endTime = exclusion.endDate ? new Date(exclusion.endDate) : null;
          const remainingTime = endTime ? this.formatRemainingTime(endTime) : 'permanently';

          throw new ForbiddenException(
            `You have temporarily excluded yourself from the platform. You can only withdraw your funds. Your exclusion will end in ${remainingTime}.`,
          );
        }
      }
    }

    return next.handle();
  }

  /**
   * Check if the current request should be subject to self-exclusion validation
   */
  private shouldCheckSelfExclusion(request: Request): boolean {
    const { method, url } = request;

    return this.BETTING_ENDPOINTS.some(
      (endpoint) => endpoint.method === method && endpoint.pattern.test(url),
    );
  }

  /**
   * Format remaining time until exclusion ends
   */
  private formatRemainingTime(endTime: Date): string {
    const now = new Date();
    const diffMs = endTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return '0 minutes';
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }
}
