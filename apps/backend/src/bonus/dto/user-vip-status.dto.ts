import { ApiProperty } from '@nestjs/swagger';

export class UserVipStatusDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ description: 'Current wager amount in dollars' })
  currentWager!: string;

  @ApiProperty()
  currentVipLevel!: number;

  @ApiProperty()
  previousVipLevel!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({
    description: 'Progress percentage to next VIP level (0-100)',
    required: false,
  })
  progressPercent?: number;
}
