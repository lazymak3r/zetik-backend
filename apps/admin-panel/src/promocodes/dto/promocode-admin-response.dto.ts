import { ApiProperty } from '@nestjs/swagger';
import {
  AssetTypeEnum,
  PromocodeAuditActionEnum,
  PromocodeStatusEnum,
} from '@zetik/shared-entities';

export class PromocodeAdminResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  createdByAdminId!: string;

  @ApiProperty()
  createdByAdminEmail?: string;

  @ApiProperty()
  valuePerClaim!: string;

  @ApiProperty()
  totalClaims!: number;

  @ApiProperty()
  claimedCount!: number;

  @ApiProperty()
  remainingClaims!: number;

  @ApiProperty()
  asset!: AssetTypeEnum;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiProperty()
  status!: PromocodeStatusEnum;

  @ApiProperty()
  note?: string;

  @ApiProperty()
  eligibilityRules!: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PromocodeClaimDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false })
  userEmail?: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty({ enum: AssetTypeEnum })
  asset!: AssetTypeEnum;

  @ApiProperty({ required: false })
  ipAddress?: string;

  @ApiProperty({ required: false })
  deviceFingerprint?: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt!: Date;
}

export class PromocodeAuditResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  promocodeId!: string;

  @ApiProperty()
  adminId!: string;

  @ApiProperty()
  adminEmail?: string;

  @ApiProperty({ enum: PromocodeAuditActionEnum })
  action!: PromocodeAuditActionEnum;

  @ApiProperty({ required: false })
  previousValues?: Record<string, any>;

  @ApiProperty({ required: false })
  newValues?: Record<string, any>;

  @ApiProperty({ required: false })
  reason?: string;

  @ApiProperty()
  createdAt!: Date;
}
