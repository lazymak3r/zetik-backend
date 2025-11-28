import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Promotion',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Campaign description',
    example: 'Special promotion for summer 2023',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Optional unique referral code for the campaign',
    example: 'SUMMER2025',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;
}
