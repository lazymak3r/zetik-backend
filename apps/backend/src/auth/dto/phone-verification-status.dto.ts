import { ApiProperty } from '@nestjs/swagger';

export class PhoneVerificationStatusDto {
  @ApiProperty({
    description: 'Whether phone number is verified',
    example: true,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'Phone number (if verified)',
    example: '+1234567890',
    required: false,
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Verification timestamp (if verified)',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  verifiedAt?: Date;
}
