import { ApiProperty } from '@nestjs/swagger';
import { ISt8LaunchGameResponse } from '../interfaces/st8-types.interface';

export class LaunchGameResponseDto implements ISt8LaunchGameResponse {
  @ApiProperty({ description: 'URL to launch the game' })
  game_url!: string;

  @ApiProperty({ description: 'Authentication token for the game session' })
  token!: string;
}
