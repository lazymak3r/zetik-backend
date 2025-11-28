import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AssetTypeEnum, BalanceOperationEnum, UserEntity } from '@zetik/shared-entities';
import { RequireTwoFactor } from '../auth/decorators/require-two-factor.decorator';
import { TwoFactorGuard } from '../auth/guards/two-factor.guard';
import { AllowSelfExcluded } from '../common/decorators/allow-self-excluded.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';
import { BalanceWalletDto } from './dto/balance-wallet.dto';
import { CreateTipInput, TipResultDto } from './dto/create-tip.input';
import { ExtendedBalanceHistoryResponseDto } from './dto/extended-balance-history.dto';
import { BalanceHistorySortEnum, GetBalanceHistoryDto } from './dto/get-balance-history.dto';
import { GetBalanceStatisticsDto } from './dto/get-balance-statistics.dto';
import { GetDailyStatisticsDto } from './dto/get-daily-statistics.dto';
import { SwitchPrimaryWalletInput } from './dto/switch-primary-wallet.input';
import { VaultDto, VaultTransferInput, VaultTransferResultDto } from './dto/vault.dto';

@ApiTags('balance')
@Controller('balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: false,
    forbidNonWhitelisted: false,
  }),
)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get balance history with extended user information' })
  @ApiQuery({
    name: 'operation',
    required: false,
    enum: BalanceOperationEnum,
    description: 'Operation type',
    example: 'BET',
  })
  @ApiQuery({
    name: 'asset',
    required: false,
    enum: AssetTypeEnum,
    description: 'Asset type',
    example: 'BTC',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: BalanceHistorySortEnum,
    description: 'Sort by',
    example: 'DATE',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit',
    example: 10,
  })
  @ApiOkResponse({
    description:
      'Balance history retrieved successfully with extended user information when metadata contains user IDs',
    type: ExtendedBalanceHistoryResponseDto,
  })
  async getBalanceHistory(
    @CurrentUser() user: UserEntity,
    @Query() query: GetBalanceHistoryDto,
  ): Promise<ExtendedBalanceHistoryResponseDto> {
    return this.balanceService.getBalanceHistory(user.id, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get balance statistics' })
  @ApiOkResponse({ description: 'Balance statistics retrieved successfully' })
  async getBalanceStatistics(
    @CurrentUser() user: UserEntity,
    @Query() query: GetBalanceStatisticsDto,
  ) {
    return this.balanceService.getBalanceStatistics(user.id, query);
  }

  @Get('statistics/daily')
  @ApiOperation({ summary: 'Get daily balance statistics' })
  @ApiOkResponse({ description: 'Daily statistics retrieved successfully' })
  async getDailyStatistics(@CurrentUser() user: UserEntity, @Query() query: GetDailyStatisticsDto) {
    return this.balanceService.getDailyStatistics(user.id, query);
  }

  @Patch('primary')
  @ApiOperation({ summary: 'Switch primary wallet' })
  @ApiBody({ type: SwitchPrimaryWalletInput })
  @ApiOkResponse({
    description: 'List of wallets after switching primary',
    type: [BalanceWalletDto],
  })
  async switchPrimaryWallet(
    @CurrentUser() user: UserEntity,
    @Body() input: SwitchPrimaryWalletInput,
  ): Promise<BalanceWalletDto[]> {
    return this.balanceService.switchPrimaryWallet(user.id, input.asset);
  }

  @Get('wallets')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get all user balance wallets' })
  @ApiOkResponse({ description: 'List of user wallets', type: [BalanceWalletDto] })
  async getWallets(@CurrentUser() user: UserEntity): Promise<BalanceWalletDto[]> {
    return this.balanceService.getWallets(user.id);
  }

  @Get('fiat')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get user fiat balance in USD' })
  @ApiOkResponse({
    description: 'Fiat balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'string', description: 'Balance in USD' },
        currency: { type: 'string', example: 'USD' },
      },
    },
  })
  async getFiatBalance(@CurrentUser() user: UserEntity) {
    const balanceInCents = await this.balanceService.getFiatBalance(user.id);

    const centsValue = parseFloat(balanceInCents);
    if (isNaN(centsValue) || !isFinite(centsValue)) {
      return {
        balance: '0.00',
        currency: 'USD',
      };
    }

    const balanceInDollars = (centsValue / 100).toFixed(2);
    return {
      balance: balanceInDollars,
      currency: 'USD',
    };
  }

  @Get('vaults')
  @AllowSelfExcluded()
  @ApiOperation({ summary: 'Get all user vaults with positive balance' })
  @ApiOkResponse({ description: 'List of user vaults', type: VaultDto, isArray: true })
  getVaults(@CurrentUser() user: UserEntity): Promise<VaultDto[]> {
    return this.balanceService.getVaults(user.id) as unknown as Promise<VaultDto[]>;
  }

  @Post('vault/deposit')
  @ApiOperation({ summary: 'Deposit to vault (from balance)' })
  @ApiBody({ type: VaultTransferInput })
  @ApiOkResponse({ description: 'Vault deposit successful', type: VaultTransferResultDto })
  async vaultDeposit(
    @CurrentUser() user: UserEntity,
    @Body() body: VaultTransferInput,
  ): Promise<VaultTransferResultDto> {
    return this.balanceService.vaultDeposit(user.id, body);
  }

  @Post('vault/withdraw')
  @UseGuards(TwoFactorGuard)
  @RequireTwoFactor()
  @ApiOperation({
    summary: 'Withdraw from vault to balance - REQUIRES 2FA',
    description:
      'Critical operation: 2FA must be enabled and code provided for every vault withdrawal',
  })
  @ApiBody({ type: VaultTransferInput })
  @ApiOkResponse({ description: 'Vault withdraw successful', type: VaultTransferResultDto })
  async vaultWithdraw(
    @CurrentUser() user: UserEntity,
    @Body() body: VaultTransferInput,
  ): Promise<VaultTransferResultDto> {
    return this.balanceService.vaultWithdraw(user.id, body);
  }

  @Post('tip')
  @UseGuards(TwoFactorGuard)
  @RequireTwoFactor()
  @ApiOperation({
    summary: 'Tip another user by username or email - REQUIRES 2FA',
    description:
      'Critical operation: 2FA must be enabled and code provided for every tip transaction',
  })
  @ApiBody({
    description:
      'Send a tip to a user by username or email. Amount must be a string with up to 8 decimals. Asset must be one of supported crypto assets.',
    type: CreateTipInput,
    examples: {
      byUsername: {
        summary: 'By username',
        value: {
          toUsername: 'john_doe',
          amount: '0.00000100',
          asset: 'BTC',
          publicTip: false,
          twoFactorCode: '123456',
          message: 'gg',
        },
      },
      byEmail: {
        summary: 'By email',
        value: {
          toUsername: 'test1@example.com',
          amount: '0.00000100',
          asset: 'BTC',
          publicTip: false,
          twoFactorCode: '123456',
          message: 'gg',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Returns operation ids and both balances after tip. Also emits WebSocket notifications with TIP_SEND and TIP_RECEIVE.',
    type: TipResultDto,
  })
  async tip(@CurrentUser() user: UserEntity, @Body() body: CreateTipInput): Promise<TipResultDto> {
    return await this.balanceService.tip(user.id, body);
  }
}
