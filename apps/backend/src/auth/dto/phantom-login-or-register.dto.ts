import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class PhantomLoginOrRegisterDto {
  @ApiProperty({ description: 'Solana address' })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { message: 'Invalid Solana address' })
  address!: string;

  @ApiProperty({
    description:
      'Signature of the login message (base58 string or ArrayBuffer for backward compatibility)',
  })
  signature!: string | ArrayBuffer;

  @ApiProperty({
    description: 'Affiliate campaign ID or code for referral tracking',
    example: 'SUMMER2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  affiliateCampaignId?: string;
}
