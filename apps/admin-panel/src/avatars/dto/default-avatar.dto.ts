import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DefaultAvatarResponseDto {
  @ApiProperty({
    description: 'Default avatar ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Avatar image URL',
    example: 'https://storage.example.com/default-avatars/avatar-01.avif',
  })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'avatar-01.avif',
  })
  originalFilename!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 5432,
  })
  fileSize!: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/avif',
  })
  mimeType!: string;

  @ApiProperty({
    description: 'Display order (lower number = higher priority)',
    example: 0,
  })
  displayOrder!: number;

  @ApiProperty({
    description: 'Whether this avatar is active and shown to users',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Optional description',
    example: 'Cool robot avatar',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-10-20T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-10-20T12:00:00Z',
  })
  updatedAt!: Date;
}

export class UploadDefaultAvatarDto {
  @ApiProperty({
    description: 'Display order (lower number = higher priority)',
    example: '0',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsString()
  displayOrder?: string;

  @ApiProperty({
    description: 'Optional description for admin reference',
    example: 'Cool robot avatar',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDefaultAvatarDto {
  @ApiProperty({
    description: 'Display order (lower number = higher priority)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @ApiProperty({
    description: 'Whether this avatar is active and shown to users',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Optional description for admin reference',
    example: 'Updated description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
