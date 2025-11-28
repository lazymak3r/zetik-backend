import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class SendPhoneVerificationDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1234567890',
  })
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be in valid international format',
  })
  phoneNumber!: string;
}
