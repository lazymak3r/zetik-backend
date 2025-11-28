import { ApiProperty } from '@nestjs/swagger';

export class BetConfirmedEventPayloadDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'Bet amount in cents' })
  amount!: string;

  @ApiProperty()
  gameId!: string;

  @ApiProperty({ required: false })
  sessionId?: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}
