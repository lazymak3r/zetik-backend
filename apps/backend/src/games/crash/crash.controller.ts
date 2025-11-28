import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser, CurrentUserOptional } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { CrashService } from './crash.service';
import { CashOutDto } from './dto/cash-out.dto';
import { CrashBetDetailsResponseDto } from './dto/crash-bet-details-response.dto';
import { CrashGameDetailsResponseDto } from './dto/crash-game-details-response.dto';
import { CrashGameWithUserResponseDto } from './dto/crash-game-with-user-response.dto';
import { CrashLeaderboardEntryDto } from './dto/crash-leaderboard-entry.dto';
import { PlaceCrashBetDto } from './dto/place-crash-bet.dto';

@ApiTags('crash')
@Controller('games/crash')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiCookieAuth()
export class CrashController {
  constructor(private readonly crashService: CrashService) {}

  // GET /games/crash/current — Get current crash game with user data
  @Get('current')
  @ApiOperation({ summary: 'Get current crash game information with user data' })
  @ApiResponse({
    status: 200,
    description: 'Current game state with user-specific information',
    type: CrashGameWithUserResponseDto,
  })
  async getCurrentGame() {
    const game = await this.crashService.getCurrentGameWithUser();

    if (!game) {
      throw new BadRequestException('No active game found');
    }

    return game;
  }

  // POST /games/crash/bet — Place a crash bet
  @Post('bet')
  @ApiOperation({ summary: 'Place a bet on the crash game' })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        betAmount: { type: 'string' },
        autoCashOutAt: { type: 'string' },
        status: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid bet or game not available' })
  async placeBet(@CurrentUser() user: UserEntity, @Body() dto: PlaceCrashBetDto) {
    return this.crashService.placeBet(user, dto);
  }

  // POST /games/crash/cashout — Cash out an active bet
  @Post('cashout')
  @ApiOperation({ summary: 'Cash out an active bet' })
  @ApiResponse({
    status: 200,
    description: 'Successfully cashed out',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        betAmount: { type: 'string' },
        status: { type: 'string' },
        cashOutAt: { type: 'string' },
        winAmount: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot cash out or bet not found' })
  async cashOut(@CurrentUser() user: UserEntity, @Body() dto: CashOutDto) {
    return this.crashService.cashOut(user.id, dto.betId);
  }

  // GET /games/crash/my-bets — Get user recent bets
  @Get('my-bets')
  @ApiOperation({ summary: 'Get user recent bets' })
  @ApiResponse({
    status: 200,
    description: 'User recent bets (last 20 bets across all games)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          betAmount: { type: 'string' },
          autoCashOutAt: { type: 'string' },
          status: { type: 'string' },
          cashOutAt: { type: 'string' },
          winAmount: { type: 'string' },
        },
      },
    },
  })
  async getMyBets(@CurrentUser() user: UserEntity) {
    return this.crashService.getUserBets(user.id);
  }

  // GET /games/crash/:betId — Get specific crash bet details
  @Get(':betId')
  @ApiOperation({
    summary: 'Get specific crash bet details. Works for both authenticated and logged-out users.',
  })
  @Public()
  @ApiParam({
    name: 'betId',
    type: 'string',
    description: 'UUID of the bet',
  })
  @ApiResponse({
    status: 200,
    description: 'Bet details retrieved successfully',
    type: CrashBetDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bet not found',
  })
  async getBetById(
    @CurrentUserOptional() user: UserEntity | undefined,
    @Param('betId', ParseUUIDPipe) betId: string,
  ): Promise<CrashBetDetailsResponseDto> {
    return this.crashService.getBetById(betId, user?.id);
  }

  // GET /games/crash/history/last-crashed — Get last crashed games
  @Get('history/last-crashed')
  @ApiOperation({ summary: 'Get last 10 crashed games history (global, not only my games)' })
  @ApiResponse({
    status: 200,
    description: 'Last 10 crashed game details',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '18cea3f2-c431-4ba0-a4d8-d1fb77689c5f' },
          status: { type: 'string', example: 'CRASHED' },
          crashPoint: { type: 'string', example: '3.10000000' },
          serverSeedHash: {
            type: 'string',
            example: '801d99347f7a149908b80ba9d770cc8ccf5905b85e12b25359dc66e9826e7e68',
          },
          nonce: { type: 'string', example: '1754604326976' },
          crashedAt: { type: 'string', format: 'date-time', example: '2025-08-07T22:05:51.646Z' },
          winnersExist: { type: 'boolean', example: true },
          betId: {
            type: 'string',
            nullable: true,
            example: '96f8a652-222a-4762-8ed5-c8f58fdfc6f9',
            description: 'Representative winning betId if any winners exist',
          },
        },
        required: [
          'id',
          'status',
          'crashPoint',
          'serverSeedHash',
          'nonce',
          'crashedAt',
          'winnersExist',
        ],
      },
      example: [
        {
          id: '18cea3f2-c431-4ba0-a4d8-d1fb77689c5f',
          status: 'CRASHED',
          crashPoint: '3.10000000',
          serverSeedHash: '801d99347f7a149908b80ba9d770cc8ccf5905b85e12b25359dc66e9826e7e68',
          nonce: '1754604326976',
          crashedAt: '2025-08-07T22:05:51.646Z',
          winnersExist: true,
          betId: '96f8a652-222a-4762-8ed5-c8f58fdfc6f9',
        },
        {
          id: 'd50f0748-957d-4cc3-a040-0da12a7f9057',
          status: 'CRASHED',
          crashPoint: '13.52000000',
          serverSeedHash: 'b74bd37703e7513d9d8c53f25231701cd6bb4281ce62571fc798e48a46d951f8',
          nonce: '1754603188341',
          crashedAt: '2025-08-07T21:47:10.483Z',
          winnersExist: false,
          betId: null,
        },
      ],
    },
  })
  async getLastCrashedGames(@Request() req: any) {
    const userId = req.user?.id;
    return this.crashService.getLastCrashedGames(userId);
  }

  // GET /games/crash/games/:gameId — Get crash game details
  @Get('games/:gameId')
  @ApiOperation({ summary: 'Get crash game details by game ID' })
  @ApiParam({
    name: 'gameId',
    description: 'The ID of the crash game',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Game details retrieved successfully',
    type: CrashGameDetailsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async getGameDetails(
    @CurrentUser() user: UserEntity,
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<CrashGameDetailsResponseDto> {
    return this.crashService.getGameDetails(gameId, user.id);
  }

  // GET /games/crash/games/:gameId/leaderboard — Get game leaderboard
  @Get('games/:gameId/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a specific crash game' })
  @ApiParam({
    name: 'gameId',
    description: 'The ID of the crash game',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Game leaderboard sorted by winnings',
    type: CrashLeaderboardEntryDto,
    isArray: true,
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async getGameLeaderboard(@Param('gameId', ParseUUIDPipe) gameId: string) {
    return this.crashService.getGameLeaderboard(gameId);
  }

  // POST /games/crash/testing/set-next-crash-point — Set next crash point (dev only)
  @Post('testing/set-next-crash-point')
  @ApiOperation({ summary: 'Force set next crash point for testing (dev only)' })
  @ApiResponse({
    status: 200,
    description: 'Next crash point set successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        nextCrashPoint: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Not available in production environment',
  })
  setNextCrashPoint(@Body() body: { crashPoint: number }, @CurrentUser() user: UserEntity) {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Testing endpoints not available in production');
    }

    return this.crashService.setNextCrashPointForTesting(body.crashPoint, user.id);
  }
}
