import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EmailLoginDto {
  @ApiProperty({
    description: 'Email address or username for login',
    example: 'user@example.com or username123',
  })
  @IsString()
  email!: string;

  @ApiProperty({
    description: 'Password',
    example: 'Secret123',
  })
  @IsString()
  password!: string;
}
