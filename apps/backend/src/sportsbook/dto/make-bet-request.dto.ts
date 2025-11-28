import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BonusType } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { BetSlipItemDto, TransactionItemDto } from './common.dto';

export class MakeBetRequestDto {
  @ApiProperty({
    description:
      'Amount of money to be deducted from the player`s balance after the bet is being made',
    type: Number,
  })
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description:
      'Currency code. The full list of currencies supported can be found in the Appendices',
  })
  @IsString()
  currency!: string;

  @ApiProperty({
    description: 'Unique identifier assigned to a player on Partner side',
  })
  @IsString()
  player_id!: string;

  @ApiProperty({
    description: 'Unique token id provided by Partner in the Initialize method',
  })
  @IsString()
  session_id!: string;

  @ApiPropertyOptional({
    description:
      'Optional, in case is used. Unique identifier of bonus associated with the transaction',
  })
  @IsOptional()
  @IsString()
  bonus_id?: string;

  @ApiPropertyOptional({
    description:
      'Optional, in case is used. Provides the bonus type is used (freebet_refund, freebet_freemoney, freebet_no_risk, global_comboboost, comboboost)',
    enum: BonusType,
  })
  @IsOptional()
  @IsString()
  bonus_type?: BonusType;

  @ApiProperty({
    description: 'Dictionary containing information about the transaction',
    type: TransactionItemDto,
  })
  @ValidateNested()
  @Type(() => TransactionItemDto)
  transaction!: TransactionItemDto;

  @ApiProperty({
    description: 'Dictionary containing information about player`s betslip',
    type: BetSlipItemDto,
  })
  @ValidateNested()
  @Type(() => BetSlipItemDto)
  betslip!: BetSlipItemDto;

  @ApiProperty({
    description: 'Amount of potential win, comboboost not included',
    type: Number,
  })
  @IsNumber()
  potential_win!: number;

  @ApiPropertyOptional({
    description:
      'Amount of potential additional win due the comboboost. Provided if comboboost is in use only',
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  potential_comboboost_win?: number;
}
