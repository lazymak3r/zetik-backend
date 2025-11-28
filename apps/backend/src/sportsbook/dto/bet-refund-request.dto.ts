import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { TransactionItemDto } from './common.dto';

export enum RefundReasonCode {
  CORRECT_SCORE_MISSING = 2,
  RESULT_UNVERIFIABLE = 3,
  FORMAT_CHANGE = 4,
  CANCELLED_EVENT = 5,
  MISSING_GOALSCORER = 6,
  MATCH_ENDED_IN_WALKOVER = 7,
  DEAD_HEAT = 8,
  RETIRED_OR_DEFAULTED = 9,
  EVENT_ABANDONED = 10,
  EVENT_POSTPONED = 11,
  INCORRECT_ODDS = 12,
  INCORRECT_STATISTICS = 13,
  NO_RESULT_ASSIGNABLE = 14,
  STARTING_PITCHER_CHANGED = 16,
  INCORRECT_START_TIME = 18,
  OPERATOR_REQUEST = 19,
  MERCY_RULE = 20,
  STREAM_SNIPING = 21,
  BET_CANCELED = 22,
}

export class BetRefundRequestDto {
  @ApiProperty({
    description: 'Transaction ID assigned by Partner to be cancelled',
  })
  @IsString()
  bet_transaction_id!: string;

  @ApiProperty({
    description: 'Reason why transaction is going to be processed under refund procedure',
  })
  @IsString()
  reason!: string;

  @ApiProperty({
    description: 'Reason code',
    enum: RefundReasonCode,
    type: Number,
  })
  @IsNumber()
  @IsOptional()
  reason_code?: RefundReasonCode;

  @ApiPropertyOptional({
    description: 'Optional parameter. Betby Bonus ID',
  })
  @IsOptional()
  @IsString()
  bonus_id?: string;

  @ApiProperty({
    description: 'Dictionary containing description of transaction',
    type: TransactionItemDto,
  })
  @ValidateNested()
  @Type(() => TransactionItemDto)
  transaction!: TransactionItemDto;
}
