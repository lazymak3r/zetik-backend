import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ description: 'Operation status message', example: 'Success' })
  message!: string;
}
