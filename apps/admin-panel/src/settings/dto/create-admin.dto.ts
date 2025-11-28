import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@zetik/shared-entities';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Admin User' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.ADMIN, required: false })
  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;
}
