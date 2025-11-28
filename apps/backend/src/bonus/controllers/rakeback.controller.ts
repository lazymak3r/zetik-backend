import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import {
  IClaimAllRakebackResponse,
  IRakebackAmountResponse,
  RakebackService,
} from '../services/rakeback.service';

export class GetRakebackResponseDto {
  crypto!: {
    [asset: string]: string;
  };
}

export class ClaimRakebackResponseDto implements IClaimAllRakebackResponse {
  success!: boolean;
  totalAssets!: number;
  claimedCount!: number;
  failedCount!: number;
  claimedAssets!: string[];
  failedAssets!: Array<{
    asset: string;
    error: string;
  }>;
}

@ApiTags('Bonus - Rakeback')
@Controller('rakeback')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiBearerAuth()
export class RakebackController {
  constructor(private readonly rakebackService: RakebackService) {}

  @Get('amount')
  @ApiOperation({ summary: 'Get available rakeback amount' })
  @ApiResponse({
    status: 200,
    type: GetRakebackResponseDto,
    example: {
      crypto: {
        BTC: '0.00000325',
        LTC: '0.00324001',
        XRP: '0.12540070',
      },
    },
  })
  async getRakebackAmount(@CurrentUser() user: UserEntity): Promise<IRakebackAmountResponse> {
    return this.rakebackService.getRakebackAmount(user.id);
  }

  @Post('claim')
  @ApiOperation({
    summary: 'Claim all available rakeback bonuses',
    description:
      'Claims rakeback for all assets with balance > 0. Returns detailed results including which assets succeeded or failed. Claims are processed sequentially - if one fails, previous claims have already succeeded (partial success allowed).',
  })
  @ApiResponse({
    status: 200,
    type: ClaimRakebackResponseDto,
    example: {
      success: true,
      totalAssets: 3,
      claimedCount: 2,
      failedCount: 1,
      claimedAssets: ['BTC', 'USDC'],
      failedAssets: [
        {
          asset: 'ETH',
          error: 'Calculated rakeback amount is zero',
        },
      ],
    },
  })
  async claimRakeback(@CurrentUser() user: UserEntity): Promise<ClaimRakebackResponseDto> {
    return await this.rakebackService.claimAllRakeback(user.id);
  }
}
