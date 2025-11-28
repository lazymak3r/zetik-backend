import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { BlackjackService } from './blackjack.service';
import { BlackjackActionDto } from './dto/blackjack-action.dto';
import { BlackjackBetDetailsResponseDto } from './dto/blackjack-bet-details-response.dto';
import { BlackjackGameResponseDto } from './dto/blackjack-game-response.dto';
import { StartBlackjackGameDto } from './dto/start-blackjack-game.dto';

@ApiTags('Blackjack')
@ApiBearerAuth()
@Controller('games/blackjack')
@UseGuards(JwtAuthGuard)
export class BlackjackController {
  constructor(private readonly blackjackService: BlackjackService) {}

  // POST /games/blackjack/start — Start a new blackjack game
  @Post('start')
  @ApiOperation({
    summary: 'Start a new blackjack game',
    description: `
    Start a new blackjack game with optional side bets. The game uses 6 standard decks (312 cards total) 
    and follows classic casino blackjack rules:
    - Dealer stands on soft 17
    - Blackjack pays 3:2 (2.5x)
    - Insurance pays 2:1
    - Perfect Pairs side bet available (up to 25:1)
    - 21+3 side bet available (up to 100:1)
    - Split functionality for matching cards
    `,
  })
  @ApiBody({
    type: StartBlackjackGameDto,
    description: 'Game configuration and bet amounts',
    examples: {
      basic: {
        summary: 'Basic game',
        description: 'Simple blackjack game with main bet only',
        value: {
          betAmount: '10.00',
          clientSeed: 'player_seed_123',
        },
      },
      withSideBets: {
        summary: 'Game with side bets',
        description: 'Blackjack game with Perfect Pairs and 21+3 side bets',
        value: {
          betAmount: '25.00',
          perfectPairsBet: '5.00',
          twentyOnePlusThreeBet: '10.00',
          clientSeed: 'custom_seed_456',
          gameSessionId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Game started successfully',
    type: BlackjackGameResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      betAmount: '25.00',
      asset: 'USDT',
      status: 'active',
      playerCards: [
        { suit: 'hearts', rank: 'K', value: 10 },
        { suit: 'spades', rank: '7', value: 7 },
      ],
      dealerCards: [{ suit: 'diamonds', rank: 'A', value: 11 }],
      splitCards: [],
      splitedCards: [],
      playerScore: 17,
      playerSoftScore: 17,
      splitScore: 0,
      splitSoftScore: 0,
      dealerScore: 0,
      dealerSoftScore: 0,
      availableActions: ['hit', 'stand', 'double'],
      isDoubleDown: false,
      isInsurance: false,
      isSplit: false,
      perfectPairsBet: '5.00',
      twentyOnePlusThreeBet: '10.00',
      createdAt: '2025-01-07T21:30:00.000Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - insufficient balance or invalid bet amount',
    example: {
      statusCode: 400,
      message: 'Insufficient balance',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async startGame(
    @CurrentUser() user: UserEntity,
    @Body() dto: StartBlackjackGameDto,
  ): Promise<BlackjackGameResponseDto> {
    return this.blackjackService.startGame(user, dto);
  }

  // POST /games/blackjack/action — Perform an action in an active blackjack game
  @Post('action')
  @ApiOperation({
    summary: 'Perform an action in an active blackjack game',
    description: `
    Perform game actions like hit, stand, double, split, or insurance in an active blackjack game.
    
    Available actions depend on game state:
    - **HIT**: Take another card (always available unless bust)
    - **STAND**: End turn with current cards
    - **DOUBLE**: Double bet and take exactly one more card (first 2 cards only)
    - **SPLIT**: Split matching cards into two hands (first 2 cards of same value only)
    - **INSURANCE**: Insure against dealer blackjack when dealer shows ace
    - **HIT_SPLIT/STAND_SPLIT/DOUBLE_SPLIT**: Actions for split hands
    `,
  })
  @ApiBody({
    type: BlackjackActionDto,
    description: 'Action to perform and game context',
    examples: {
      hit: {
        summary: 'Hit action',
        description: 'Take another card',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'hit',
        },
      },
      stand: {
        summary: 'Stand action',
        description: 'End turn with current cards',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'stand',
        },
      },
      double: {
        summary: 'Double down',
        description: 'Double bet and take one card',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'double',
        },
      },
      split: {
        summary: 'Split cards',
        description: 'Split matching cards into two hands',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'split',
        },
      },
      insurance: {
        summary: 'Insurance bet',
        description: 'Insure against dealer blackjack',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'insurance',
        },
      },
      noInsurance: {
        summary: 'No insurance',
        description: 'No insurance bet',
        value: {
          gameId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'no_insurance',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Action performed successfully',
    type: BlackjackGameResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      betAmount: '25.00',
      asset: 'USDT',
      status: 'completed',
      playerCards: [
        { suit: 'hearts', rank: 'K', value: 10 },
        { suit: 'spades', rank: '7', value: 7 },
        { suit: 'clubs', rank: '5', value: 5 },
      ],
      dealerCards: [
        { suit: 'diamonds', rank: 'A', value: 11 },
        { suit: 'hearts', rank: '8', value: 8 },
      ],
      splitCards: [],
      splitedCards: [],
      playerScore: 22,
      playerSoftScore: 22,
      splitScore: 0,
      splitSoftScore: 0,
      dealerScore: 19,
      dealerSoftScore: 19,
      isDoubleDown: false,
      isSplitDoubleDown: false,
      isInsurance: false,
      isSplit: false,
      playerHandStatus: 'bust',
      activeHand: 'main',
      winAmount: '0.00',
      payoutMultiplier: '0.00',
      splitWinAmount: '0.00',
      splitPayoutMultiplier: '0.00',
      serverSeedHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      clientSeed: 'player_seed_123',
      nonce: '3',
      createdAt: '2025-01-07T21:30:00.000Z',
      updatedAt: '2025-01-07T21:32:15.000Z',
      availableActions: [],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid action or game state',
    example: {
      statusCode: 400,
      message: 'Invalid action for current game state',
      error: 'Bad Request',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
    example: {
      statusCode: 404,
      message: 'Game not found',
      error: 'Not Found',
    },
  })
  async performAction(
    @CurrentUser() user: UserEntity,
    @Body() dto: BlackjackActionDto,
  ): Promise<BlackjackGameResponseDto> {
    return this.blackjackService.performAction(user, dto);
  }

  // GET /games/blackjack/current — Get current active blackjack game
  @Get('current')
  @ApiOperation({
    summary: 'Get current active blackjack game',
    description: `
    Retrieve the user's current active blackjack game if one exists.
    This is used to restore game state after page refresh or navigation.
    Returns null if no active game is found.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Current game retrieved successfully (or null if no active game)',
    type: BlackjackGameResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      betAmount: '25.00',
      asset: 'USDT',
      status: 'active',
      playerCards: [
        { suit: 'hearts', rank: 'K', value: 10 },
        { suit: 'spades', rank: '7', value: 7 },
      ],
      dealerCards: [{ suit: 'diamonds', rank: 'A', value: 11 }],
      availableActions: ['hit', 'stand', 'double'],
      createdAt: '2025-01-07T21:30:00.000Z',
    },
  })
  @ApiResponse({
    status: 204,
    description: 'No active game found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async getCurrentGame(@CurrentUser() user: UserEntity): Promise<BlackjackGameResponseDto | null> {
    return this.blackjackService.getCurrentGame(user.id);
  }

  // GET /games/blackjack/history — Get user's blackjack game history
  @Get('history')
  @ApiOperation({
    summary: "Get user's blackjack game history",
    description: `
    Retrieve the user's recent blackjack games with complete game details including:
    - Final scores and cards
    - Win amounts and payout multipliers
    - Side bet results
    - Split game outcomes
    - Provably fair seeds (server seed revealed after completion)
    `,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of games to return (default: 50, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Game history retrieved successfully',
    type: [BlackjackGameResponseDto],
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        betAmount: '25.00',
        asset: 'USDT',
        status: 'completed',
        playerCards: [
          { suit: 'hearts', rank: 'A', value: 11 },
          { suit: 'spades', rank: 'K', value: 10 },
        ],
        dealerCards: [
          { suit: 'diamonds', rank: '10', value: 10 },
          { suit: 'clubs', rank: '9', value: 9 },
        ],
        playerScore: 21,
        dealerScore: 19,
        winAmount: '62.50',
        payoutMultiplier: '2.50',
        perfectPairsWin: '0.00',
        twentyOnePlusThreeWin: '0.00',
        serverSeed: 'abc123...def789',
        createdAt: '2025-01-07T21:30:00.000Z',
        availableActions: [],
      },
    ],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit') limit?: number,
  ): Promise<BlackjackGameResponseDto[]> {
    return this.blackjackService.getGameHistory(user.id, limit || 50);
  }

  // GET /games/blackjack/bet/:betId — Get specific blackjack bet details
  @Get('bet/:betId')
  @ApiOperation({
    summary: 'Get details of a specific blackjack bet by its ID',
    description:
      'Retrieve detailed information about a blackjack bet, including its game session and status. Works for both authenticated and logged-out users.',
  })
  @Public()
  @ApiParam({
    name: 'betId',
    type: String,
    description: 'The ID of the blackjack bet to retrieve.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Bet details retrieved successfully',
    type: BlackjackBetDetailsResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      gameSessionId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user_123',
      betAmount: '10.00',
      asset: 'USDT',
      status: 'completed',
      playerCards: [
        { suit: 'hearts', rank: 'A', value: 11 },
        { suit: 'spades', rank: 'K', value: 10 },
      ],
      dealerCards: [
        { suit: 'diamonds', rank: '10', value: 10 },
        { suit: 'clubs', rank: '9', value: 9 },
      ],
      playerScore: 21,
      dealerScore: 19,
      winAmount: '62.50',
      payoutMultiplier: '2.50',
      perfectPairsWin: '0.00',
      twentyOnePlusThreeWin: '0.00',
      serverSeed: 'abc123...def789',
      clientSeed: 'player_seed_123',
      nonce: '3',
      createdAt: '2025-01-07T21:30:00.000Z',
      updatedAt: '2025-01-07T21:32:15.000Z',
      availableActions: [],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Bet not found',
    example: {
      statusCode: 404,
      message: 'Bet not found',
      error: 'Not Found',
    },
  })
  async getBetById(
    @CurrentUserOptional() user: UserEntity | undefined,
    @Param('betId', ParseUUIDPipe) betId: string,
  ): Promise<BlackjackBetDetailsResponseDto> {
    return this.blackjackService.getBetById(betId, user?.id);
  }
}
