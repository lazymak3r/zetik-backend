import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser, CurrentUserOptional } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { AutoplayMinesDto } from './dto/autoplay-mines.dto';
import { CashoutMinesDto } from './dto/cashout-mines.dto';
import { MinesGameResponseDto } from './dto/mines-game-response.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { StartMinesGameDto } from './dto/start-mines-game.dto';
import { MinesService } from './mines.service';

@ApiTags('games/mines')
@Controller('games/mines')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiBearerAuth()
export class MinesController {
  constructor(private readonly minesService: MinesService) {}

  // POST /games/mines/start — Start a new mines game
  @Post('start')
  @ApiOperation({
    summary: 'Start a new mines game',
    description: 'Start a new mines game with specified mine count. Uses provably fair system.',
  })
  @ApiResponse({
    status: 201,
    description: 'Game started successfully',
    type: MinesGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid game parameters or insufficient balance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async startGame(
    @CurrentUser() user: UserEntity,
    @Body() startGameDto: StartMinesGameDto,
  ): Promise<MinesGameResponseDto> {
    return this.minesService.startGame(user, startGameDto);
  }

  // POST /games/mines/reveal — Reveal a tile in the mines game
  @Post('reveal')
  @ApiOperation({
    summary: 'Reveal a tile in the mines game',
    description: 'Reveal a specific tile position. Game ends if a mine is hit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tile revealed successfully',
    type: MinesGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid tile position or game not active',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async revealTile(
    @CurrentUser() user: UserEntity,
    @Body() revealTileDto: RevealTileDto,
  ): Promise<MinesGameResponseDto> {
    return this.minesService.revealTile(user, revealTileDto);
  }

  // POST /games/mines/cashout — Cash out from an active mines game
  @Post('cashout')
  @ApiOperation({
    summary: 'Cash out from an active mines game',
    description: 'Cash out winnings from the current game state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully cashed out',
    type: MinesGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cash out or game not active',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async cashout(
    @CurrentUser() user: UserEntity,
    @Body() cashoutDto: CashoutMinesDto,
  ): Promise<MinesGameResponseDto> {
    return this.minesService.cashout(user, cashoutDto);
  }

  // GET /games/mines/active — Get current active mines game
  @Get('active')
  @ApiOperation({
    summary: 'Get current active mines game',
    description: 'Get the current active mines game for the user, if any.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active game retrieved (null if no active game)',
    schema: {
      oneOf: [{ $ref: '#/components/schemas/MinesGameResponseDto' }, { type: 'null' }],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getActiveGame(@CurrentUser() user: UserEntity): Promise<MinesGameResponseDto | null> {
    return this.minesService.getActiveGame(user.id);
  }

  // GET /games/mines/history — Get mines game history
  @Get('history')
  @ApiOperation({
    summary: 'Get mines game history',
    description: 'Get the game history for the current user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of games to return (default: 50, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Game history retrieved successfully',
    type: [MinesGameResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<MinesGameResponseDto[]> {
    const validLimit = Math.min(limit || 50, 100);
    return this.minesService.getGameHistory(user.id, validLimit);
  }

  // GET /games/mines/details/:gameId — Get mines game details
  @Get('details/:gameId')
  @ApiOperation({
    summary: 'Get mines game details',
    description:
      'Get detailed information about a specific mines game. Works for both authenticated and logged-out users.',
  })
  @Public()
  @ApiResponse({
    status: 200,
    description: 'Game details retrieved successfully',
    type: MinesGameResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
  })
  async getGameDetails(
    @CurrentUserOptional() user: UserEntity | undefined,
    @Param('gameId') gameId: string,
  ): Promise<MinesGameResponseDto> {
    return this.minesService.getGameDetails(gameId);
  }

  // POST /games/mines/autoplay — Play mines game automatically
  @Post('autoplay')
  @ApiOperation({
    summary: 'Play mines game automatically',
    description: 'Create game, reveal specified tiles, and cashout in one atomic operation',
  })
  @ApiResponse({
    status: 201,
    description: 'Autoplay completed successfully',
    type: MinesGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or insufficient balance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async autoplay(
    @CurrentUser() user: UserEntity,
    @Body() autoplayDto: AutoplayMinesDto,
  ): Promise<MinesGameResponseDto> {
    return this.minesService.autoplay(user, autoplayDto);
  }
}
