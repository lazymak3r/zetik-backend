import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoggingInterceptor } from '../common/interceptors/log.interceptor';
import { BetbyService } from './betby.service';
import { BetDiscardRequestDto } from './dto/bet-discard.dto';
import { BetLostRequestDto } from './dto/bet-lost-request.dto';
import { BetLostSuccessResponseDto } from './dto/bet-lost-response.dto';
import { BetRefundRequestDto } from './dto/bet-refund-request.dto';
import { BetRefundSuccessResponseDto } from './dto/bet-refund-response.dto';
import { BetRollbackRequestDto } from './dto/bet-rollabck-request.dto';
import { BetRollbackSuccessResponseDto } from './dto/bet-rollback-response.dto';
import { BetSettlementRequestDto } from './dto/bet-settelment-request.dto';
import { BetWinRequestDto } from './dto/bet-win-request.dto';
import { BetWinSuccessResponseDto } from './dto/bet-win-response.dto';
import {
  BetbyTokenGenerateRequestDto,
  BetbyTokenGenerateResponseDto,
} from './dto/betby-token-generate.dto';
import { MakeBetRequestDto } from './dto/make-bet-request.dto';
import { MakeBetSuccessResponseDto } from './dto/make-bet-response.dto';
import { PlayerSegmentRequestDto } from './dto/player-segment-request.dto';
import { BetbyJwtInterceptor } from './interceptors/betby-jwt.interceptor';

@ApiTags('Sportsbook Betby')
@UseInterceptors(BetbyJwtInterceptor)
@UseInterceptors(LoggingInterceptor)
@Controller('sportsbook/betby')
export class BetbyController {
  constructor(private readonly betbyService: BetbyService) {}

  @Get('ping')
  @ApiOperation({ summary: 'Ping endpoint for Betby availability check' })
  @ApiResponse({
    status: 200,
    description: 'Current timestamp',
    schema: { example: { timestamp: 1539005526 } },
  })
  ping() {
    return { timestamp: Math.floor(Date.now() / 1000) };
  }

  @Post('bet/make')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Make' })
  @ApiResponse({
    status: 200,
    description: 'Bet made successfully',
    type: MakeBetSuccessResponseDto,
  })
  makeBet(@Body() body: MakeBetRequestDto): Promise<MakeBetSuccessResponseDto> {
    return this.betbyService.makeBet(body);
  }

  @Post('bet/commit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Commit (optional)' })
  commitBet(@Body() body: { transaction_id: string }) {
    return this.betbyService.commitBet(body);
  }

  @Post('bet/settlement')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Settlement' })
  settlement(@Body() body: BetSettlementRequestDto) {
    return this.betbyService.settlement(body);
  }

  @Post('bet/refund')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Refund' })
  @ApiResponse({
    status: 200,
    description: 'Transaction accepted',
    type: BetRefundSuccessResponseDto,
  })
  refund(@Body() body: BetRefundRequestDto) {
    return this.betbyService.refund(body);
  }

  @Post('bet/win')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Win' })
  @ApiResponse({
    status: 200,
    description: 'Transaction accepted',
    type: BetWinSuccessResponseDto,
  })
  async win(@Body() body: BetWinRequestDto): Promise<BetWinSuccessResponseDto> {
    return await this.betbyService.win(body);
  }

  @Post('bet/lost')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Lost' })
  @ApiResponse({
    status: 200,
    description: 'Transaction accepted',
    type: BetLostSuccessResponseDto,
  })
  lost(@Body() body: BetLostRequestDto) {
    return this.betbyService.lost(body);
  }

  @Post('bet/discard')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Discard' })
  discard(@Body() body: BetDiscardRequestDto) {
    return this.betbyService.discard(body);
  }

  @Post('bet/rollback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bet Rollback' })
  @ApiResponse({
    status: 200,
    description: 'Transaction accepted',
    type: BetRollbackSuccessResponseDto,
  })
  async rollback(@Body() body: BetRollbackRequestDto) {
    return await this.betbyService.rollback(body);
  }

  @Put('player/segment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Player Segment change (optional)' })
  playerSegment(@Body() body: PlayerSegmentRequestDto) {
    return this.betbyService.playerSegment(body);
  }

  @Post('token/generate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate JWT token for current user',
    description:
      'Generates a new JWT token for the currently authenticated user for Betby integration',
  })
  @ApiResponse({
    status: 200,
    description: 'Token generated successfully',
    type: BetbyTokenGenerateResponseDto,
  })
  generateToken(
    @CurrentUser() user: UserEntity,
    @Body() body: BetbyTokenGenerateRequestDto,
  ): Promise<BetbyTokenGenerateResponseDto> {
    return this.betbyService.generateTokenForCurrentUser(user, body);
  }
}
