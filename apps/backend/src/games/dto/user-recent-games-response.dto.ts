import { ApiProperty } from '@nestjs/swagger';
import { GameTypeEnum } from '@zetik/common';

export class UserRecentGameDto {
  @ApiProperty({
    type: 'string',
    description: 'Display name of the game',
  })
  gameName!: string;

  @ApiProperty({
    enum: GameTypeEnum,
    description: 'Type of game for frontend routing',
  })
  gameType!: GameTypeEnum;
}
