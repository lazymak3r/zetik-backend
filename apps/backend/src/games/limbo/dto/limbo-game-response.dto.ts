import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, LimboGameStatus } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class LimboGameResponseDto implements GameDisplayFields {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  gameSessionId?: string;

  @ApiProperty()
  betAmount!: string;

  @ApiProperty()
  asset!: AssetTypeEnum;

  @ApiProperty()
  status!: LimboGameStatus;

  @ApiProperty()
  targetMultiplier!: string;

  @ApiProperty()
  resultMultiplier!: string;

  @ApiProperty()
  crashPoint!: string; // Alias for resultMultiplier (for consistency with other games)

  @ApiProperty()
  winChance!: string;

  @ApiPropertyOptional()
  winAmount?: string;

  @ApiProperty()
  serverSeedHash!: string;

  @ApiProperty()
  clientSeed!: string;

  @ApiProperty()
  nonce!: string;

  @ApiPropertyOptional()
  serverSeed?: string; // Only revealed after game ends

  @ApiProperty({ nullable: true })
  user!: BetUserInfoDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  originalFiatAmount?: string;

  @ApiPropertyOptional()
  originalFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional()
  payoutFiatAmount?: string;

  @ApiPropertyOptional()
  payoutFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
  })
  fiatToUsdRate?: string;
}
