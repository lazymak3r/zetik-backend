import { BadRequestException, Injectable } from '@nestjs/common';
import { BalanceOperationEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { BalanceService } from '../balance.service';
import { AdminCreditInput, AdminCreditResponseDto } from '../dto/admin-balance-adjust.input';

@Injectable()
export class AdminBalanceService {
  constructor(private readonly balanceService: BalanceService) {}

  async creditByAdmin(input: AdminCreditInput): Promise<AdminCreditResponseDto> {
    const operationId = randomUUID();

    const result = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.OTHER,
      operationId,
      userId: input.userId,
      amount: new BigNumber(input.amount),
      asset: input.asset,
      metadata: {
        by: 'ADMIN_PANEL',
        reason: input.reason,
      },
      description: input.reason,
    });

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to credit balance');
    }

    return {
      operationId,
      userId: input.userId,
      asset: input.asset,
      amount: input.amount,
      balance: result.balance,
    };
  }
}
