import { ApiProperty } from '@nestjs/swagger';
import { BalanceHistoryEntity } from '@zetik/shared-entities';
import { PublicUserProfileDto } from '../../users/dto/public-user-profile.dto';

export class ExtendedBalanceHistoryItemDto extends BalanceHistoryEntity {
  @ApiProperty({
    description: 'User who sent the transaction (for tips, transfers)',
    type: PublicUserProfileDto,
    required: false,
  })
  fromUser?: PublicUserProfileDto;

  @ApiProperty({
    description: 'User who received the transaction (for tips, transfers)',
    type: PublicUserProfileDto,
    required: false,
  })
  toUser?: PublicUserProfileDto;

  @ApiProperty({
    description: 'User associated with the transaction (for other operations)',
    type: PublicUserProfileDto,
    required: false,
  })
  user?: PublicUserProfileDto;
}

export class ExtendedBalanceHistoryResponseDto {
  @ApiProperty({
    description: 'Array of balance history items with extended user information',
    type: [ExtendedBalanceHistoryItemDto],
  })
  items!: ExtendedBalanceHistoryItemDto[];

  @ApiProperty({ description: 'Total count of items' })
  total!: number;
}
