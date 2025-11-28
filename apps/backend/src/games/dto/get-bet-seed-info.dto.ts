import { ApiProperty } from '@nestjs/swagger';
import { GameTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export class GetBetSeedInfoDto {
  @ApiProperty({
    description: 'Game type',
    enum: GameTypeEnum,
    example: GameTypeEnum.DICE,
  })
  @IsEnum(GameTypeEnum, { message: 'Invalid game type' })
  @IsNotEmpty()
  game!: GameTypeEnum;

  @ApiProperty({
    description: 'Bet ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Invalid bet ID format' })
  @IsNotEmpty()
  betId!: string;
}
