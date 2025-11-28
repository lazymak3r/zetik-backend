import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length, Matches } from 'class-validator';

export class VerifyPhoneCodeDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1234567890',
  })
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be in valid international format',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: '6-digit verification code',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only digits' })
  code!: string;
}
