import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GameLaunchInputDto } from './dto/game-launch.dto';
import { GetCategoriesResponseDto } from './dto/get-categories-response.dto';
import { GetDevelopersResponseDto } from './dto/get-developers-response.dto';
import { GetGameResponseDto } from './dto/get-game-response.dto';
import { GetGamesResponseDto } from './dto/get-games-response.dto';
import { GetProviderFavoritesResponseDto } from './dto/get-provider-favorites-response.dto';
import { LaunchGameResponseDto } from './dto/launch-game-response.dto';
import { ProviderGameFavoriteDto } from './dto/provider-game-favorite.dto';
import { SyncGamesResponseDto } from './dto/sync-games-response.dto';
import { ProviderGamesGroupEnum } from './enums/provider-games-group.enum';
import { GamesSyncService } from './games-sync.service';
import { ISt8LaunchGameResponse } from './interfaces/st8-types.interface';
import { ProviderGamesService } from './provider-games.service';
import { ProviderFavoritesService } from './services/provider-favorites.service';
import { St8Service } from './st8.service';

@ApiTags('provider-games')
@Controller('provider-games')
export class ProviderGamesController {
  constructor(
    private readonly st8Service: St8Service,
    private readonly gamesSyncService: GamesSyncService,
    private readonly providerGamesService: ProviderGamesService,
    private readonly providerFavoritesService: ProviderFavoritesService,
  ) {}

  @Get('games')
  @ApiOperation({ summary: 'Get all available games' })
  @ApiResponse({
    status: 200,
    description: 'List of all games from database',
    type: GetGamesResponseDto,
  })
  @ApiQuery({
    name: 'developerCode',
    required: false,
    description:
      'Filter games by developer code(s). Can be passed multiple times: ?developerCode=code1&developerCode=code2',
    type: [String],
    isArray: true,
  })
  @ApiQuery({
    name: 'group',
    required: false,
    description:
      "Group filter: one of 'slots', 'live-casino', 'game-shows', 'blackjack', 'roulette', 'baccarat', 'new-releases'",
    enum: Object.values(ProviderGamesGroupEnum),
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search games by name (case-insensitive, partial match)',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 50, max: 100)',
    type: Number,
  })
  async getGames(
    @Query('developerCode', new ParseArrayPipe({ items: String, separator: ',', optional: true }))
    developerCodes?: string[],
    @Query('group', new ParseEnumPipe(ProviderGamesGroupEnum, { optional: true }))
    group?: ProviderGamesGroupEnum,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<GetGamesResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 50;

    return this.providerGamesService.getGames({
      developerCodes,
      group,
      search,
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get('games/:code')
  @ApiOperation({ summary: 'Get game by code' })
  @ApiResponse({
    status: 200,
    description: 'Game details',
    type: GetGameResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async getGameByCode(@Param('code') code: string): Promise<GetGameResponseDto> {
    const game = await this.providerGamesService.getGameByCode(code);
    return { game };
  }

  @ApiOperation({ summary: 'Get all game developers' })
  @ApiResponse({
    status: 200,
    description: 'List of all game developers from database with game counts',
    type: GetDevelopersResponseDto,
  })
  @Get('developers')
  async getDevelopers(): Promise<GetDevelopersResponseDto> {
    return { developers: await this.providerGamesService.getDevelopers() };
  }

  @ApiOperation({ summary: 'Get all game categories' })
  @ApiResponse({
    status: 200,
    description: 'List of all game categories from database',
    type: GetCategoriesResponseDto,
  })
  @Get('categories')
  async getCategories(): Promise<GetCategoriesResponseDto> {
    return { categories: await this.providerGamesService.getCategories() };
  }

  @Get('launch-url')
  @ApiOperation({ summary: 'Get game launch URL' })
  @ApiQuery({
    name: 'gameCode',
    required: true,
    description: 'Unique code identifying the game',
    type: String,
  })
  @ApiQuery({
    name: 'funMode',
    required: false,
    description: 'Flag to launch the game in fun mode (demo mode without real money)',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Game launch URL with token',
    type: LaunchGameResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - game code is required' })
  @ApiResponse({ status: 500, description: 'Failed to get launch game URL' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async launchGame(
    @CurrentUser() user: UserEntity,
    @Query() input: GameLaunchInputDto,
  ): Promise<ISt8LaunchGameResponse> {
    return this.st8Service.getLaunchGameUrl(user, input.gameCode, input.funMode);
  }

  @Get('/sync-games')
  @ApiOperation({
    summary:
      'Trigger games synchronization. This is only for the development stage of the project, REMOVE BEFORE THE RELEASE TO PRODUCTION!',
  })
  @ApiResponse({
    status: 200,
    description: 'Games synchronization status',
    type: SyncGamesResponseDto,
  })
  async syncGames(): Promise<SyncGamesResponseDto> {
    await this.gamesSyncService.triggerSync();
    return { status: 'success', message: 'Games synchronization triggered' };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get user favorite provider games' })
  @ApiResponse({
    status: 200,
    description:
      'Favorite provider games with full details (same structure as /provider-games/games)',
    type: GetProviderFavoritesResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 50, max: 100)',
    type: Number,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getUserFavorites(
    @CurrentUser() user: UserEntity,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<GetProviderFavoritesResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 50;

    return this.providerFavoritesService.getUserFavorites({
      userId: user.id,
      page: pageNum,
      limit: limitNum,
    });
  }

  @Post('favorites')
  @ApiOperation({ summary: 'Add provider game to favorites' })
  @ApiResponse({
    status: 200,
    description: 'Game added to favorites successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Provider game not found or not enabled' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async addFavoriteGame(
    @CurrentUser() user: UserEntity,
    @Body() dto: ProviderGameFavoriteDto,
  ): Promise<{ message: string }> {
    await this.providerFavoritesService.addGameToFavorites({
      userId: user.id,
      gameCode: dto.gameCode,
    });
    return { message: 'Game added to favorites successfully' };
  }

  @Delete('favorites')
  @ApiOperation({ summary: 'Remove provider game from favorites' })
  @ApiResponse({
    status: 200,
    description: 'Game removed from favorites successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async removeFavoriteGame(
    @CurrentUser() user: UserEntity,
    @Body() dto: ProviderGameFavoriteDto,
  ): Promise<{ message: string }> {
    await this.providerFavoritesService.removeGameFromFavorites({
      userId: user.id,
      gameCode: dto.gameCode,
    });
    return { message: 'Game removed from favorites successfully' };
  }
}
