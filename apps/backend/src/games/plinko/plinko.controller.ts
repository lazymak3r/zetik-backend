import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { PlacePlinkoBetDto } from './dto/place-plinko-bet.dto';
import { PlinkoConfigResponseDto, PlinkoGameResponseDto } from './dto/plinko-game-response.dto';
import { PlinkoService } from './plinko.service';

@ApiTags('games/plinko')
@Controller('games/plinko')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiBearerAuth()
export class PlinkoController {
  constructor(private readonly plinkoService: PlinkoService) {}

  // POST /games/plinko/bet — Place a Plinko bet
  @Post('bet')
  @ApiOperation({
    summary: 'Place a Plinko bet',
    description:
      'Drop a ball on the Plinko board with specified risk level and row count. Uses provably fair system for bucket determination.',
  })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    type: PlinkoGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bet parameters or insufficient balance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async placeBet(
    @CurrentUser() user: UserEntity,
    @Body() dto: PlacePlinkoBetDto,
  ): Promise<PlinkoGameResponseDto> {
    return this.plinkoService.placeBet(user, dto);
  }

  // GET /games/plinko/config — Get Plinko game configuration
  @Get('config')
  @ApiOperation({
    summary: 'Get Plinko game configuration',
    description: 'Get available risk levels, row counts, multiplier tables, and house edge.',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    type: PlinkoConfigResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getConfiguration(): PlinkoConfigResponseDto {
    return this.plinkoService.getConfiguration();
  }

  // GET /games/plinko/history — Get Plinko game history
  @Get('history')
  @ApiOperation({
    summary: 'Get Plinko game history',
    description: 'Get the game history for the current user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of games to return (default: 50)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of games to skip (default: 0)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Game history retrieved successfully',
    type: [PlinkoGameResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<PlinkoGameResponseDto[]> {
    return this.plinkoService.getGameHistory(user.id, limit, offset);
  }

  // GET /games/plinko/game/:gameId — Get specific Plinko game details
  @Get('game/:gameId')
  @ApiOperation({
    summary: 'Get specific Plinko game details',
    description:
      'Get details of a specific Plinko game by ID. Works for both authenticated and logged-out users.',
  })
  @Public()
  @ApiParam({
    name: 'gameId',
    description: 'Unique game ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Game details retrieved successfully',
    type: PlinkoGameResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  async getGameById(
    @Param('gameId', ParseUUIDPipe) gameId: string,
  ): Promise<PlinkoGameResponseDto | null> {
    return this.plinkoService.getGameById(gameId);
  }
}
