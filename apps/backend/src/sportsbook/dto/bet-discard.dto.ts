import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BetDiscardRequestDto {
  @ApiProperty({
    description: 'Unique identifier assigned to a player on Partner side',
  })
  @IsString()
  ext_player_id!: string;

  @ApiProperty({
    description: 'Transaction ID assigned by Betby when bet_make request is processed',
  })
  @IsString()
  transaction_id!: string;

  @ApiProperty({
    description: 'Descriptions of why this method being called',
  })
  @IsString()
  reason!: string;
}
