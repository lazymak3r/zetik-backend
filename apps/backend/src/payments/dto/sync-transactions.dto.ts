import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class SyncTransactionsDto {
  @IsNumber()
  @ApiProperty({
    description: 'Number of transactions fetched and upserted',
  })
  synced!: number;

  @IsNumber()
  @ApiProperty({
    description: 'Number of transactions credited to user wallets',
  })
  creditedCount!: number;

  @IsString()
  @ApiProperty({
    description: 'Total amount credited (as string)',
  })
  creditedTotal!: string;
}
