import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class SubmitBasicInfoDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'First name can only contain letters, spaces, hyphens and apostrophes',
  })
  firstName!: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Last name can only contain letters, spaces, hyphens and apostrophes',
  })
  lastName!: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
  })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1234567890',
  })
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be in valid international format',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main St',
    minLength: 5,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 200)
  address!: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  city!: string;

  @ApiProperty({
    description: 'State or province',
    example: 'NY',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  state!: string;

  @ApiProperty({
    description: 'Postal code',
    example: '10001',
    minLength: 3,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9\s-]+$/, {
    message: 'Postal code can only contain letters, numbers, spaces and hyphens',
  })
  postalCode!: string;

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  country!: string;
}
