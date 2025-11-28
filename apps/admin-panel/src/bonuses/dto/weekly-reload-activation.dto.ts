import { ApiProperty } from '@nestjs/swagger';

export class WeeklyReloadActivationDto {
  @ApiProperty({ description: 'Success status' })
  success!: boolean;

  @ApiProperty({ description: 'Message describing the result' })
  message!: string;

  @ApiProperty({ description: 'Number of daily bonuses created' })
  bonusesCreated!: number;

  @ApiProperty({ description: 'Total weekly amount in dollars' })
  totalWeeklyAmount!: number;

  @ApiProperty({ description: 'Daily amount in dollars' })
  dailyAmount!: number;

  @ApiProperty({
    description: 'Array of created bonus details',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        bonusId: { type: 'string' },
        amount: { type: 'number' },
        activateAt: { type: 'string', format: 'date-time' },
        expiredAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  bonusDetails!: Array<{
    bonusId: string;
    amount: number;
    activateAt: string;
    expiredAt: string;
  }>;
}
