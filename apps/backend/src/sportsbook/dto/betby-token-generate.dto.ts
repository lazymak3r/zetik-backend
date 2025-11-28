import { ApiProperty } from '@nestjs/swagger';

export class BetbyTokenGenerateRequestDto {
  @ApiProperty({
    description: 'Language',
    example: 'en',
  })
  language?: string;
}

export class BetbyTokenGenerateResponseDto {
  @ApiProperty({
    description: 'Generated JWT token for Betby',
    example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;
}
