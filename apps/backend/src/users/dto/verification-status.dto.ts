import { ApiProperty } from '@nestjs/swagger';
import { VerificationLevel, VerificationStatus } from '@zetik/shared-entities';

export class VerificationStatusDto {
  @ApiProperty({
    description: 'Verification level',
    enum: VerificationLevel,
    example: VerificationLevel.LEVEL_3_IDENTITY,
  })
  level!: VerificationLevel;

  @ApiProperty({
    description: 'Current verification status',
    enum: VerificationStatus,
    example: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @ApiProperty({
    description: 'Reason for rejection (if status is rejected)',
    required: false,
  })
  rejectionReason?: string;

  @ApiProperty({
    description: 'When the verification was reviewed',
    required: false,
  })
  reviewedAt?: Date;

  @ApiProperty({
    description: 'When the verification expires',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'When the verification was created',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'When the verification was last updated',
  })
  updatedAt!: Date;
}

export class UserVerificationOverviewDto {
  @ApiProperty({
    description: 'Email verification status',
    example: true,
  })
  emailVerified!: boolean;

  @ApiProperty({
    description: 'Basic information verification status',
    type: VerificationStatusDto,
    required: false,
  })
  basicInfo?: VerificationStatusDto;

  @ApiProperty({
    description: 'Identity verification status',
    type: VerificationStatusDto,
    required: false,
  })
  identity?: VerificationStatusDto;

  @ApiProperty({
    description: 'Overall verification progress (0-100)',
    example: 66,
  })
  overallProgress!: number;
}
