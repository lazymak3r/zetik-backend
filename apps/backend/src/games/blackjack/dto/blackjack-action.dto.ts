import { ApiProperty } from '@nestjs/swagger';
import { BlackjackAction } from '@zetik/shared-entities';
import { IsEnum, IsUUID } from 'class-validator';

export class BlackjackActionDto {
  @ApiProperty({
    description: 'UUID of the active blackjack game',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
    format: 'uuid',
  })
  @IsUUID()
  gameId!: string;

  @ApiProperty({
    description: 'Action to perform in the blackjack game',
    enum: BlackjackAction,
    example: BlackjackAction.HIT,
    enumName: 'BlackjackAction',
  })
  @IsEnum(BlackjackAction)
  action!: BlackjackAction;
}
