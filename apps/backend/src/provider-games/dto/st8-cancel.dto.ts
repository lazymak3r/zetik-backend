import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ISt8CancelBaseInput, ISt8CancelExtendedInput } from '../interfaces/st8-cancel.interface';

export class St8CancelBaseDto implements ISt8CancelBaseInput {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  player!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  cancel_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  transaction_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  site!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  developer_code!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;
}

export class St8CancelExtendedDto extends St8CancelBaseDto implements ISt8CancelExtendedInput {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  round!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  token!: string;

  @ApiProperty({ nullable: true })
  @IsString()
  game_code!: string | null;
}
