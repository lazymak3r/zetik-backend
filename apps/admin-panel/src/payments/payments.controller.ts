import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApproveWithdrawRequestDto } from './dto/approve-withdraw-request.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CurrencyRatesResponseDto } from './dto/currency-rates-response.dto';
import { GetWithdrawRequestsDto } from './dto/get-withdraw-requests.dto';
import { RejectWithdrawRequestDto } from './dto/reject-withdraw-request.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { UserStatisticsDto } from './dto/user-statistics.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('assets')
  @ApiOperation({ summary: 'Get all assets with status' })
  @ApiResponse({ status: 200, description: 'Returns list of all assets' })
  async getAssets() {
    return await this.paymentsService.getAllAssets();
  }

  @Get('currency-rates')
  @ApiOperation({ summary: 'Get current currency rates in USD' })
  @ApiResponse({
    status: 200,
    description: 'Returns current currency rates',
    type: CurrencyRatesResponseDto,
  })
  async getCurrencyRates() {
    return await this.paymentsService.getCurrencyRates();
  }

  @Get('user-statistics/:userId')
  @ApiOperation({ summary: 'Get user statistics for approval decision' })
  @ApiResponse({ status: 200, description: 'Returns user statistics', type: UserStatisticsDto })
  async getUserStatistics(@Param('userId') userId: string) {
    return await this.paymentsService.getUserStatistics(userId);
  }

  @Get('user-balance-statistics/:userId')
  async getUserBalanceStatistics(@Param('userId') userId: string) {
    return this.paymentsService.getUserBalanceStatistics(userId);
  }

  @Post('assets')
  @ApiOperation({ summary: 'Create new asset' })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  async createAsset(@Body() dto: CreateAssetDto) {
    return await this.paymentsService.createAsset(dto);
  }

  @Put('assets/:symbol')
  @ApiOperation({ summary: 'Update asset status' })
  @ApiResponse({ status: 200, description: 'Asset status updated' })
  async updateAssetStatus(@Param('symbol') symbol: string, @Body() dto: UpdateAssetStatusDto) {
    return await this.paymentsService.updateAssetStatus(symbol, dto);
  }

  @Get('withdraw-requests')
  @ApiOperation({ summary: 'Get withdrawal requests with filters' })
  @ApiResponse({ status: 200, description: 'Returns list of withdrawal requests' })
  async getWithdrawRequests(@Query() filters: GetWithdrawRequestsDto) {
    return await this.paymentsService.getWithdrawRequests(filters);
  }

  @Post('withdraw-requests/:id/approve')
  @ApiOperation({ summary: 'Approve withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal request approved' })
  async approveWithdrawRequest(
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawRequestDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    const adminId = req.user.id;
    return await this.paymentsService.approveWithdrawRequest(id, dto, adminId);
  }

  @Post('withdraw-requests/:id/reject')
  @ApiOperation({ summary: 'Reject withdrawal request' })
  @ApiResponse({ status: 200, description: 'Withdrawal request rejected' })
  async rejectWithdrawRequest(@Param('id') id: string, @Body() dto: RejectWithdrawRequestDto) {
    return await this.paymentsService.rejectWithdrawRequest(id, dto);
  }
}
