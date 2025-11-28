import { ApiProperty } from '@nestjs/swagger';

export class WeeklyReloadCalculationDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Total weekly reload amount in dollars' })
  totalWeeklyAmount!: number;

  @ApiProperty({ description: 'Daily amount in dollars' })
  dailyAmount!: number;

  @ApiProperty({ description: 'User VIP level' })
  vipLevel!: number;

  @ApiProperty({ description: 'Applied percentage for weekly reload' })
  appliedPercentage!: number;

  @ApiProperty({ description: 'Effective edge in dollars' })
  effectiveEdge!: number;

  @ApiProperty({ description: 'Net result in dollars (positive = profit, negative = loss)' })
  netResult!: number;

  @ApiProperty({ description: 'Whether user is profitable or losing' })
  isProfitable!: boolean;

  @ApiProperty({ description: 'Period analyzed (last 7 days)' })
  periodAnalyzed!: string;
}
