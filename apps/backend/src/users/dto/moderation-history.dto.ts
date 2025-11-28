import { ApiProperty } from '@nestjs/swagger';
import { ModerationActionTypeEnum } from '@zetik/shared-entities';

export class AdminInfoDto {
  @ApiProperty({
    description: 'Admin user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Admin username',
    example: 'admin_user',
  })
  username!: string;

  @ApiProperty({
    description: 'Admin display name',
    required: false,
  })
  displayName?: string;
}

export class ModerationHistoryItemDto {
  @ApiProperty({
    description: 'Moderation history record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Type of moderation action',
    enum: ModerationActionTypeEnum,
    example: ModerationActionTypeEnum.MUTE,
  })
  actionType!: ModerationActionTypeEnum;

  @ApiProperty({
    description: 'Reason for the moderation action',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Duration of the action in minutes',
    example: 60,
  })
  durationMinutes!: number;

  @ApiProperty({
    description: 'When the moderation action was created',
    example: '2025-05-12T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Admin who performed the action',
    type: AdminInfoDto,
  })
  admin!: AdminInfoDto;
}
