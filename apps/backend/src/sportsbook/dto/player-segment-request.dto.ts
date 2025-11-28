import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PlayerSegmentRequestDto {
  @ApiProperty({
    description: 'Partner Website unique identifier assigned by Betby',
  })
  @IsString()
  brand_id!: string;

  @ApiProperty({
    description: 'Partner Website name assigned by Betby',
  })
  @IsString()
  brand_name!: string;

  @ApiProperty({
    description: 'Unique identifier of a player assigned by Betby',
  })
  @IsString()
  player_id!: string;

  @ApiProperty({
    description: 'Name of player assigned by Partner',
  })
  @IsString()
  player_name!: string;

  @ApiProperty({
    description: 'Unique identifier assigned to a player on Partner side',
  })
  @IsString()
  external_player_id!: string;

  @ApiProperty({
    description: 'Name of segment (comment from Risk Manager)',
  })
  @IsString()
  segment_name!: string;

  @ApiProperty({
    description: 'Value of CCF (0.0001 - 50)',
  })
  @IsString()
  segment_ccf!: string;
}
