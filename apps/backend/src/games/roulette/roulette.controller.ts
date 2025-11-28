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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetTypeEnum, UserEntity } from '@zetik/shared-entities';
import { CurrentUser, CurrentUserOptional } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { PlaceRouletteBetDto } from './dto/place-roulette-bet.dto';
import { RouletteGameResponseDto } from './dto/roulette-game-response.dto';
import { RouletteService } from './roulette.service';

@ApiTags('Roulette')
@ApiBearerAuth()
@Controller('games/roulette')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  // POST /games/roulette/bet — Place roulette bet
  @Post('bet')
  @ApiOperation({
    summary: 'Place roulette bet',
    description:
      'Place multiple types of bets on a roulette wheel (European style with numbers 0-36)',
  })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully with immediate results',
    type: RouletteGameResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bet configuration or insufficient balance',
  })
  async placeBet(
    @CurrentUser() user: UserEntity,
    @Body() dto: PlaceRouletteBetDto,
  ): Promise<RouletteGameResponseDto> {
    return this.rouletteService.placeBet(
      user as UserEntity & { primaryAsset?: AssetTypeEnum },
      dto,
    );
  }

  // GET /games/roulette/history — Get roulette game history
  @Get('history')
  @ApiOperation({
    summary: 'Get roulette game history',
    description: 'Retrieve paginated history of completed roulette games for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Game history retrieved successfully',
    type: [RouletteGameResponseDto],
  })
  async getHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ): Promise<RouletteGameResponseDto[]> {
    return this.rouletteService.getGameHistory(user.id, limit, offset);
  }

  // GET /games/roulette/:betId — Get specific roulette bet details
  @Get(':betId')
  @ApiOperation({
    summary: 'Get specific roulette bet details',
    description:
      'Retrieve details of a specific roulette bet by ID. Works for both authenticated and logged-out users.',
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
    type: RouletteGameResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bet not found',
  })
  async getBetById(
    @CurrentUserOptional() user: UserEntity | undefined,
    @Param('betId', ParseUUIDPipe) betId: string,
  ): Promise<RouletteGameResponseDto> {
    return this.rouletteService.getBetById(betId);
  }
}
