import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@zetik/shared-entities';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAdminDto {
  @ApiProperty({ example: 'admin@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'Admin User', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.ADMIN, required: false })
  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;
}
