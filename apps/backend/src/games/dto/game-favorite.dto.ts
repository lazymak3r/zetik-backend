import { ApiProperty } from '@nestjs/swagger';
import { GameTypeEnum } from '@zetik/shared-entities';
import { IsEnum } from 'class-validator';

export class GameFavoriteDto {
  @ApiProperty({
    enum: GameTypeEnum,
    description: 'Game type for favorites operation',
    example: GameTypeEnum.DICE,
  })
  @IsEnum(GameTypeEnum)
  game!: GameTypeEnum;
}
