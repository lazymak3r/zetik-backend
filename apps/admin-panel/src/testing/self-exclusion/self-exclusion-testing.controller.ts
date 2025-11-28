import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SelfExclusionEntity } from '@zetik/shared-entities';
import { SelfExclusionTestingService } from './self-exclusion-testing.service';

/**
 * Testing controller for self-exclusion functionality
 * Provides endpoints to manipulate timestamps for testing without waiting 24 hours
 *
 * IMPORTANT: This controller should only be available in development/staging environments
 */
@ApiTags('Testing - Self-Exclusion')
@Controller('testing/self-exclusion')
export class SelfExclusionTestingController {
  constructor(private readonly testingService: SelfExclusionTestingService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get all self-exclusions for a user',
    description: 'Returns all self-exclusion records for the specified user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'User self-exclusions retrieved successfully',
    type: [SelfExclusionEntity],
  })
  async getUserSelfExclusions(@Param('userId') userId: string): Promise<SelfExclusionEntity[]> {
    return this.testingService.getUserSelfExclusions(userId);
  }

  @Get('gambling-limits/:userId')
  @ApiOperation({
    summary: "Get user's gambling limits",
    description: 'Returns all active gambling limits (deposit, loss, wager) for the specified user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'User gambling limits retrieved successfully',
  })
  async getUserGamblingLimits(@Param('userId') userId: string): Promise<{
    depositLimits: SelfExclusionEntity[];
    lossLimits: SelfExclusionEntity[];
    wagerLimits: SelfExclusionEntity[];
  }> {
    return this.testingService.getUserGamblingLimits(userId);
  }

  @Post('expire-cooldown/:id')
  @ApiOperation({
    summary: 'Expire cooldown and start post-cooldown window',
    description:
      'Sets cooldown endDate to 1 hour ago and postCooldownWindowEnd to 24 hours from now. This simulates a cooldown that has expired and entered the post-cooldown window where user can extend to permanent/temporary exclusion.',
  })
  @ApiParam({
    name: 'id',
    description: 'Self-exclusion ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooldown expired and post-cooldown window started',
    type: SelfExclusionEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Cooldown not found',
  })
  async testExpireCooldown(@Param('id') id: string): Promise<SelfExclusionEntity> {
    return this.testingService.testExpireCooldown(id);
  }

  @Post('expire-window/:id')
  @ApiOperation({
    summary: 'Expire post-cooldown window',
    description:
      'Sets postCooldownWindowEnd to 1 hour ago. This triggers silent revert to normal on next cron run (the cooldown record will be deleted).',
  })
  @ApiParam({
    name: 'id',
    description: 'Self-exclusion ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Post-cooldown window expired',
    type: SelfExclusionEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Self-exclusion not found',
  })
  async testExpireWindow(@Param('id') id: string): Promise<SelfExclusionEntity> {
    return this.testingService.testExpireWindow(id);
  }

  @Post('expire-removal/:id')
  @ApiOperation({
    summary: 'Expire removal countdown',
    description:
      'Sets removalRequestedAt to 25 hours ago. This triggers deletion of the limit on next cron run.',
  })
  @ApiParam({
    name: 'id',
    description: 'Self-exclusion ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Removal countdown expired',
    type: SelfExclusionEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Self-exclusion not found',
  })
  async testExpireRemoval(@Param('id') id: string): Promise<SelfExclusionEntity> {
    return this.testingService.testExpireRemoval(id);
  }

  @Post('run-cron')
  @ApiOperation({
    summary: 'Manually trigger expiration cron job',
    description:
      'Manually runs the self-exclusion expiration logic that normally runs every 5 minutes. This processes all expired cooldowns, windows, temporary exclusions, and removal countdowns.',
  })
  @ApiResponse({
    status: 200,
    description: 'Expiration cron job completed successfully',
  })
  async triggerExpirationCron(): Promise<{
    expiredCooldowns: number;
    expiredWindows: number;
    expiredTemporary: number;
    removedLimits: number;
  }> {
    return this.testingService.triggerExpirationCron();
  }
}
