import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class CashoutMinesDto {
  @ApiProperty({
    description: 'Mines game ID to cash out',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  gameId!: string;
}
