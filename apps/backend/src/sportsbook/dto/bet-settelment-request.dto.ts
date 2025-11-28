import { ApiProperty } from '@nestjs/swagger';
import { SportsbookBetStatus } from '@zetik/shared-entities';
import { IsEnum, IsString } from 'class-validator';

export class BetSettlementRequestDto {
  @ApiProperty({
    description:
      'Settled status of betslip: won, lost, canceled, refund, cashed out, half-won, half-lost',
    enum: SportsbookBetStatus,
  })
  @IsEnum(SportsbookBetStatus)
  status!: SportsbookBetStatus;

  @ApiProperty({
    description: 'Transaction ID assigned by Partner when bet_make request is processed',
  })
  @IsString()
  bet_transaction_id!: string;
}
