import { Body, Controller, Get, Param, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GameType } from '@zetik/shared-entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GameLiveStatsResponseDto } from './dto/game-config-admin-response.dto';
import { UpdateBetLimitsDto, UpdateBetLimitsResponseDto } from './dto/update-bet-limits.dto';
import { GamesService } from './games.service';
import { GameConfig } from './types/admin-game-config.types';

@ApiTags('Admin Games')
@ApiBearerAuth()
@Controller('games')
@UseGuards(JwtAuthGuard)
export class AdminPanelGamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('live-stats')
  @ApiOperation({ summary: 'Get live game statistics' })
  @ApiResponse({
    status: 200,
    description: 'Live game statistics',
    type: GameLiveStatsResponseDto,
  })
  getLiveStats(): GameLiveStatsResponseDto {
    const stats = this.gamesService.getGameStats();
    return { stats, timestamp: new Date() };
  }

  @Get('configs')
  @ApiOperation({ summary: 'Get all game configurations as simple array' })
  @ApiResponse({
    status: 200,
    description: 'Simple array of game configurations',
  })
  async getGameConfigs(): Promise<GameConfig[]> {
    return await this.gamesService.getGameConfigs();
  }

  @Get()
  @ApiOperation({ summary: 'Get general games information' })
  @ApiResponse({
    status: 200,
    description: 'General games endpoint information',
  })
  getGames() {
    return {
      message: 'Admin Games Controller - WORKING',
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /games/configs - Get all game configurations',
        'GET /games/live-stats - Get live game statistics',
      ],
      supportedGameTypes: Object.values(GameType),
    };
  }

  @Get('test')
  getTest() {
    return {
      message: 'REAL Admin Panel Games Controller Test - SUCCESS',
      timestamp: new Date().toISOString(),
      controller: 'AdminPanelGamesController',
      service: this.gamesService.constructor.name,
    };
  }

  @Put('bet-limits/:gameType')
  @ApiOperation({ summary: 'Update bet limits for a specific game type' })
  @ApiParam({
    name: 'gameType',
    enum: GameType,
    description: 'Game type to update bet limits for',
  })
  @ApiResponse({
    status: 200,
    description: 'Bet limits updated successfully',
    type: UpdateBetLimitsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Game type not found',
  })
  async updateBetLimits(
    @Param('gameType') gameType: GameType,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateBetLimitsDto,
  ): Promise<UpdateBetLimitsResponseDto> {
    // Validate that minBet < maxBet
    if (dto.minBetUsd >= dto.maxBetUsd) {
      throw new Error('Minimum bet must be less than maximum bet');
    }

    await this.gamesService.updateBetLimits(
      gameType,
      dto.minBetUsd,
      dto.maxBetUsd,
      dto.maxPayoutUsd,
    );

    return {
      message: `Bet limits updated successfully for ${gameType}`,
      gameType,
      minBetUsd: dto.minBetUsd,
      maxBetUsd: dto.maxBetUsd,
      maxPayoutUsd: dto.maxPayoutUsd,
    };
  }

  @Get('bet-type-limits')
  @ApiOperation({ summary: 'Get all bet type limits (detailed limits for specific bet types)' })
  @ApiResponse({
    status: 200,
    description: 'List of all bet type limits retrieved successfully',
  })
  async getAllBetTypeLimits() {
    return await this.gamesService.getAllBetTypeLimits();
  }

  @Get('bet-type-limits/:gameType')
  @ApiOperation({ summary: 'Get bet type limits for a specific game' })
  @ApiParam({
    name: 'gameType',
    description: 'Game type to get bet type limits for',
    enum: Object.values(GameType),
  })
  @ApiResponse({
    status: 200,
    description: 'Bet type limits retrieved successfully',
  })
  async getBetTypeLimitsByGame(@Param('gameType') gameType: GameType) {
    return await this.gamesService.getBetTypeLimitsByGame(gameType);
  }

  @Put('bet-type-limits/:id')
  @ApiOperation({ summary: 'Update specific bet type limits' })
  @ApiParam({
    name: 'id',
    description: 'Bet type limit ID to update',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        minBetUsd: { type: 'number', minimum: 0 },
        maxBetUsd: { type: 'number', minimum: 0 },
      },
      required: ['minBetUsd', 'maxBetUsd'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Bet type limits updated successfully',
  })
  async updateBetTypeLimits(
    @Param('id') id: string,
    @Body() dto: { minBetUsd: number; maxBetUsd: number },
  ): Promise<{ message: string; id: string; minBetUsd: number; maxBetUsd: number }> {
    // Validate that minBet < maxBet
    if (dto.minBetUsd >= dto.maxBetUsd) {
      throw new Error('Minimum bet must be less than maximum bet');
    }

    await this.gamesService.updateBetTypeLimits(id, dto.minBetUsd, dto.maxBetUsd, 'admin');

    return {
      message: `Bet type limits updated successfully for ID ${id}`,
      id,
      minBetUsd: dto.minBetUsd,
      maxBetUsd: dto.maxBetUsd,
    };
  }
}
