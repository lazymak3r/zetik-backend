import { ApiProperty } from '@nestjs/swagger';
import { VipTransferCasinoEnum } from '@zetik/shared-entities';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVipTransferSubmissionDto {
  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Country', example: 'United States' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  country!: string;

  @ApiProperty({ description: 'Contact method', example: 'telegram', default: 'telegram' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactMethod!: string;

  @ApiProperty({ description: 'Contact username (Telegram, Discord, etc.)', example: '@johndoe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactUsername!: string;

  @ApiProperty({
    enum: VipTransferCasinoEnum,
    description: 'Casino name',
    example: VipTransferCasinoEnum.SHUFFLE,
  })
  @IsEnum(VipTransferCasinoEnum)
  casino!: VipTransferCasinoEnum;

  @ApiProperty({ description: 'Username on the casino platform', example: 'johndoe123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  casinoUsername!: string;

  @ApiProperty({ description: 'Total wager amount', example: '1000000' })
  @IsString()
  @IsNotEmpty()
  totalWager!: string;

  @ApiProperty({ description: 'Current rank/tier', example: 'Gold' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  rank!: string;

  @ApiProperty({
    description: 'How did you hear about us',
    required: false,
    example: 'Friend recommendation',
  })
  @IsString()
  @IsOptional()
  howDidYouHear?: string;
}
