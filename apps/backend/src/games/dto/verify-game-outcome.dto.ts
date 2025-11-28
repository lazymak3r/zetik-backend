import { ApiProperty } from '@nestjs/swagger';
import { GameTypeEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Matches } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class VerifyGameOutcomeDto {
  @ApiProperty({
    description: 'Server seed used in the game',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'Server seed must be a 64-character hexadecimal string',
  })
  serverSeed!: string;

  @ApiProperty({
    description: 'Client seed used in the game',
    example: 'my_client_seed_123',
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce value used in the game',
    example: '1',
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @Matches(/^\d+$/, {
    message: 'Nonce must be a positive integer string',
  })
  nonce!: string;

  @ApiProperty({
    description: 'Game type',
    example: GameTypeEnum.CRASH,
    enum: GameTypeEnum,
  })
  @IsEnum(GameTypeEnum, { message: 'Invalid game type' })
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  gameType!: GameTypeEnum;

  @ApiProperty({
    description: 'Game outcome to verify',
    example: 2.5,
  })
  @IsNumber({}, { message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @Type(() => Number)
  outcome!: number;
}
