import { ApiProperty } from '@nestjs/swagger';

export class CookieConsentResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Cookie consent acceptance timestamp',
    example: '2025-11-20T22:10:00Z',
    required: false,
  })
  acceptedAt?: Date;
}
