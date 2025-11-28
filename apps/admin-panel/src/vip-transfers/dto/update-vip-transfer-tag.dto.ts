import { ApiProperty } from '@nestjs/swagger';
import { VipTransferTagEnum } from '@zetik/shared-entities';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateVipTransferTagDto {
  @ApiProperty({
    enum: VipTransferTagEnum,
    description: 'Tag to assign',
    example: VipTransferTagEnum.PENDING,
  })
  @IsEnum(VipTransferTagEnum)
  tag!: VipTransferTagEnum;

  @ApiProperty({
    description: 'VIP level to assign when tag is Approved',
    required: false,
    example: 13,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  vipLevel?: number;
}
