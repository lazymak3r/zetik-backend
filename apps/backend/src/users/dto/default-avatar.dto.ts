import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/**
 * DTO for default avatar response
 */
export class DefaultAvatarDto {
  @ApiProperty({
    description: 'Default avatar ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Avatar URL in storage',
    example: 'https://storage.example.com/default-avatars/avatar1.png',
  })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'avatar1.png',
  })
  originalFilename!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 45678,
  })
  fileSize!: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/png',
  })
  mimeType!: string;

  @ApiProperty({
    description: 'Display order (lower = higher priority)',
    example: 0,
  })
  displayOrder!: number;

  @ApiProperty({
    description: 'Whether avatar is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Optional description',
    example: 'Cool avatar',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-10-20T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-10-20T00:00:00.000Z',
  })
  updatedAt!: Date;
}

/**
 * DTO for getting all default avatars
 */
export class DefaultAvatarGalleryResponseDto {
  @ApiProperty({
    description: 'List of default avatars',
    type: [DefaultAvatarDto],
  })
  defaultAvatars!: DefaultAvatarDto[];
}

/**
 * DTO for activating a default avatar
 */
export class ActivateDefaultAvatarDto {
  @ApiProperty({
    description: 'Default avatar ID to activate',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  defaultAvatarId!: string;
}

/**
 * DTO for activate default avatar response
 */
export class ActivateDefaultAvatarResponseDto {
  @ApiProperty({
    description: 'Activated default avatar',
    type: DefaultAvatarDto,
  })
  defaultAvatar!: DefaultAvatarDto;

  @ApiProperty({
    description: 'Success message',
    example: 'Default avatar activated successfully',
  })
  message!: string;
}

/**
 * Admin DTO for creating a default avatar
 */
export class CreateDefaultAvatarDto {
  @ApiProperty({
    description: 'Display order',
    example: 0,
  })
  @IsInt()
  @Min(0)
  displayOrder!: number;

  @ApiProperty({
    description: 'Optional description',
    example: 'Cool avatar',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

/**
 * Admin DTO for updating a default avatar
 */
export class UpdateDefaultAvatarDto {
  @ApiProperty({
    description: 'Display order',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({
    description: 'Whether avatar is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Optional description',
    example: 'Cool avatar',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

/**
 * Response when default avatar is uploaded by admin
 */
export class DefaultAvatarUploadResponseDto {
  @ApiProperty({
    description: 'Uploaded default avatar',
    type: DefaultAvatarDto,
  })
  defaultAvatar!: DefaultAvatarDto;

  @ApiProperty({
    description: 'Success message',
    example: 'Default avatar uploaded successfully',
  })
  message!: string;
}
