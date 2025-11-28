import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
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
import {
  AssetTypeEnum,
  TransactionStatusEnum,
  TransactionTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { IsUUID } from 'class-validator';
import { RequireTwoFactor } from '../auth/decorators/require-two-factor.decorator';
import { TwoFactorGuard } from '../auth/guards/two-factor.guard';
import { BalanceService } from '../balance/balance.service';
import { AdminAccessGuard } from '../bonus/guards/admin-access.guard';
import { AllowSelfExcluded } from '../common/decorators/allow-self-excluded.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AssetFeesMapResponseDto } from './dto/asset-fees-response.dto';
import { AssetLimitDto, AssetLimitsResponseDto } from './dto/asset-limits-response.dto';
import { AvailableAssetsResponseDto } from './dto/available-assets-response.dto';
import { CreateWithdrawRequestDto } from './dto/create-withdraw-request.dto';
import { CurrencyRatesResponseDto } from './dto/currency-rates-response.dto';
import { EstimateWithdrawFeeResponseDto } from './dto/estimate-withdraw-fee-response.dto';
import { EstimateWithdrawFeeDto } from './dto/estimate-withdraw-fee.dto';
import { GetCurrencyRatesDto } from './dto/get-currency-rates.dto';
import { GetDepositAddressDto } from './dto/get-deposit-address.dto';
import { MultiCurrencyRatesResponseDto } from './dto/multi-currency-rates-response.dto';
import {
  GetUserTransactionsQueryDto,
  TransactionResponseDto,
  UserTransactionsResponseDto,
} from './dto/transaction-response.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';
import { PaymentsService } from './payments.service';

class TransactionIdParam {
  @IsUUID('4', { message: 'Transaction ID must be a valid UUID' })
  txId!: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly balanceService: BalanceService,
  ) {}

  @Get('limits')
  @ApiOperation({
    summary: 'Get payment operation limits for all supported assets',
    description:
      'Returns minimum/maximum deposit/withdrawal amounts and daily limits for each asset',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns payment operation limits for all supported assets',
    type: AssetLimitsResponseDto,
  })
  getAssetLimits(): AssetLimitsResponseDto {
    const limits = this.balanceService.getAssetLimits();
    return { limits };
  }

  @Get('limits/:asset')
  @ApiOperation({
    summary: 'Get payment operation limits for a specific asset',
    description:
      'Returns minimum/maximum deposit/withdrawal amounts and daily limits for the specified asset',
  })
  @ApiParam({
    name: 'asset',
    enum: AssetTypeEnum,
    description: 'Asset symbol',
    example: AssetTypeEnum.BTC,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns payment operation limits for the specified asset',
    type: AssetLimitDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Asset not found or not supported',
  })
  getAssetLimit(@Param('asset') asset: AssetTypeEnum): AssetLimitDto {
    const limit = this.balanceService.getAssetLimit(asset);

    if (!limit) {
      throw new NotFoundException(`Asset '${asset}' not found or not supported`);
    }

    return limit;
  }

  @Get('currency-rates')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get current currency rates in specified base currency (default: USD)' })
  @ApiResponse({
    status: 200,
    description: 'Returns current cryptocurrency rates',
    type: CurrencyRatesResponseDto,
  })
  async getCurrencyRates(@Query() query: GetCurrencyRatesDto): Promise<CurrencyRatesResponseDto> {
    return this.paymentsService.getCurrencyRates(query.baseCurrency);
  }

  @Get('currency-rates-multi')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get current cryptocurrency rates in multiple fiat currencies' })
  @ApiResponse({
    status: 200,
    description: 'Returns current cryptocurrency rates in USD, EUR, JPY, CAD, CNY',
    type: MultiCurrencyRatesResponseDto,
  })
  async getMultiCurrencyRates(): Promise<MultiCurrencyRatesResponseDto> {
    return this.paymentsService.getMultiCurrencyRates();
  }

  @Get('available-assets')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get list of available assets with network options' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of available assets',
    type: AvailableAssetsResponseDto,
  })
  async getAvailableAssets(): Promise<AvailableAssetsResponseDto> {
    return this.paymentsService.getAvailableAssets();
  }

  @Get('deposit-address')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get deposit address for asset' })
  @ApiResponse({
    status: 200,
    description: 'Returns deposit address and QR code',
  })
  async getDepositAddress(@CurrentUser() user: UserEntity, @Query() query: GetDepositAddressDto) {
    return this.paymentsService.getOrCreateDepositAddress(user.id, query.asset, query.network);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get transactions for current user',
    description: 'Returns paginated list of transactions for the authenticated user (all statuses)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TransactionTypeEnum,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'asset',
    required: false,
    enum: AssetTypeEnum,
    description: 'Filter by asset type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TransactionStatusEnum,
    description: 'Filter by transaction status',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['createdAt', 'amount'],
    description: 'Field to order by (default: createdAt)',
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Order direction (default: DESC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of transactions',
    type: UserTransactionsResponseDto,
  })
  async getUserTransactions(
    @CurrentUser() user: UserEntity,
    @Query() query: GetUserTransactionsQueryDto,
  ): Promise<UserTransactionsResponseDto> {
    // Validate limit to prevent excessive queries
    const validatedLimit = Math.min(query.limit || 20, 100);

    return this.paymentsService.getUserTransactions(user.id, {
      ...query,
      limit: validatedLimit,
    });
  }

  @Get('transactions/:txId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get Fireblocks transaction details',
    description: 'Retrieve detailed transaction information from Fireblocks by transaction ID',
  })
  @ApiParam({
    name: 'txId',
    description: "Fireblocks transaction ID (must match user's own transaction)",
    type: String,
    required: true,
    example: 'd525c170-e937-4a9d-8555-be4d474bf969',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transaction ID',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getFireblocksTransaction(
    @CurrentUser() user: UserEntity,
    @Param() params: TransactionIdParam,
  ): Promise<TransactionResponseDto> {
    return this.paymentsService.getFireblocksTransaction(params.txId, user.id);
  }

  @Get('wallets')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get user wallets' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of user wallets',
  })
  async getUserWallets(@CurrentUser() user: UserEntity) {
    return this.paymentsService.getWalletsByUserId(user.id);
  }

  @Get('withdraw/asset-fees')
  @ApiOperation({
    summary: 'Get estimated network fees for all supported assets',
    description:
      'Returns cached fee estimates for initial display. Uses dummy transactions for estimation.',
  })
  @ApiQuery({
    name: 'forceRefresh',
    required: false,
    type: Boolean,
    description: 'Force refresh cache and get fresh estimates from API',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns fee estimates for all supported assets',
    type: AssetFeesMapResponseDto,
  })
  async getAssetFees(
    @Query('forceRefresh') forceRefresh?: boolean,
  ): Promise<AssetFeesMapResponseDto> {
    return this.paymentsService.getAssetFees(forceRefresh);
  }

  @Get('withdraw/estimate-fee')
  @ApiOperation({
    summary: 'Estimate withdrawal network fee for specific transaction',
    description:
      'Get precise fee estimate for actual withdrawal with user-provided amount and address',
  })
  @ApiQuery({
    name: 'asset',
    enum: AssetTypeEnum,
    required: true,
    description: 'Asset to withdraw',
  })
  @ApiQuery({
    name: 'toAddress',
    type: String,
    required: true,
    description: 'Destination address for withdrawal',
  })
  @ApiQuery({
    name: 'amount',
    type: String,
    required: true,
    description: 'Amount to withdraw (as string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns estimated network fee for withdrawal',
    type: EstimateWithdrawFeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  async estimateWithdrawalFee(
    @Query() dto: EstimateWithdrawFeeDto,
  ): Promise<EstimateWithdrawFeeResponseDto> {
    // Class-validator will automatically validate the DTO
    // No need for additional validation if you use ValidationPipe globally
    return this.paymentsService.getWithdrawalFeeEstimate(dto);
  }

  @Post('withdraw-requests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @RequireTwoFactor()
  @AllowSelfExcluded()
  @ApiOperation({
    summary: 'Create withdrawal request - REQUIRES 2FA',
    description:
      'Critical operation: 2FA must be enabled and code provided for every withdrawal request',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created',
    type: WithdrawResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '2FA not enabled or invalid code',
  })
  async createWithdrawRequest(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateWithdrawRequestDto,
  ): Promise<WithdrawResponseDto> {
    return this.paymentsService.createWithdrawRequest(user, dto);
  }

  /**
   * ADMIN: Approve withdrawal request
   */
  @Post('admin/withdraw-requests/:id/approve')
  @UseGuards(AdminAccessGuard)
  @ApiOperation({ summary: 'ADMIN: Approve withdrawal request' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal request approved and sent to Fireblocks',
  })
  async approveWithdrawRequest(
    @Param('id') id: string,
    @Body() dto: { comment?: string },
    @Headers('x-simulator-secret') _secret: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ success: boolean; message: string; request: any }> {
    return this.paymentsService.approveWithdrawRequest(id, dto.comment);
  }

  /**
   * ADMIN: Reject withdrawal request
   */
  @Post('admin/withdraw-requests/:id/reject')
  @UseGuards(AdminAccessGuard)
  @ApiOperation({ summary: 'ADMIN: Reject withdrawal request' })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal request rejected',
  })
  async rejectWithdrawRequest(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Headers('x-simulator-secret') _secret: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ success: boolean; message: string; request: any }> {
    return this.paymentsService.rejectWithdrawRequest(id, dto.reason);
  }

  /**
   * ADMIN: Test currency rates update
   */
  @Post('admin/currency-rates/test-update')
  @UseGuards(AdminAccessGuard)
  @ApiOperation({ summary: 'ADMIN: Test currency rates update from external sources' })
  @ApiResponse({
    status: 200,
    description: 'Currency rates update test completed',
  })
  async testCurrencyRatesUpdate(
    @Headers('x-simulator-secret') _secret: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ success: boolean; message: string; rates: any }> {
    return this.paymentsService.testCurrencyRatesUpdate();
  }
}
