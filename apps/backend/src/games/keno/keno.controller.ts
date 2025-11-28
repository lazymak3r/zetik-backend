import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
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
import { KenoConfigResponseDto } from './dto/keno-config-response.dto';
import { KenoGameResponseDto } from './dto/keno-game-response.dto';
import { PlaceKenoBetDto } from './dto/place-keno-bet.dto';
import { KenoService } from './keno.service';

@ApiTags('Keno Game')
@ApiBearerAuth()
@Controller('games/keno')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiExtraModels(KenoGameResponseDto, PlaceKenoBetDto, KenoConfigResponseDto)
export class KenoController {
  constructor(private readonly kenoService: KenoService) {}

  // POST /games/keno/bet — Place a Keno bet
  @Post('bet')
  @ApiOperation({
    summary: 'Place a Keno bet',
    description: `
      Place a bet on Keno game with selected numbers and risk level.
      
      **Game Rules:**
      - Select 1-10 numbers from range 1-40
      - 10 numbers will be drawn randomly
      - Winnings are calculated based on matches and risk level
      - Four risk levels available: CLASSIC, LOW, MEDIUM, HIGH
      
      **Risk Levels:**
      - **CLASSIC**: Balanced payouts with moderate risk
      - **LOW**: Conservative risk, frequent smaller payouts, some payouts for 0 matches
      - **MEDIUM**: Moderate risk with good jackpots potential
      - **HIGH**: High risk, extreme jackpots (up to 1000x), many combinations return 0
      
      **Provably Fair:**
      - Uses server seed, client seed, and nonce for transparent random generation
      - Server seed hash is provided before the game
      - Full server seed is revealed after game completion
    `,
  })
  @ApiBody({
    type: PlaceKenoBetDto,
    description: 'Keno bet details',
    examples: {
      'Classic 5 numbers': {
        summary: 'Classic risk with 5 selected numbers',
        value: {
          betAmount: '0.001',
          selectedNumbers: [5, 15, 25, 35, 40],
          riskLevel: 'CLASSIC',
          clientSeed: 'my-random-seed-123',
          gameSessionId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
      'High risk 3 numbers': {
        summary: 'High risk for jackpot hunting',
        value: {
          betAmount: '0.01',
          selectedNumbers: [7, 21, 37],
          riskLevel: 'HIGH',
        },
      },
      'Low risk 8 numbers': {
        summary: 'Conservative play with many numbers',
        value: {
          betAmount: '0.005',
          selectedNumbers: [1, 5, 10, 15, 20, 25, 30, 35],
          riskLevel: 'LOW',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Bet placed successfully',
    type: KenoGameResponseDto,
    examples: {
      'Winning game': {
        summary: 'Example of a winning Keno game',
        value: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          gameSessionId: '550e8400-e29b-41d4-a716-446655440000',
          betAmount: '0.001',
          asset: 'BTC',
          status: 'completed',
          riskLevel: 'CLASSIC',
          selectedNumbers: [5, 15, 25, 35, 40],
          drawnNumbers: [2, 5, 8, 12, 15, 18, 22, 25, 28, 31, 34, 35, 37, 39, 60, 1, 7, 11, 19, 26],
          matches: 4,
          winAmount: '0.0165',
          payoutMultiplier: '16.5000',
          serverSeedHash: 'a1b2c3d4e5f6...',
          clientSeed: 'my-random-seed-123',
          nonce: '1',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:01.000Z',
        },
      },
      'Losing game': {
        summary: 'Example of a losing Keno game',
        value: {
          id: '987f6543-e21a-12d3-a456-426614174111',
          betAmount: '0.001',
          asset: 'BTC',
          status: 'completed',
          riskLevel: 'HIGH',
          selectedNumbers: [1, 2, 3],
          drawnNumbers: [
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          ],
          matches: 0,
          winAmount: '0',
          payoutMultiplier: '0.0000',
          serverSeedHash: 'x9y8z7w6v5u4...',
          clientSeed: 'auto-generated-seed',
          nonce: '1',
          createdAt: '2024-01-15T10:25:00.000Z',
          updatedAt: '2024-01-15T10:25:01.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    examples: {
      'Invalid numbers': {
        summary: 'Invalid selected numbers',
        value: {
          statusCode: 400,
          message: ['selectedNumbers must contain between 1 and 10 unique numbers'],
          error: 'Bad Request',
        },
      },
      'Invalid risk level': {
        summary: 'Invalid risk level',
        value: {
          statusCode: 400,
          message: ['Invalid risk level'],
          error: 'Bad Request',
        },
      },
      'Insufficient balance': {
        summary: 'Not enough balance for bet',
        value: {
          statusCode: 400,
          message: 'Insufficient balance',
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async placeBet(
    @CurrentUser() user: UserEntity,
    @Body() dto: PlaceKenoBetDto,
  ): Promise<KenoGameResponseDto> {
    return this.kenoService.placeBet(user, dto);
  }

  // GET /games/keno/config — Get Keno game configuration
  @Get('config')
  @ApiOperation({
    summary: 'Get Keno game configuration',
    description: `
      Retrieve Keno game configuration including available risk levels and multiplier tables.
      
      **Returns:**
      - List of available risk levels
      - Complete multiplier tables for each risk level
      - Tables show payouts for each number of selected numbers (0-10) and matches
      
      **Multiplier Table Structure:**
      - Key: Number of selected numbers (1-10)
      - Value: Array of multipliers indexed by number of matches
      - Example: For 5 selected numbers, index 3 = multiplier for 3 matches
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Game configuration retrieved successfully',
    type: KenoConfigResponseDto,
    examples: {
      Configuration: {
        summary: 'Complete Keno configuration',
        value: {
          riskLevels: ['CLASSIC', 'LOW', 'MEDIUM', 'HIGH'],
          multiplierTables: {
            CLASSIC: {
              1: ['0.00', '3.96'],
              2: ['0.00', '1.90', '4.50'],
              3: ['0.00', '1.00', '3.10', '10.40'],
              5: ['0.00', '0.25', '1.40', '4.10', '16.50', '36.00'],
            },
            LOW: {
              1: ['0.70', '1.85'],
              2: ['0.00', '2.00', '3.80'],
              5: ['0.00', '0.00', '1.50', '4.20', '13.00', '300.0'],
            },
            MEDIUM: {
              1: ['0.40', '2.75'],
              5: ['0.00', '0.00', '1.40', '4.00', '14.00', '390.0'],
            },
            HIGH: {
              1: ['0.00', '3.96'],
              5: ['0.00', '0.00', '0.00', '4.50', '48.00', '450.0'],
            },
          },
        },
      },
    },
  })
  getConfiguration(): KenoConfigResponseDto {
    return this.kenoService.getConfig();
  }

  // GET /games/keno/history — Get user game history
  @Get('history')
  @ApiOperation({
    summary: 'Get user game history',
    description: `
      Retrieve the authenticated user's Keno game history.
      
      **Features:**
      - Returns games in descending order (newest first)
      - Includes all game details including provably fair data
      - Server seeds are revealed for completed games
      - Supports pagination via limit parameter
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
    type: [KenoGameResponseDto],
    examples: {
      History: {
        summary: 'User game history',
        value: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            betAmount: '0.001',
            asset: 'BTC',
            status: 'completed',
            riskLevel: 'CLASSIC',
            selectedNumbers: [5, 15, 25],
            drawnNumbers: [5, 8, 12, 15, 18, 22, 25, 28, 31, 34],
            matches: 3,
            winAmount: '0.0041',
            payoutMultiplier: '4.1000',
            serverSeedHash: 'a1b2c3d4e5f6...',
            clientSeed: 'user-seed',
            nonce: '1',
            serverSeed: 'revealed-server-seed-12345',
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:01.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getGameHistory(
    @CurrentUser() user: UserEntity,
    @Query('limit') limit?: number,
  ): Promise<KenoGameResponseDto[]> {
    return this.kenoService.getGameHistory(user.id, limit || 50);
  }

  // GET /games/keno/:gameId — Get specific Keno game details
  @Get(':gameId')
  @ApiOperation({
    summary: 'Get specific game details',
    description: `
      Retrieve details of a specific Keno game by its ID.
      
      **Features:**
      - Returns complete game information
      - Includes provably fair verification data
      - Server seed is revealed for completed games
      - Works for both authenticated and logged-out users
    `,
  })
  @Public()
  @ApiParam({
    name: 'gameId',
    type: String,
    description: 'UUID of the Keno game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Game details retrieved successfully',
    type: KenoGameResponseDto,
    examples: {
      'Game details': {
        summary: 'Complete game information',
        value: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          gameSessionId: '550e8400-e29b-41d4-a716-446655440000',
          betAmount: '0.001',
          asset: 'BTC',
          status: 'completed',
          riskLevel: 'MEDIUM',
          selectedNumbers: [1, 5, 10, 15, 20, 25, 30, 35],
          drawnNumbers: [2, 5, 8, 12, 15, 18, 22, 25, 28, 31, 34, 35, 37, 39, 60, 1, 7, 11, 19, 26],
          matches: 4,
          winAmount: '0.014',
          payoutMultiplier: '14.0000',
          serverSeedHash: 'a1b2c3d4e5f6789...',
          clientSeed: 'my-custom-seed',
          nonce: '1',
          serverSeed: 'revealed-server-seed-abcdef123456',
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:01.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found',
    examples: {
      'Not found': {
        summary: 'Game does not exist',
        value: {
          statusCode: 404,
          message: 'Game not found',
          error: 'Not Found',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getGameById(@Param('gameId') gameId: string): Promise<KenoGameResponseDto | null> {
    return this.kenoService.getGameById(gameId);
  }
}
