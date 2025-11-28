import { BadRequestException, Controller, Get, Logger, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { BetFeedTab, IBetFeedItem, IBetFeedResponse } from '@zetik/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';

/**
 * Bet Feed REST Controller
 *
 * Provides fast REST API endpoint for initial bet feed data.
 * Reads from Redis cache populated by bet-feed-service.
 *
 * Design:
 * - All reads from Redis cache (< 1ms response time)
 * - Cache populated by bet-feed-service via events
 * - Fallback to empty response if cache miss
 * - WebSocket updates handled by bet-feed-service
 */
@ApiTags('Bet Feed')
@Controller('bet-feed')
export class BetFeedController {
  private readonly logger = new Logger(BetFeedController.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get initial bet feed for a specific tab
   *
   * This endpoint provides the initial bet feed data for clients.
   * After loading initial data, clients should connect to WebSocket
   * for real-time updates.
   *
   * Performance:
   * - Typical response time: < 1ms (Redis cache read)
   * - Cache populated by bet-feed-service on bet creation
   * - Cache refreshed every 10 seconds by bet-feed-service
   *
   * @param tab - Bet feed tab type (all-bets, lucky-winners, zetiks)
   * @returns Initial bet feed data with up to 50 recent bets
   */
  @Get(':tab')
  @ApiOperation({
    summary: 'Get initial bet feed data',
    description:
      'Retrieve cached bet feed data for a specific tab. Use this endpoint for initial page load, ' +
      'then connect to WebSocket for real-time updates. Data is cached in Redis and updated in real-time ' +
      'by the bet-feed-service.',
  })
  @ApiParam({
    name: 'tab',
    enum: BetFeedTab,
    description: 'Bet feed tab type',
    example: BetFeedTab.ALL_BETS,
  })
  @ApiResponse({
    status: 200,
    description: 'Bet feed data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        bets: {
          type: 'array',
          description: 'Array of bet feed items (up to 50)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'bet_123456' },
              game: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Dice' },
                  iconName: { type: 'string', example: 'dice-icon' },
                  imageName: { type: 'string', example: 'dice-image' },
                },
              },
              user: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', example: 'user_123' },
                  name: { type: 'string', example: 'Player1' },
                  imageName: { type: 'string', example: 'vip-gold.png' },
                },
              },
              time: { type: 'string', format: 'date-time', example: '2025-10-10T12:00:00.000Z' },
              bet: { type: 'string', example: '10.5' },
              multiplier: { type: 'string', example: '2.5' },
              payout: { type: 'string', example: '26.25' },
              cryptoAsset: { type: 'string', example: 'USDT' },
              assetImagePath: { type: 'string', example: 'usdt' },
            },
          },
        },
        lastUpdate: { type: 'string', format: 'date-time', example: '2025-10-10T12:00:00.000Z' },
        tab: { type: 'string', enum: Object.values(BetFeedTab), example: BetFeedTab.ALL_BETS },
        totalCount: { type: 'number', example: 50 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid tab parameter',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Invalid tab: invalid-tab. Must be one of: all-bets, lucky-winners, zetiks',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (Redis connection failure)',
  })
  async getInitialFeed(@Param('tab') tab: string): Promise<IBetFeedResponse> {
    // Validate tab parameter
    const validTab = this.validateTab(tab);
    if (!validTab) {
      throw new BadRequestException(
        `Invalid tab: ${tab}. Must be one of: ${Object.values(BetFeedTab).join(', ')}`,
      );
    }

    try {
      // Get from Redis cache
      const key = `bet-feed:${validTab}`;
      const cached = await this.redisService.get(key);

      if (cached) {
        const bets = JSON.parse(cached);

        // Filter private users on output (Redis stores full data)
        const filteredBets = await this.filterPrivateUsers(bets);

        return {
          bets: filteredBets,
          lastUpdate: new Date().toISOString(),
          tab: validTab,
          totalCount: filteredBets.length,
        };
      }

      // Cache miss - return empty (bet-feed-service will populate on first bet)

      return {
        bets: [],
        lastUpdate: new Date().toISOString(),
        tab: validTab,
        totalCount: 0,
      };
    } catch (error) {
      // Log error but don't expose internal details to client
      this.logger.error(`❌ Failed to fetch bet feed for ${validTab}:`, error);

      // Graceful degradation: return empty feed instead of throwing
      // This ensures the API remains available even if Redis is down
      return {
        bets: [],
        lastUpdate: new Date().toISOString(),
        tab: validTab,
        totalCount: 0,
      };
    }
  }

  /**
   * Validate tab parameter against allowed values
   *
   * @param tab - Tab string from request
   * @returns Validated BetFeedTab enum or null if invalid
   */
  private validateTab(tab: string): BetFeedTab | null {
    const validTabs = Object.values(BetFeedTab);
    return validTabs.includes(tab as BetFeedTab) ? (tab as BetFeedTab) : null;
  }

  /**
   * Filter private users from bet feed items
   * Redis stores full user data, we mask it only on output
   * Checks current isPrivate status from DB
   */
  private async filterPrivateUsers(feedItems: IBetFeedItem[]): Promise<IBetFeedItem[]> {
    // Get unique user IDs from feed items
    const userIds = feedItems
      .map((item) => item.user?.id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length === 0) {
      return feedItems;
    }

    // Batch fetch isPrivate status for all users
    const users = await this.dataSource.query(
      `SELECT id, "isPrivate" FROM users.users WHERE id = ANY($1)`,
      [userIds],
    );

    const privateUserIds = new Set(users.filter((u: any) => u.isPrivate).map((u: any) => u.id));

    // Replace user with null if private
    return feedItems.map((item) => {
      if (item.user?.id && privateUserIds.has(item.user.id)) {
        return { ...item, user: null };
      }
      return item;
    });
  }
}
