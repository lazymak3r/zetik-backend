import { ApiProperty } from '@nestjs/swagger';

export class AvatarUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Avatar image file (JPEG, PNG, WebP up to 5MB)',
  })
  avatar!: any;
}

export class AvatarUploadResponseDto {
  @ApiProperty({
    description: 'URL of the uploaded avatar image',
    example: 'https://example.com/avatars/user-123.jpg',
  })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Avatar uploaded successfully',
  })
  message!: string;
}

export class UserAvatarDto {
  @ApiProperty({
    description: 'Avatar ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Avatar image URL',
    example: 'https://example.com/avatars/user-123-1699999999.png',
  })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Whether this is a system/default avatar',
    example: false,
  })
  isSystem!: boolean;

  @ApiProperty({
    description: 'Original filename',
    example: 'my-avatar.png',
    required: false,
  })
  originalFilename?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 524288,
    required: false,
  })
  fileSize?: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/png',
    required: false,
  })
  mimeType?: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-10-20T12:00:00Z',
  })
  createdAt!: Date;
}

export class AvatarGalleryResponseDto {
  @ApiProperty({
    description: 'Combined list of user and system avatars',
    type: [UserAvatarDto],
  })
  avatars!: UserAvatarDto[];

  @ApiProperty({
    description: 'ID of currently selected/active avatar (can be user or system avatar)',
    type: 'string',
    required: false,
  })
  selectedAvatarId?: string;
}

export class AvatarUploadGalleryResponseDto {
  @ApiProperty({
    description: 'Newly uploaded avatar',
    type: UserAvatarDto,
  })
  avatar!: UserAvatarDto;

  @ApiProperty({
    description: 'Success message',
    example: 'Avatar uploaded and set as active successfully',
  })
  message!: string;
}

export class ActivateAvatarResponseDto {
  @ApiProperty({
    description: 'ID of the activated avatar',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  avatarId!: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Avatar activated successfully',
  })
  message!: string;
}

export class DeleteAvatarResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Avatar deleted successfully',
  })
  message!: string;
}
