import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AdminAccessGuard } from '../../bonus/guards/admin-access.guard';
import { AdminCreditInput, AdminCreditResponseDto } from '../dto/admin-balance-adjust.input';
import { AdminBalanceService } from '../services/admin-balance.service';

@ApiExcludeController()
@Controller('balance-admin')
@UseGuards(AdminAccessGuard)
export class BalanceAdminController {
  constructor(private readonly adminBalanceService: AdminBalanceService) {}

  @Post('credit')
  async credit(@Body() input: AdminCreditInput): Promise<AdminCreditResponseDto> {
    return this.adminBalanceService.creditByAdmin(input);
  }
}
