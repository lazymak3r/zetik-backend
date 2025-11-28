import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { LimboGameResponseDto } from './dto/limbo-game-response.dto';
import { PlaceLimboBetDto } from './dto/place-limbo-bet.dto';
import { LimboService } from './limbo.service';

@Controller('games/limbo')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
export class LimboController {
  constructor(private readonly limboService: LimboService) {}

  // POST /games/limbo/bet — Place a limbo bet
  @Post('bet')
  async placeBet(
    @CurrentUser() user: UserEntity,
    @Body() dto: PlaceLimboBetDto,
  ): Promise<LimboGameResponseDto> {
    return this.limboService.placeBet(user, dto);
  }

  // GET /games/limbo/history — Get limbo game history
  @Get('history')
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit') limit?: number,
  ): Promise<LimboGameResponseDto[]> {
    return this.limboService.getGameHistory(user.id, limit || 50);
  }

  // GET /games/limbo/:gameId — Get specific limbo game details
  @Get(':gameId')
  @ApiOperation({
    summary: 'Get specific limbo game details',
    description:
      'Get details of a specific Limbo game by ID. Works for both authenticated and logged-out users.',
  })
  @Public()
  async getGameById(@Param('gameId') gameId: string): Promise<LimboGameResponseDto | null> {
    return this.limboService.getGameById(gameId);
  }
}
