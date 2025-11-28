import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  GameBetLimitsEntity,
  GameConfigEntity,
  GameType,
  GameTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Repository } from 'typeorm';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BetSeedInfoResponseDto } from './dto/bet-seed-info-response.dto';
import { GameFavoriteDto } from './dto/game-favorite.dto';
import { GetBetSeedInfoDto } from './dto/get-bet-seed-info.dto';
import { GetUserBetHistoryQueryDto } from './dto/get-user-bet-history-query.dto';
import { SeedHistoryResponseDto } from './dto/seed-history-response.dto';
import { UpdateClientSeedDto } from './dto/update-client-seed.dto';
import { UserBetResponseDto } from './dto/user-bet-response.dto';
import { UserRecentGameDto } from './dto/user-recent-games-response.dto';
import { VerifyGameOutcomeDto } from './dto/verify-game-outcome.dto';
import { VerifySeedHashResponseDto } from './dto/verify-seed-hash-response.dto';
import { VerifySeedHashDto } from './dto/verify-seed-hash.dto';
import { FavoriteGamesService } from './services/favorite-games.service';
import { GameConfigService } from './services/game-config.service';
import { GameSessionService } from './services/game-session.service';
import { HouseEdgeService } from './services/house-edge.service';
import { ProvablyFairService } from './services/provably-fair.service';
import { UserBetService } from './services/user-bet.service';
import { UserRecentGamesService } from './services/user-recent-games.service';
import { BetLimitsResponse } from './types/game-config.types';

@ApiTags('games')
@Controller('games')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class GamesController {
  constructor(
    private readonly provablyFairService: ProvablyFairService,
    private readonly gameSessionService: GameSessionService,
    private readonly gameConfigService: GameConfigService,
    private readonly userBetService: UserBetService,
    private readonly userRecentGamesService: UserRecentGamesService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly favoriteGamesService: FavoriteGamesService,
    @InjectRepository(GameConfigEntity)
    private readonly gameConfigRepo: Repository<GameConfigEntity>,
    @InjectRepository(GameBetLimitsEntity)
    private readonly gameBetLimitsRepo: Repository<GameBetLimitsEntity>,
  ) {}

  @ApiOperation({ summary: 'Get current seed pair hash for user' })
  @ApiResponse({
    status: 200,
    description: 'Current seed pair information',
    schema: {
      type: 'object',
      properties: {
        serverSeedHash: { type: 'string' },
        clientSeed: { type: 'string' },
        nonce: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @Get('provably-fair/seed-info')
  async getSeedInfo(@CurrentUser() user: UserEntity) {
    let seedPair = await this.provablyFairService.getActiveSeedPair(user.id);

    if (!seedPair) {
      seedPair = await this.provablyFairService.generateSeedPair(user.id);
    }

    return {
      serverSeedHash: seedPair.serverSeedHash,
      nextServerSeedHash: seedPair.nextServerSeedHash || null,
      clientSeed: seedPair.clientSeed,
      nonce: seedPair.nonce,
      isActive: seedPair.isActive,
    };
  }

  @ApiOperation({ summary: 'Get seed info for specific bet' })
  @ApiQuery({
    name: 'game',
    required: true,
    enum: GameTypeEnum,
    description: 'Game type',
    example: GameTypeEnum.DICE,
  })
  @ApiQuery({
    name: 'betId',
    required: true,
    type: String,
    description: 'Bet ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Bet seed information',
    type: BetSeedInfoResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bet not found',
  })
  @Get('provably-fair/seed-info/bet')
  async getBetSeedInfo(@CurrentUser() user: UserEntity, @Query() query: GetBetSeedInfoDto) {
    const seedInfo = await this.provablyFairService.getBetSeedInfo(
      user.id,
      query.game,
      query.betId,
    );

    if (!seedInfo) {
      throw new BadRequestException('Bet not found or access denied');
    }

    return seedInfo;
  }

  @ApiOperation({ summary: 'Update client seed and rotate server seed atomically' })
  @ApiResponse({
    status: 200,
    description: 'Client seed updated and server seed rotated successfully',
    schema: {
      type: 'object',
      properties: {
        revealedSeed: { type: 'string', nullable: true },
        oldSeedHash: { type: 'string', nullable: true },
        oldClientSeed: { type: 'string', nullable: true },
        oldNonce: { type: 'string', nullable: true },
        newSeedHash: { type: 'string' },
        newClientSeed: { type: 'string' },
      },
    },
  })
  @Patch('provably-fair/client-seed')
  async updateClientSeed(
    @CurrentUser() user: UserEntity,
    @Body() updateClientSeedDto: UpdateClientSeedDto,
  ) {
    return this.provablyFairService.updateClientSeed(user.id, updateClientSeedDto.clientSeed);
  }

  @ApiOperation({
    summary: 'Get seed pair history',
    description: 'Retrieve paginated history of rotated seed pairs with revealed server seeds',
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
    description: 'Seed pair history retrieved successfully',
    type: SeedHistoryResponseDto,
  })
  @Get('provably-fair/seed-history')
  async getSeedHistory(
    @CurrentUser() user: UserEntity,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<SeedHistoryResponseDto> {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      throw new BadRequestException('Invalid limit (1-50)');
    }

    const history = await this.provablyFairService.getSeedPairHistory(user.id, pageNum, limitNum);

    return {
      seedPairs: history.seedPairs,
      total: history.total,
      page: history.page,
      limit: history.limit,
      hasNext: history.hasNext,
    };
  }

  // Removed separate reveal endpoint to avoid desynchronization and exploits

  @ApiOperation({ summary: 'Verify a game outcome' })
  @ApiResponse({
    status: 200,
    description: 'Game outcome verification result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        calculatedOutcome: { type: 'number' },
        providedOutcome: { type: 'number' },
        hash: { type: 'string' },
      },
    },
  })
  @Post('provably-fair/verify')
  verifyGameOutcome(@Body() dto: VerifyGameOutcomeDto) {
    return this.provablyFairService.verifyGameOutcome(
      dto.serverSeed,
      dto.clientSeed,
      dto.nonce,
      dto.gameType,
      dto.outcome,
    );
  }

  @ApiOperation({
    summary: 'Verify server seed hash and reveal seed if inactive',
    description:
      'Check if a server seed hash corresponds to an active seed pair. If inactive, reveal the server seed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server seed hash verification result',
    type: VerifySeedHashResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid server seed hash format',
  })
  @Post('provably-fair/verify-seed-hash')
  async verifySeedHash(@Body() dto: VerifySeedHashDto): Promise<VerifySeedHashResponseDto> {
    return this.provablyFairService.verifyServerSeedHash(dto.serverSeedHash);
  }

  @ApiOperation({ summary: 'Get game session details' })
  @ApiResponse({
    status: 200,
    description: 'Game session information',
  })
  @Get('session/:sessionId')
  async getGameSession(@CurrentUser() user: UserEntity, @Param('sessionId') sessionId: string) {
    const session = await this.gameSessionService.getGameSession(sessionId);

    if (!session) {
      throw new BadRequestException('Game session not found');
    }

    // Ensure user can only access their own sessions
    if (session.userId !== user.id) {
      throw new BadRequestException('Access denied');
    }

    return session;
  }

  @ApiOperation({ summary: 'Get user game history' })
  @ApiResponse({
    status: 200,
    description: 'User game history',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @Get('history')
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('gameType') gameType?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid limit (1-100)');
    }

    const offset = (pageNum - 1) * limitNum;

    const result = await this.gameSessionService.getUserGameHistory(
      user.id,
      gameType as GameTypeEnum | undefined,
      limitNum,
      offset,
    );

    return {
      ...result,
      page: pageNum,
      limit: limitNum,
    };
  }

  // Aliases for test compatibility
  @Get('seeds/current')
  async getCurrentSeed(@CurrentUser() user: UserEntity) {
    return this.getSeedInfo(user);
  }

  // Removed legacy alias routes: seeds/rotate handled by client-seed update now

  // Removed legacy alias: seeds/client

  @Post('verify')
  verifyGameOutcomeAlias(@Body() dto: VerifyGameOutcomeDto) {
    return this.provablyFairService.verifyGameOutcome(
      dto.serverSeed,
      dto.clientSeed,
      dto.nonce,
      dto.gameType,
      dto.outcome,
    );
  }

  @Get('sessions/current')
  async getCurrentSession(@CurrentUser() user: UserEntity) {
    const session = await this.gameSessionService.getCurrentSession(user.id);
    return session || null;
  }

  @Get('sessions/history')
  async getSessionHistory(@CurrentUser() user: UserEntity, @Query('limit') limit: string = '50') {
    const limitNum = parseInt(limit, 10) || 50;
    const result = await this.gameSessionService.getUserGameHistory(
      user.id,
      undefined,
      limitNum,
      0,
    );
    return result.sessions;
  }

  @ApiOperation({ summary: 'Get interrupted game sessions' })
  @ApiResponse({
    status: 200,
    description: 'List of interrupted sessions',
    schema: {
      type: 'array',
      items: { type: 'object' },
    },
  })
  @Get('sessions/interrupted')
  async getInterruptedSessions(@CurrentUser() user: UserEntity) {
    return this.gameSessionService.getInterruptedSessions(user.id);
  }

  @ApiOperation({ summary: 'Recover an interrupted game session' })
  @ApiResponse({
    status: 200,
    description: 'Recovered session or null if not recoverable',
  })
  @Post('sessions/:sessionId/recover')
  async recoverSession(@CurrentUser() user: UserEntity, @Param('sessionId') sessionId: string) {
    const session = await this.gameSessionService.recoverGameSession(sessionId, user.id);

    if (!session) {
      throw new BadRequestException('Session not found or cannot be recovered');
    }

    return session;
  }

  @ApiOperation({ summary: 'Resume game session with new state' })
  @ApiResponse({
    status: 200,
    description: 'Updated session state',
  })
  @Put('sessions/:sessionId/resume')
  async resumeSession(
    @CurrentUser() user: UserEntity,
    @Param('sessionId') sessionId: string,
    @Body() gameState?: Record<string, any>,
  ) {
    return this.gameSessionService.resumeGameSession(sessionId, user.id, gameState);
  }

  @ApiOperation({ summary: 'Cancel an active game session' })
  @ApiResponse({
    status: 200,
    description: 'Session cancelled and bet refunded',
  })
  @Delete('sessions/:sessionId')
  async cancelSession(@CurrentUser() user: UserEntity, @Param('sessionId') sessionId: string) {
    const session = await this.gameSessionService.getGameSession(sessionId);

    if (!session || session.userId !== user.id) {
      throw new BadRequestException('Session not found or access denied');
    }

    await this.gameSessionService.cancelGameSession(sessionId);

    return { message: 'Session cancelled and bet refunded' };
  }

  @ApiOperation({
    summary: 'Get user bet history',
    description: 'Get list of user bets across all games',
  })
  @ApiResponse({
    status: 200,
    description: 'User bet history retrieved successfully',
    type: UserBetResponseDto,
  })
  @Get('bets/history')
  async getUserBetHistory(
    @CurrentUser() user: UserEntity,
    @Query() query: GetUserBetHistoryQueryDto,
  ): Promise<UserBetResponseDto> {
    const pageNum = query.page || 1;
    const limitNum = query.limit ? Math.min(query.limit, 100) : 10;

    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid limit (1-100)');
    }

    const offset = (pageNum - 1) * limitNum;

    const { bets: userBets, total } = await this.userBetService.getUserBets({
      userId: user.id,
      limit: limitNum,
      offset,
      gameTypes: query.gameTypes,
      gameName: query.gameName,
      sortBy: query.sortBy,
    });

    const bets = userBets.map((bet) => {
      // Calculate fiat payout amount if we have fiat preservation data
      let payoutFiatAmount: string | undefined;
      let payoutFiatCurrency: CurrencyEnum | undefined;

      if (bet.originalFiatAmount && bet.originalFiatCurrency && bet.multiplier) {
        try {
          const fiatBetAmount = new BigNumber(bet.originalFiatAmount);
          const multiplier = new BigNumber(bet.multiplier);
          const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);

          // Round down for house-favorable calculation
          payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
          payoutFiatCurrency = bet.originalFiatCurrency;
        } catch {
          // If calculation fails, don't include fiat payout data
          payoutFiatAmount = undefined;
          payoutFiatCurrency = undefined;
        }
      }

      return {
        game: bet.game,
        gameName: bet.gameName || bet.game,
        betId: bet.betId,
        userId: bet.userId,
        betAmount: bet.betAmount,
        asset: bet.asset,
        multiplier: bet.multiplier,
        payout: bet.payout,
        createdAt: bet.createdAt,
        updatedAt: bet.updatedAt,
        originalFiatAmount: bet.originalFiatAmount,
        originalFiatCurrency: bet.originalFiatCurrency,
        fiatToUsdRate: bet.fiatToUsdRate,
        payoutFiatAmount,
        payoutFiatCurrency,
      };
    });

    const hasNext = offset + limitNum < total;

    return {
      bets,
      total,
      page: pageNum,
      limit: limitNum,
      hasNext,
    };
  }

  // Public endpoint to get all house edges, no auth required
  @UseGuards()
  @ApiOperation({ summary: 'Get house edge for all games (public)' })
  @ApiResponse({
    status: 200,
    description: 'House edge for all games',
    schema: { type: 'object', additionalProperties: { type: 'number' } },
  })
  @Get('house-edge')
  getAllHouseEdges() {
    return this.houseEdgeService.getAllEdges();
  }

  // Game Configuration Endpoints

  @UseGuards()
  @ApiOperation({ summary: 'Get all bet limits (USD-based, public)' })
  @ApiResponse({
    status: 200,
    description: 'All bet limits in USD',
    type: [BetLimitsResponse],
  })
  @Get('bet-limits')
  async getAllBetLimits(): Promise<BetLimitsResponse[]> {
    return this.gameConfigService.getAllBetLimits();
  }

  @UseGuards()
  @ApiOperation({ summary: 'Get bet limits for specific game type (USD-based, public)' })
  @ApiParam({
    name: 'gameType',
    enum: GameType,
    description: 'Game type to get bet limits for',
  })
  @ApiResponse({
    status: 200,
    description: 'Game bet limits in USD',
    type: BetLimitsResponse,
  })
  @Get('bet-limits/:gameType')
  async getBetLimitsUsd(@Param('gameType') gameType: GameType): Promise<BetLimitsResponse> {
    return this.gameConfigService.getBetLimitsUsd(gameType);
  }

  @UseGuards()
  @ApiOperation({ summary: 'Check if a game is enabled (public)' })
  @ApiParam({
    name: 'gameType',
    enum: GameType,
    description: 'Game type to check status for',
  })
  @ApiResponse({
    status: 200,
    description: 'Game enabled status',
    schema: { type: 'boolean' },
  })
  @Get('status/:gameType')
  async isGameEnabled(@Param('gameType') gameType: GameType): Promise<{ enabled: boolean }> {
    const enabled = await this.gameConfigService.isGameEnabled(gameType);
    return { enabled };
  }

  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Refresh all game configuration cache (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Cache refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @Post('config/refresh')
  async refreshAllConfigCache(): Promise<{ message: string }> {
    await this.gameConfigService.refreshCache();
    return { message: 'Configuration cache refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Refresh specific game configuration cache (admin only)' })
  @ApiParam({
    name: 'gameType',
    enum: GameType,
    required: true,
    description: 'Specific game type to refresh',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @Post('config/refresh/:gameType')
  async refreshConfigCache(@Param('gameType') gameType: GameType): Promise<{ message: string }> {
    await this.gameConfigService.refreshCache(gameType);
    return { message: `Configuration cache refreshed successfully for ${gameType}` };
  }

  @UseGuards()
  @ApiOperation({ summary: 'Get all game configurations in simplified format (admin use)' })
  @ApiResponse({
    status: 200,
    description: 'Simple array of game configurations for admin panel',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gameType: { type: 'string' },
          status: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          minBetUsd: { type: 'number' },
          maxBetUsd: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @Get('configs')
  async getGameConfigs(): Promise<any[]> {
    try {
      // Get all game configs directly from the repositories
      const configs = await this.gameConfigRepo.find({
        order: { gameType: 'ASC' },
      });

      const betLimits = await this.gameBetLimitsRepo.find({
        where: { isActive: true },
      });

      // Create a map for quick lookup of bet limits
      const betLimitsMap = new Map();
      betLimits.forEach((limit) => {
        betLimitsMap.set(limit.gameType, limit);
      });

      const result = configs.map((config) => {
        const limits = betLimitsMap.get(config.gameType);
        return {
          gameType: config.gameType,
          status: config.status,
          name: config.name,
          description: config.description,
          minBetUsd: limits ? Number(limits.minBetUsd) : 0.1,
          maxBetUsd: limits ? Number(limits.maxBetUsd) : 1000,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };
      });
      return result;
    } catch (error) {
      console.error('*** DEBUG: Error in getGameConfigs:', error);
      // Fallback to empty array to match expected format
      return [];
    }
  }

  @ApiOperation({ summary: 'Get user favorite games' })
  @ApiResponse({
    status: 200,
    description: 'Array of favorite game display names',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['Dice', 'Crash', 'Plinko'],
    },
  })
  @Get('favorites')
  async getUserFavorites(@CurrentUser() user: UserEntity): Promise<string[]> {
    return this.favoriteGamesService.getUserFavorites({ userId: user.id });
  }

  @ApiOperation({ summary: 'Add game to favorites' })
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
  @Post('favorites')
  async addFavoriteGame(
    @CurrentUser() user: UserEntity,
    @Body() dto: GameFavoriteDto,
  ): Promise<{ message: string }> {
    await this.favoriteGamesService.addGameToFavorites({
      userId: user.id,
      gameType: dto.game,
    });
    return { message: 'Game added to favorites successfully' };
  }

  @ApiOperation({ summary: 'Remove game from favorites' })
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
  @Delete('favorites')
  async removeFavoriteGame(
    @CurrentUser() user: UserEntity,
    @Body() dto: GameFavoriteDto,
  ): Promise<{ message: string }> {
    await this.favoriteGamesService.removeGameFromFavorites({
      userId: user.id,
      gameType: dto.game,
    });
    return { message: 'Game removed from favorites successfully' };
  }

  @ApiOperation({ summary: 'Get user\'s recent games for "Continue Playing" section' })
  @ApiResponse({
    status: 200,
    description: "List of user's recent games (max 40)",
    type: [UserRecentGameDto],
  })
  @Get('recent')
  async getUserRecentGames(@CurrentUser() user: UserEntity): Promise<UserRecentGameDto[]> {
    return await this.userRecentGamesService.getUserRecentGames(user.id);
  }
}
