import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';

export class CrashLeaderboardEntryDto {
  @ApiProperty({
    description: 'User ID',
    example: 'ba44c53e-f170-474f-8256-9f1786ab9073',
  })
  userId!: string;

  @ApiProperty({
    description: 'Username',
    example: 'testuser755003',
  })
  username!: string;

  @ApiPropertyOptional({
    description: 'VIP level image URL',
    example: 'user-level/sapphire-1',
  })
  vipLevelImageUrl?: string;

  @ApiProperty({
    description: 'Cash out amount',
    example: '0.00002000',
  })
  cashOut!: string;

  @ApiProperty({
    enum: AssetTypeEnum,
    description: 'Asset type',
    example: AssetTypeEnum.BTC,
  })
  asset!: AssetTypeEnum;

  @ApiPropertyOptional({
    description: 'Auto cash out multiplier',
    example: '2.0',
  })
  autoCashOutAt?: string;

  @ApiPropertyOptional({
    description: 'Real multiplier when user cashed out (null if crashed)',
    example: '1.75',
    nullable: true,
  })
  cashOutAt?: string;
}
