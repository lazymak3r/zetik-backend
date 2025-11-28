import { ApiProperty } from '@nestjs/swagger';

export class VipTierResponseDto {
  @ApiProperty()
  level!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  isForVip!: boolean;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty()
  wagerRequirement!: string;

  @ApiProperty({ required: false })
  levelUpBonusAmount?: string;

  @ApiProperty({ required: false })
  rakebackPercentage?: string;

  @ApiProperty({ required: false })
  rankUpBonusAmount?: string;

  @ApiProperty({ required: false })
  weeklyBonusPercentage?: string;

  @ApiProperty({ required: false })
  monthlyBonusPercentage?: string;

  @ApiProperty({ required: false })
  weeklyReloadProfitablePercentage?: string;

  @ApiProperty({ required: false })
  weeklyReloadLosingPercentage?: string;

  @ApiProperty({ required: false, description: 'Minimum daily weekly reload amount in dollars' })
  weeklyReloadDailyMin?: string;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  updatedBy?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
