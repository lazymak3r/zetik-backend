import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelBonusesDto {
  @ApiProperty({
    description: 'Array of bonus IDs to cancel',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  bonusIds!: string[];

  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Cancelled by admin',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Admin ID performing the cancellation',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID('4')
  adminId!: string;
}

export class CancelBonusesResponseDto {
  @ApiProperty({
    description: 'Number of successfully cancelled bonuses',
    example: 2,
  })
  success!: number;

  @ApiProperty({
    description: 'Array of bonus IDs that failed to cancel',
    type: [String],
    example: [],
  })
  failed!: string[];

  @ApiProperty({
    description: 'Total number of bonuses processed',
    example: 2,
  })
  total!: number;
}
