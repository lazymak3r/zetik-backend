import { Injectable, Logger } from '@nestjs/common';
import { SessionTrackingService } from '../../auth/services/session-tracking.service';

export interface IOnlineStatsResponse {
  activeUsers: number;
  timestamp: Date;
}

@Injectable()
export class OnlineStatsService {
  private readonly logger = new Logger(OnlineStatsService.name);

  constructor(private readonly sessionTrackingService: SessionTrackingService) {}

  /**
   * Get current count of active users based on session activity
   * Uses activity-based tracking (sessions active within 5 minutes)
   * @returns Object with activeUsers count and current timestamp
   */
  async getActiveUserCount(): Promise<IOnlineStatsResponse> {
    try {
      const count = await this.sessionTrackingService.getActiveUserCount();

      return {
        activeUsers: count,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get active user count', error);
      return {
        activeUsers: 0,
        timestamp: new Date(),
      };
    }
  }
}
