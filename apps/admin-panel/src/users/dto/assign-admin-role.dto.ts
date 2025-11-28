import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@zetik/shared-entities';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignAdminRoleDto {
  @ApiProperty({
    description: 'Role to assign (MODERATOR or ADMIN)',
    enum: AdminRole,
    example: AdminRole.MODERATOR,
  })
  @IsNotEmpty()
  @IsEnum([AdminRole.MODERATOR, AdminRole.ADMIN])
  role!: AdminRole;

  @ApiProperty({
    description: 'Email for admin account (required if creating new admin account)',
    example: 'moderator@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Name for admin account (required if creating new admin account)',
    example: 'John Moderator',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
