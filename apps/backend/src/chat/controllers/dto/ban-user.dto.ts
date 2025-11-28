import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class BanUserDto {
  @ApiProperty({
    description: 'Duration of ban in minutes',
    example: 1440,
    minimum: 1,
    maximum: 525600,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(525600)
  durationMinutes!: number;

  @ApiProperty({
    description: 'Reason for banning the user',
    example: 'Violation of terms of service',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
