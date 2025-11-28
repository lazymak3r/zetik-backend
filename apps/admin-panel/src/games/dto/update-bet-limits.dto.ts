import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min } from 'class-validator';

export class UpdateBetLimitsDto {
  @ApiProperty({
    description: 'Minimum bet amount in USD',
    example: 0.1,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  minBetUsd!: number;

  @ApiProperty({
    description: 'Maximum bet amount in USD',
    example: 1000,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  maxBetUsd!: number;

  @ApiProperty({
    description: 'Maximum payout amount in USD - auto cashout when exceeded',
    example: 100000,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  maxPayoutUsd!: number;
}

export class UpdateBetLimitsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Bet limits updated successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Updated game type',
    example: 'blackjack',
  })
  gameType!: string;

  @ApiProperty({
    description: 'New minimum bet in USD',
    example: 0.1,
  })
  minBetUsd!: number;

  @ApiProperty({
    description: 'New maximum bet in USD',
    example: 1000,
  })
  maxBetUsd!: number;

  @ApiProperty({
    description: 'New maximum payout in USD',
    example: 100000,
  })
  maxPayoutUsd!: number;
}
