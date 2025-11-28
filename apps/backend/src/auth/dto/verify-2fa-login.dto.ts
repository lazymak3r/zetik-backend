import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsString, Length } from 'class-validator';

export class Verify2FALoginDto {
  @ApiProperty({
    description: 'Temporary pending auth token received from login endpoint',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  pendingAuthToken!: string;

  @ApiProperty({
    description: '6-digit 2FA code from authenticator app',
    example: '123456',
  })
  @IsNumberString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  twoFactorCode!: string;
}
