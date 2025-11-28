import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnbanUserDto {
  @ApiProperty({
    description: 'Reason for unbanning the user',
    example: 'Appeal accepted',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
