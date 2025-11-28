import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RedeemPromocodeDto {
  @ApiProperty({
    description: 'Promocode to redeem',
    example: 'WELCOME2024',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Promocode must be at least 3 characters long' })
  @MaxLength(50, { message: 'Promocode must not exceed 50 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Promocode can only contain letters, numbers, underscores, and hyphens',
  })
  code!: string;
}
