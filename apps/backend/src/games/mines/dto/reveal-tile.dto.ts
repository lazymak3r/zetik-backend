import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class RevealTileDto {
  @ApiProperty({
    description: 'Mines game ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  gameId!: string;

  @ApiProperty({
    description: 'Tile position to reveal (0-24 for 5x5 grid)',
    example: 12,
    minimum: 0,
    maximum: 24,
  })
  @IsInt({ message: 'Tile position must be an integer' })
  @Min(0, { message: 'Tile position must be at least 0' })
  @Max(24, { message: 'Tile position must be at most 24' })
  tilePosition!: number;
}
