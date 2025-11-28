import { ApiProperty } from '@nestjs/swagger';
import { VerificationStatus } from '@zetik/shared-entities';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ReviewVerificationDto {
  @ApiProperty({
    description: 'Verification review decision',
    enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
    example: VerificationStatus.APPROVED,
  })
  @IsEnum([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status!: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  @ApiProperty({
    description: 'Reason for rejection (required if status is rejected)',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  rejectionReason?: string;

  @ApiProperty({
    description: 'Internal admin notes',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  adminNotes?: string;

  @ApiProperty({
    description: 'Admin user ID who reviewed',
    example: 'admin-123',
  })
  @IsString()
  reviewedBy!: string;

  @ApiProperty({
    description: 'Expiration date for approved verification (optional)',
    required: false,
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
