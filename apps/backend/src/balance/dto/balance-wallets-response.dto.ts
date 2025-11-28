import { ApiProperty } from '@nestjs/swagger';
import { BalanceWalletDto } from './balance-wallet.dto';

export class BalanceWalletsResponseDto {
  @ApiProperty({ type: [BalanceWalletDto], description: 'List of user wallets' })
  items!: BalanceWalletDto[];
}
