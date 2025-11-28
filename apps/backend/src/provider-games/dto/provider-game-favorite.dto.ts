import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ProviderGameFavoriteDto {
  @ApiProperty({
    description: 'Provider game code (e.g., pgp_spaceman, rtg_primate_king)',
    example: 'pgp_spaceman',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gameCode!: string;
}
