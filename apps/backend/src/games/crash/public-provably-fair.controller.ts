import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrashService } from './crash.service';
import { VerifyCrashOutcomeDto } from './dto/verify-crash-outcome.dto';

@ApiTags('provably-fair')
@Controller('provably-fair')
export class PublicProvablyFairController {
  constructor(private readonly crashService: CrashService) {}

  @ApiOperation({
    summary: 'Verify crash game outcome (public endpoint)',
    description:
      'Verify a crash game outcome using server seed and game index. Uses Bitcoin block hash as client seed. This is a public endpoint that does not require authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification result with calculated crash point',
    schema: {
      type: 'object',
      properties: {
        isValid: {
          type: 'boolean',
          description:
            'Whether the provided crash point matches the calculated result (if provided)',
        },
        calculatedCrashPoint: {
          type: 'number',
          description: 'Crash point calculated from server seed and Bitcoin block hash',
        },
        providedCrashPoint: {
          type: 'number',
          description: 'Crash point provided for verification (optional)',
        },
        serverSeed: { type: 'string', description: 'Server seed used in calculation' },
        gameIndex: { type: 'number', description: 'Game index in the seed chain' },
        bitcoinBlockHash: { type: 'string', description: 'Bitcoin block hash used as client seed' },
        terminatingHash: { type: 'string', description: 'Public commitment hash for seed chain' },
        hash: { type: 'string', description: 'HMAC-SHA256 hash generated during calculation' },
      },
    },
  })
  @Post('crash/verify')
  verifyCrashGame(@Body() dto: VerifyCrashOutcomeDto) {
    return this.crashService.verifyCrashOutcome(dto.serverSeed, dto.gameIndex, dto.crashPoint);
  }

  @ApiOperation({
    summary: 'Get server seed and hash for finished crash game',
    description: 'Public endpoint to retrieve seed and hash by game ID for ended games only.',
  })
  @ApiParam({ name: 'gameId', type: 'string', description: 'Crash game UUID' })
  @ApiResponse({
    status: 200,
    description: 'Seed information',
    schema: {
      type: 'object',
      properties: {
        serverSeed: { type: 'string' },
        serverSeedHash: { type: 'string' },
        gameIndex: { type: 'number' },
      },
    },
  })
  @Get('crash/:gameId')
  async getCrashSeed(@Param('gameId') gameId: string) {
    return await this.crashService.getFinishedGameSeed(gameId);
  }
}
