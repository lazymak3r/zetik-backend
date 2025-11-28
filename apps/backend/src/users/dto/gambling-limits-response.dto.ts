import { ApiProperty } from '@nestjs/swagger';
import { LimitPeriodEnum, SelfExclusionTypeEnum } from '@zetik/shared-entities';

export class GamblingLimitDto {
  @ApiProperty({
    description: 'Self-exclusion ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Self-exclusion type',
    enum: SelfExclusionTypeEnum,
    example: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
  })
  type!: SelfExclusionTypeEnum;

  @ApiProperty({
    description: 'Period for the limit',
    enum: LimitPeriodEnum,
    example: LimitPeriodEnum.DAILY,
  })
  period!: LimitPeriodEnum;

  @ApiProperty({
    description: 'Limit amount',
    example: 1000,
  })
  limitAmount!: number;

  @ApiProperty({
    description: 'Remaining amount before reaching the limit',
    example: 500,
  })
  remainingAmount!: number;

  @ApiProperty({
    description: 'Used amount within the current period',
    example: 500,
  })
  usedAmount!: number;

  @ApiProperty({
    description: 'Start date of the current period',
    example: '2023-01-01T00:00:00Z',
  })
  periodStartDate!: Date;

  @ApiProperty({
    description: 'End date of the current period',
    example: '2023-01-02T00:00:00Z',
  })
  periodEndDate!: Date;
}

export class GamblingLimitsResponseDto {
  @ApiProperty({
    description: 'Deposit limits',
    type: [GamblingLimitDto],
  })
  depositLimits!: GamblingLimitDto[];

  @ApiProperty({
    description: 'Loss limits',
    type: [GamblingLimitDto],
  })
  lossLimits!: GamblingLimitDto[];

  @ApiProperty({
    description: 'Wager limits',
    type: [GamblingLimitDto],
  })
  wagerLimits!: GamblingLimitDto[];
}
