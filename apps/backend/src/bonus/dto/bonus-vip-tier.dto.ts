import { ApiProperty } from '@nestjs/swagger';

export class BonusVipTierDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  level!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  isForVip?: boolean;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty({ description: 'Wager requirement in dollars' })
  wagerRequirement!: string;

  @ApiProperty({ required: false, description: 'Level up bonus in dollars' })
  levelUpBonusAmount?: string;

  @ApiProperty({ required: false })
  rakebackPercentage?: string;

  @ApiProperty({ required: false, description: 'Rank-up bonus in dollars (first level of rank)' })
  rankUpBonusAmount?: string;

  @ApiProperty({ required: false })
  weeklyBonusPercentage?: string;

  @ApiProperty({ required: false })
  monthlyBonusPercentage?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
