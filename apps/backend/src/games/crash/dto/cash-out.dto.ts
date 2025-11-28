import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class CashOutDto {
  @ApiProperty({
    description: 'Crash bet ID to cash out',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  betId!: string;
}
