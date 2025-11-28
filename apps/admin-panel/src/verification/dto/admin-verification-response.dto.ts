import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, VerificationLevel, VerificationStatus } from '@zetik/shared-entities';

export class AdminUserInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminDocumentInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DocumentType })
  documentType!: DocumentType;

  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty({ enum: VerificationStatus })
  status!: VerificationStatus;

  @ApiProperty({ required: false })
  rejectionReason?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminBasicInfoDto {
  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  dateOfBirth!: Date;

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminVerificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: VerificationLevel })
  level!: VerificationLevel;

  @ApiProperty({ enum: VerificationStatus })
  status!: VerificationStatus;

  @ApiProperty({ required: false })
  rejectionReason?: string;

  @ApiProperty({ required: false })
  adminNotes?: string;

  @ApiProperty({ required: false })
  reviewedBy?: string;

  @ApiProperty({ required: false })
  reviewedAt?: Date;

  @ApiProperty({ required: false })
  expiresAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: AdminUserInfoDto })
  user!: AdminUserInfoDto;

  @ApiProperty({ type: [AdminDocumentInfoDto] })
  documents!: AdminDocumentInfoDto[];

  @ApiProperty({ type: AdminBasicInfoDto, required: false })
  basicInfo?: AdminBasicInfoDto;
}
