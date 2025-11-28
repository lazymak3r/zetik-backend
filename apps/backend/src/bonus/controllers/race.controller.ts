import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser, CurrentUserOptional } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RaceHistoryResponseDto } from '../dto/race-history.dto';
import { RaceLeaderboardDto } from '../dto/race-leaderboard.dto';
import { RaceListDto } from '../dto/race.dto';
import { UserRaceStatsDto } from '../dto/user-race-stats.dto';
import { RaceService } from '../services/race.service';

@ApiTags('Bonus Races')
@Controller('bonus/races')
@UseGuards(JwtAuthGuard)
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get available races',
    description:
      'Returns Weekly + Monthly + Sponsored races. Users participate in all when betting. Works for both authenticated and logged-out users. Sponsored races with status PENDING or ACTIVE are shown. If no active sponsored races exist, the last ENDED sponsored race is displayed for up to 3 days after completion.',
  })
  @ApiResponse({ status: 200, description: 'List of available races', type: RaceListDto })
  @ApiBearerAuth()
  async getRaces(@CurrentUserOptional() user?: UserEntity): Promise<RaceListDto> {
    return this.raceService.listAvailableRaces(user?.referralCode);
  }

  // Public endpoint - leaderboards are intentionally accessible without authentication
  // Rate limiting should be handled at API Gateway/nginx level
  @Get(':referralCode/leaderboard')
  @ApiOperation({
    summary: 'Get race leaderboard by referral code',
    description:
      'Returns race leaderboard by referral code. Top 100 participants with prizes. Does NOT include current user position. Public endpoint without authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Race details with leaderboard',
    type: RaceLeaderboardDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid referral code format' })
  @ApiResponse({ status: 404, description: 'Race not found with this referral code' })
  async getRaceLeaderboardByReferralCode(
    @Param('referralCode') referralCode: string,
  ): Promise<RaceLeaderboardDto> {
    // Validate referral code format
    if (!referralCode || typeof referralCode !== 'string') {
      throw new BadRequestException('Referral code is required');
    }

    // Validate referral code length and format
    if (referralCode.length < 3 || referralCode.length > 50) {
      throw new BadRequestException('Referral code must be between 3 and 50 characters');
    }

    // Validate only alphanumeric, dashes, and underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(referralCode)) {
      throw new BadRequestException(
        'Referral code can only contain letters, numbers, dashes, and underscores',
      );
    }

    return this.raceService.getRaceLeaderboardByReferralCode(referralCode, 100);
  }

  @Get(':id/leaderboard')
  @ApiOperation({
    summary: 'Get race details and leaderboard',
    description:
      'Returns full race information including leaderboard. Top 100 participants with prizes. Does NOT include current user position (use /races/{id}/me for that).',
  })
  @ApiResponse({
    status: 200,
    description: 'Race details with leaderboard',
    type: RaceLeaderboardDto,
  })
  @ApiResponse({ status: 404, description: 'Race not found' })
  async getRaceLeaderboard(@Param('id') id: string): Promise<RaceLeaderboardDto> {
    return this.raceService.getRaceLeaderboard(id, 100);
  }

  @Get(':id/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my race stats',
    description: 'Returns current user statistics in the race (place, wagered, potential prize)',
  })
  @ApiResponse({ status: 200, description: 'User race statistics', type: UserRaceStatsDto })
  @ApiResponse({ status: 404, description: 'Race not found or user not participating' })
  async getMyRaceStats(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<UserRaceStatsDto | null> {
    return this.raceService.getUserRaceStats(id, user.id);
  }

  @Get('history/:userId')
  @Public()
  @ApiOperation({
    summary: 'Get user race history',
    description:
      'Returns paginated history of all races (active and finalized) where the user has a determined place. Only works if user has not hidden race statistics. Public endpoint - no authentication required.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 50)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Race history retrieved successfully',
    type: RaceHistoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid page or limit parameter',
  })
  async getUserRaceHistory(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<RaceHistoryResponseDto> {
    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 10;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      throw new BadRequestException('Invalid limit (1-50)');
    }

    return this.raceService.getUserRaceHistory(userId, pageNum, limitNum);
  }
}
