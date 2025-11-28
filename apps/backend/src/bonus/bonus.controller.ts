import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BonusTransactionStatusEnum, BonusTypeEnum } from '@zetik/shared-entities';

import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { BetConfirmedEventPayloadDto } from './dto/bet-confirmed-event-payload.dto';
import { BonusTransactionDto } from './dto/bonus-transaction.dto';
import { BonusVipTierDto } from './dto/bonus-vip-tier.dto';
import { GetBonusTransactionsResponseDto } from './dto/get-bonus-transactions-response.dto';
import { UserVipStatusDto } from './dto/user-vip-status.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../common/guards/self-exclusion.guard';
import { BonusTransactionService } from './services/bonus-transaction.service';
import { UserVipStatusService } from './services/user-vip-status.service';
import { VipTierService } from './services/vip-tier.service';

@ApiTags('bonus')
@ApiExtraModels(GetBonusTransactionsResponseDto, BonusTransactionDto)
@Controller('bonus')
export class BonusController {
  constructor(
    private readonly vipTierService: VipTierService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly eventEmitter: EventEmitter2,
    private readonly bonusTxService: BonusTransactionService,
  ) {}

  @Get('vip-tiers')
  @ApiOperation({ summary: 'Get all VIP tiers' })
  @ApiResponse({ status: 200, description: 'List of VIP tiers', type: [BonusVipTierDto] })
  async getAllVipTiers(): Promise<BonusVipTierDto[]> {
    const tiers = await this.vipTierService.findAllTiers();
    return tiers.map((t) => {
      const dto = Object.assign(new BonusVipTierDto(), t);
      // Convert amounts from cents to dollars for user display
      dto.wagerRequirement = (parseFloat(t.wagerRequirement) / 100).toFixed(2);
      if (t.levelUpBonusAmount) {
        dto.levelUpBonusAmount = (parseFloat(t.levelUpBonusAmount) / 100).toFixed(2);
      }
      if (t.rankUpBonusAmount) {
        dto.rankUpBonusAmount = (parseFloat(t.rankUpBonusAmount) / 100).toFixed(2);
      }
      // Daily bonus percentage removed
      if (t.weeklyBonusPercentage) {
        dto.weeklyBonusPercentage = t.weeklyBonusPercentage;
      }
      if (t.monthlyBonusPercentage) {
        dto.monthlyBonusPercentage = t.monthlyBonusPercentage;
      }
      return dto;
    });
  }

  @Post('test/bet-confirmed')
  @UsePipes(new ValidationPipe({ whitelist: false }))
  @ApiOperation({ summary: 'Test handleBetConfirmed event' })
  @ApiBody({ type: BetConfirmedEventPayloadDto })
  @ApiResponse({ status: 200, description: 'Event processed successfully' })
  async testBetConfirmed(
    @Body() payload: BetConfirmedEventPayloadDto,
  ): Promise<{ success: boolean }> {
    await this.eventEmitter.emitAsync('bet.confirmed', payload);
    return { success: true };
  }

  /**
   * Convert BonusTransactionEntity to BonusTransactionDto with amount in dollars
   */
  private convertBonusEntityToDto(entity: any): BonusTransactionDto {
    return {
      ...entity,
      amount: (parseFloat(entity.amount) / 100).toFixed(2), // Convert cents to dollars
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, SelfExclusionGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get paginated bonuses for current user with filtering by status',
    description: `Use query parameters:
- statuses: array of BonusTransactionStatusEnum values (e.g., ?statuses=PENDING&statuses=CLAIMED)
- bonusType: one value of BonusTypeEnum (e.g., ?bonusType=RAKEBACK)
- page, limit (default 1,10)`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'statuses',
    required: false,
    enum: BonusTransactionStatusEnum,
    isArray: true,
    type: 'string',
    description: 'Filter by bonus status (can be multiple)',
  })
  @ApiQuery({
    name: 'bonusType',
    required: false,
    enum: BonusTypeEnum,
    type: 'string',
    description: 'Filter by bonus type',
  })
  @ApiOkResponse({
    description: 'Paginated bonuses',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GetBonusTransactionsResponseDto) },
      },
    },
  })
  async getMyBonuses(
    @Req() req: Request & { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query(
      'statuses',
      new ParseArrayPipe({
        items: String,
        separator: ',',
        optional: true,
      }),
    )
    statuses?: BonusTransactionStatusEnum[],
    @Query('bonusType') bonusType?: string,
  ): Promise<GetBonusTransactionsResponseDto> {
    const userId = req.user.id;

    // Single optimized query with conversion logic in service
    const result = await this.bonusTxService.getTransactionsForUserWithFiltersOptimized(
      userId,
      page,
      limit,
      statuses,
      bonusType,
    );

    return { data: result.data, page, limit, total: result.total };
  }

  /**
   * @deprecated Use GET /v1/bonus instead with statuses=PENDING  filter
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, SelfExclusionGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get paginated pending bonuses for current user',
    deprecated: true,
    description: `Deprecated. Use GET /v1/bonus?statuses=PENDING to fetch pending bonuses.
For example:
- GET /v1/bonus?statuses=PENDING
- GET /v1/bonus?statuses=PENDING&bonusType=RAKEBACK`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'bonusType',
    required: false,
    enum: ['RAKEBACK', 'LEVEL_UP', 'WEEKLY_AWARD', 'MONTHLY_AWARD'],
    description: 'Filter by bonus type',
  })
  @ApiOkResponse({
    description: 'Paginated pending bonuses',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GetBonusTransactionsResponseDto) },
      },
    },
  })
  async getMyPendingBonuses(
    @Req() req: Request & { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('bonusType') bonusType?: string,
  ): Promise<GetBonusTransactionsResponseDto> {
    const userId = req.user.id;

    const [data, total] = await Promise.all([
      this.bonusTxService.getTransactionsForUser(userId, page, limit, bonusType),
      this.bonusTxService.countPendingForUser(userId, bonusType),
    ]);

    // Convert amounts from cents to dollars for frontend
    const convertedData = data.map((entity) => this.convertBonusEntityToDto(entity));
    return { data: convertedData, page, limit, total };
  }

  @Post('claim/:bonusId')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, SelfExclusionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim a pending bonus' })
  @ApiParam({ name: 'bonusId', type: String, description: 'ID of the bonus to claim' })
  @ApiResponse({
    status: 200,
    description: 'Claim result',
    type: BonusTransactionDto,
  })
  async claimBonus(
    @Req() req: Request & { user: { id: string } },
    @Param('bonusId', ParseUUIDPipe) bonusId: string,
  ): Promise<BonusTransactionDto> {
    const userId = req.user.id;
    const tx = await this.bonusTxService.claim(userId, bonusId);

    // Convert amount from cents to dollars for frontend
    return this.convertBonusEntityToDto(tx);
  }

  /**
   * Get VIP status for current user from token
   */
  @Get('vip-status')
  @UseGuards(JwtAuthGuard, SelfExclusionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get VIP status for current user' })
  @ApiOkResponse({
    description: 'User VIP status',
    type: UserVipStatusDto,
  })
  async getMyVipStatus(@Req() req: Request & { user: { id: string } }): Promise<UserVipStatusDto> {
    const userId = req.user.id;
    let status = await this.userVipStatusService.getUserVipStatus(userId);

    // Create initial VIP status if it doesn't exist
    if (!status) {
      status = await this.userVipStatusService.upsertUserVipStatus(userId, {
        currentWager: '0.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
      });
    }

    // Get all tiers to find current and next tier info
    const allTiers = await this.vipTierService.findAllTiers();
    const currentTier = allTiers.find((t) => t.level === status.currentVipLevel);
    const nextTier = allTiers.find((t) => t.level === status.currentVipLevel + 1);

    const dto = Object.assign(new UserVipStatusDto(), status);

    // Convert currentWager from cents to dollars for API response
    dto.currentWager = (parseFloat(status.currentWager) / 100).toFixed(2);

    // Add extended fields for simulator compatibility
    (dto as any).currentLevel = status.currentVipLevel;
    (dto as any).tierName = currentTier?.name || 'Unknown';

    // Calculate progress percentage to next level
    if (nextTier && nextTier.level > status.currentVipLevel) {
      const currentTierRequirement = parseFloat(currentTier?.wagerRequirement || '0');
      const nextWagerRequired = parseFloat(nextTier.wagerRequirement);
      const currentWager = parseFloat(status.currentWager);

      // Ensure we don't divide by zero
      if (nextWagerRequired > currentTierRequirement) {
        // Calculate progress from current tier to next tier
        const progressPercent = Math.min(
          100,
          ((currentWager - currentTierRequirement) / (nextWagerRequired - currentTierRequirement)) *
            100,
        );

        dto.progressPercent = Math.round(Math.max(0, progressPercent) * 100) / 100; // Round to 2 decimal places, ensure non-negative
      } else {
        // Edge case: invalid tier requirements
        dto.progressPercent = 100;
      }

      (dto as any).nextTier = {
        level: nextTier.level,
        name: nextTier.name,
        wagerRequirement: (parseFloat(nextTier.wagerRequirement) / 100).toFixed(2),
      };
    } else {
      // Max level reached or no valid next tier, 100% progress
      dto.progressPercent = 100;
    }

    return dto;
  }
}
