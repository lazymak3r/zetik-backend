import { ApiProperty } from '@nestjs/swagger';
import { AuthStrategyEnum } from '@zetik/shared-entities';

export interface IEmailValidationStatusResponse {
  registrationStrategy: AuthStrategyEnum;
  isValidated?: boolean;
}

export class EmailValidationStatusDto implements IEmailValidationStatusResponse {
  @ApiProperty({
    description: 'User registration strategy',
    enum: AuthStrategyEnum,
    example: AuthStrategyEnum.EMAIL,
  })
  registrationStrategy!: AuthStrategyEnum;

  @ApiProperty({
    description: 'Email validation status (only for email users, undefined for others)',
    example: true,
    required: false,
  })
  isValidated?: boolean;
}
