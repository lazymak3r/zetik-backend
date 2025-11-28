import { ApiProperty } from '@nestjs/swagger';

export class DepositAddressDto {
  @ApiProperty({ description: 'User deposit address' })
  address!: string;

  @ApiProperty({ description: 'QR code as SVG in base64 data URI' })
  qrCode!: string;
}
