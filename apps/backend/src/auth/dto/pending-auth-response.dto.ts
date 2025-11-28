import { ApiProperty } from '@nestjs/swagger';

export class PendingAuthResponseDto {
  @ApiProperty({
    description: 'Indicates that 2FA is required to complete login',
    example: true,
  })
  requiresTwoFactor!: boolean;

  @ApiProperty({
    description: 'Temporary token valid for 5 minutes to complete 2FA verification',
    example: 'a1b2c3d4e5f6...',
  })
  pendingAuthToken!: string;

  @ApiProperty({
    description: 'Message explaining next steps',
    example: 'Please provide your 2FA code to complete login from this new device',
  })
  message!: string;
}
