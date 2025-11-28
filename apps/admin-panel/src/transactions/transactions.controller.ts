import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransactionsResponseDto, WithdrawRequestDto } from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('asset') asset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TransactionsResponseDto> {
    return this.transactionsService.getTransactions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      type,
      status,
      userId,
      asset,
      startDate,
      endDate,
    );
  }

  @Get('withdrawals/pending')
  async getPendingWithdrawals(): Promise<WithdrawRequestDto[]> {
    return this.transactionsService.getPendingWithdrawals();
  }

  @Post('withdrawals/:id/process')
  processWithdrawal(
    @Param('id') withdrawalId: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; reason?: string },
  ) {
    // TODO: Implement withdrawal processing logic
    return { message: `Withdrawal ${withdrawalId} ${body.action}ED` };
  }
}
