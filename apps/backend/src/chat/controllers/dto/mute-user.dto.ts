import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MuteUserDto {
  @ApiProperty({
    description: 'Duration of mute in minutes',
    example: 60,
    minimum: 1,
    maximum: 10080,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes!: number;

  @ApiProperty({
    description: 'Reason for muting the user',
    example: 'Spam in chat',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
