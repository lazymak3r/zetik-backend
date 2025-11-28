import { ApiProperty } from '@nestjs/swagger';

export class BetUserInfoDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Username of the player',
    example: 'testuser755003',
  })
  userName!: string;

  @ApiProperty({
    description: 'URL to the user VIP level image',
    example: 'user-level/silver-2',
  })
  levelImageUrl!: string;
}
