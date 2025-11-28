import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectWithdrawRequestDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Insufficient verification documents',
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
