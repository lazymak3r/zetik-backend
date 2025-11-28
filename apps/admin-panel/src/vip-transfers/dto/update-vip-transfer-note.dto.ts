import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVipTransferNoteDto {
  @ApiProperty({
    description: 'Custom note from admin',
    example: 'Verified user, approved for VIP transfer',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customNote?: string;
}
