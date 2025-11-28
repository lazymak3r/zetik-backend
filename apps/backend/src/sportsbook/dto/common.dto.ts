import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SelectionStatus } from '@zetik/shared-entities';
import { IsOptional, IsString } from 'class-validator';

export class SelectionItemDto {
  @ApiProperty({
    description: 'Bet ID assigned by Betby when bet_make request is processed',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Unique identifier of the event',
  })
  @IsString()
  event_id!: string;

  @ApiProperty({
    description: 'Status of the selection: open, won, lost, canceled, refund, half-won, half-lost',
    enum: SelectionStatus,
  })
  @IsString()
  status!: SelectionStatus;

  @ApiPropertyOptional({
    description: 'Provides current selection odds',
  })
  @IsOptional()
  @IsString()
  odds?: string;
}

export class TransactionItemDto {
  @ApiProperty({ description: 'Betby transaction id' })
  id!: string;

  @ApiProperty({ description: 'Betby betslip id' })
  betslip_id!: string;

  @ApiProperty({ description: 'Betby player id' })
  player_id!: string;

  @ApiProperty({ description: 'Partner operator id' })
  operator_id!: string;

  @ApiProperty({ description: 'Partner brand id' })
  operator_brand_id!: string;

  @ApiProperty({ description: 'External player id on Partner side' })
  ext_player_id!: string;

  @ApiProperty({ description: 'Transaction timestamp', type: Number })
  timestamp!: number;

  @ApiProperty({ description: 'Amount in cents', type: Number })
  amount!: number;

  @ApiProperty({ description: 'Currency' })
  currency!: string;

  @ApiPropertyOptional({ description: 'EUR cross rate' })
  cross_rate_euro?: string;

  @ApiProperty({ description: 'Operation type' })
  operation!: 'bet' | 'win' | 'refund' | 'lost' | 'rollback';

  @ApiPropertyOptional()
  bonus_id?: string;

  @ApiPropertyOptional({ description: 'Parent transaction id assigned by Betby' })
  parent_transaction_id?: string;
}

export class BetItemDto {
  @ApiProperty({ description: 'Unique identifier of a betslip`s selection assigned by Betby' })
  id!: string;

  @ApiProperty({ description: 'Unique identifier of the event' })
  event_id!: string;

  @ApiPropertyOptional({ description: 'Unique identifier of the sport' })
  sport_id?: string;

  @ApiPropertyOptional({ description: 'Unique identifier of the tournament' })
  tournament_id?: string;

  @ApiPropertyOptional({ description: 'Unique identifier of the category' })
  category_id?: string;

  @ApiPropertyOptional({ description: 'For live market is true, for prematch is false' })
  live?: boolean;

  @ApiPropertyOptional({ description: 'Name of the sport' })
  sport_name?: string;

  @ApiPropertyOptional({ description: 'Name of the category' })
  category_name?: string;

  @ApiPropertyOptional({ description: 'Name of the tournament' })
  tournament_name?: string;

  @ApiPropertyOptional({ description: 'List of competitors', type: [String] })
  competitor_name?: string[];

  @ApiPropertyOptional({ description: 'Name of the market' })
  market_name?: string;

  @ApiPropertyOptional({ description: 'Name of the outcome' })
  outcome_name?: string;

  @ApiPropertyOptional({ description: 'The event start time (unixtime)', type: Number })
  scheduled?: number;

  @ApiPropertyOptional({ description: 'The bet odds' })
  odds?: string;
}

export class BetSlipItemDto {
  @ApiProperty({ description: 'Unique identifier of betslip assigned by Betby when bet is made' })
  id!: string;

  @ApiProperty({ description: 'Betslip timestamp in unixtime', type: Number })
  timestamp!: number;

  @ApiProperty({ description: 'Unique identifier of player assigned by Betby' })
  player_id!: string;

  @ApiProperty({ description: 'Partner unique identifier' })
  operator_id!: string;

  @ApiProperty({ description: 'Partner Website unique identifier' })
  operator_brand_id!: string;

  @ApiProperty({ description: 'Unique identifier assigned to a player on Partner side' })
  ext_player_id!: string;

  @ApiProperty({
    description:
      'Currency code. The full list of currencies supported can be found in the Appendices',
  })
  currency!: string;

  @ApiProperty({
    description: 'Abbreviation of bet type. For more information see Type of bets chapter',
  })
  type!: string;

  @ApiProperty({ description: 'The amount of bet placed by player', type: Number })
  sum!: number;

  @ApiProperty({
    description: 'Total odds of the betslip resulted by multiplying odds of all the selections',
  })
  k!: string;

  @ApiPropertyOptional({
    description: 'The mark of either betslip has been made using Quick Bet function',
  })
  is_quick_bet?: boolean;

  @ApiPropertyOptional({
    description: 'The mark of either user has applied "accept odds change" function',
  })
  accept_odds_change?: boolean;

  @ApiProperty({
    description:
      'The array of dictionaries containing information about each selection included in a given betslip',
    type: () => [BetItemDto],
  })
  bets!: BetItemDto[];
}

export enum BetErrorCode {
  'Player blocked' = 1005,
  'Player not found' = 1006,
  'Session expired' = 1007,
  'Not enough money' = 2001,
  'Invalid currency' = 2002,
  'Parent transaction not found' = 2003,
  'Bad request' = 2004,
  'Invalid JWT token' = 2005,
  'Bonus not found' = 3001,
  'Player limits exceeded' = 4001,
  'Maximum bonus bet limit exceeded' = 4002,
}

export class BetErrorResponseDto {
  @ApiProperty({
    description: 'Code of error',
    enum: BetErrorCode,
    type: Number,
  })
  code!: BetErrorCode;

  @ApiProperty({
    description: 'Text of error explaining what has happened',
  })
  message!: string;
}
