import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class MetamaskLoginOrRegisterDto {
  @ApiProperty({ description: 'Ethereum address' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  address!: string;

  @ApiProperty({ description: 'Signature of the login message' })
  @IsString()
  signature!: string;

  @ApiProperty({
    description: 'Affiliate campaign ID or code for referral tracking',
    example: 'SUMMER2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  affiliateCampaignId?: string;
}
