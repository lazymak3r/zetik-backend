import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BonusType } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SelectionItemDto, TransactionItemDto } from './common.dto';

export class BetWinRequestDto {
  @ApiProperty({
    description: 'Amount of money to be transferred to players balance',
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
    description: 'The mark of cash out being applied',
  })
  @IsBoolean()
  is_cashout!: boolean;

  @ApiProperty({
    description: 'Unique identifier assigned by Partner',
  })
  @IsString()
  bet_transaction_id!: string;

  @ApiProperty({
    description: 'Dictionary containing description of transaction',
    type: TransactionItemDto,
  })
  @ValidateNested()
  @Type(() => TransactionItemDto)
  transaction!: TransactionItemDto;

  @ApiPropertyOptional({
    description:
      'Optional parameter. Is used only in case No Risk Freebet is lost. See freebet rules in terms',
  })
  @IsOptional()
  @IsBoolean()
  is_snr_lost?: boolean;

  @ApiProperty({
    description: 'Provides statuses of all selections included (open, lost, won, etc)',
    type: () => [SelectionItemDto],
  })
  @ValidateNested({ each: true })
  @Type(() => SelectionItemDto)
  selections!: SelectionItemDto[];

  @ApiPropertyOptional({
    description:
      'Optional. Provides final calculated bet odds (comboboost is not considered). Not used for cashout',
  })
  @IsOptional()
  @IsString()
  odds?: string;

  @ApiPropertyOptional({
    description: 'Optional parameter. Betby Bonus ID',
  })
  @IsOptional()
  @IsString()
  bonus_id?: string;

  @ApiPropertyOptional({
    description:
      'Optional. Provides the bonus type is used (freebet_refund, freebet_freemoney, freebet_no_risk, global_comboboost, comboboost)',
    enum: BonusType,
  })
  @IsOptional()
  @IsString()
  bonus_type?: BonusType;

  @ApiPropertyOptional({
    description: 'Optional. Provides the comboboost multiplier',
  })
  @IsOptional()
  @IsString()
  comboboost_multiplier?: string;
}
