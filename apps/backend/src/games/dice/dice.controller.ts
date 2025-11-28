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

import { CurrentUser, CurrentUserOptional } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { DiceService } from './dice.service';
import { DiceBetResponseDto } from './dto/dice-bet-response.dto';
import { PlaceDiceBetDto } from './dto/place-dice-bet.dto';

@ApiTags('games/dice')
@Controller('games/dice')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiBearerAuth()
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  // POST /games/dice — Place a dice bet (alias for /bet endpoint)
  @Post()
  @ApiOperation({
    summary: 'Place a dice bet (alias)',
    description: 'Alias for /bet endpoint for backward compatibility',
  })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    type: DiceBetResponseDto,
  })
  async placeBetAlias(@CurrentUser() user: UserEntity, @Body() dto: PlaceDiceBetDto) {
    return this.diceService.placeBet(user, dto);
  }

  // POST /games/dice/bet — Place a dice bet
  @Post('bet')
  @ApiOperation({
    summary: 'Place a dice bet',
    description:
      'Place a dice bet with either target number or multiplier. Uses provably fair system.',
  })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    type: DiceBetResponseDto,
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
    @Body() placeBetDto: PlaceDiceBetDto,
  ): Promise<DiceBetResponseDto> {
    return this.diceService.placeBet(user, placeBetDto);
  }

  // GET /games/dice/history — Get dice bet history
  @Get('history')
  @ApiOperation({
    summary: 'Get dice bet history',
    description: 'Get the betting history for the current user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of bets to return (default: 50, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Bet history retrieved successfully',
    type: [DiceBetResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBetHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<DiceBetResponseDto[]> {
    const validLimit = Math.min(limit || 50, 100);
    return this.diceService.getBetHistory(user.id, validLimit);
  }

  // GET /games/dice/bet/:betId — Get specific dice bet details
  @Get('bet/:betId')
  @ApiOperation({
    summary: 'Get specific dice bet details',
    description:
      'Get details of a specific dice bet by ID. Works for both authenticated and logged-out users.',
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
    type: DiceBetResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bet not found',
  })
  async getBetById(
    @CurrentUserOptional() user: UserEntity | undefined,
    @Param('betId', ParseUUIDPipe) betId: string,
  ): Promise<DiceBetResponseDto | null> {
    return this.diceService.getBetById(betId, user?.id);
  }
}
