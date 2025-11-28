import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveWithdrawRequestDto {
  @ApiProperty({
    description: 'Admin comment for approval',
    example: 'Approved after manual verification',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
