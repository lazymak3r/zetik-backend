import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class Enable2FAResponseDto {
  @ApiProperty({
    description: 'QR code data URL for setting up 2FA in authenticator app',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  qrCodeDataUrl!: string;

  @ApiProperty({
    description: 'Manual entry key (secret) for setting up 2FA',
    example: 'JBSWY3DPEHPK3PXP',
  })
  manualEntryKey!: string;
}

export class Verify2FADto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  token!: string;
}

export class Disable2FADto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  token!: string;
}

export class TwoFactorStatusDto {
  @ApiProperty({
    description: 'Whether 2FA is enabled for the user',
    example: true,
  })
  enabled!: boolean;
}
