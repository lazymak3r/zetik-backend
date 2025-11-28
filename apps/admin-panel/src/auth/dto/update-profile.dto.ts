import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'currentPassword123' })
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @IsOptional()
  @MinLength(8)
  newPassword?: string;
}
