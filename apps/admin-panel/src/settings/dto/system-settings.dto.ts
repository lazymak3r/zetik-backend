import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SystemSettingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  value!: any;

  @ApiProperty({ nullable: true })
  description?: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  isSecret!: boolean;

  @ApiProperty({ nullable: true })
  updatedBy?: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class UpdateSettingDto {
  @ApiProperty()
  value!: any;
}

export class SettingsCategoryDto {
  @ApiProperty()
  category!: string;

  @ApiProperty()
  settings!: SystemSettingDto[];
}

export class PlatformSettingsDto {
  @ApiProperty()
  maintenanceMode!: boolean;

  @ApiProperty()
  maintenanceMessage!: string;

  @ApiProperty()
  registrationEnabled!: boolean;

  @ApiProperty()
  withdrawalsEnabled!: boolean;

  @ApiProperty()
  depositsEnabled!: boolean;

  @ApiProperty()
  minDepositAmount!: string;

  @ApiProperty()
  minWithdrawalAmount!: string;

  @ApiProperty()
  maxWithdrawalDaily!: string;

  @ApiProperty()
  withdrawalFeePercent!: number;

  @ApiProperty()
  kycRequired!: boolean;

  @ApiProperty()
  kycThreshold!: string;
}

export class SecuritySettingsDto {
  @ApiProperty()
  twoFactorRequired!: boolean;

  @ApiProperty()
  sessionTimeout!: number;

  @ApiProperty()
  maxLoginAttempts!: number;

  @ApiProperty()
  ipWhitelist!: string[];

  @ApiProperty()
  suspiciousActivityThreshold!: number;

  @ApiProperty()
  autoLogoutInactivity!: number;
}

export class BonusSettingsDto {
  @ApiProperty()
  welcomeBonusEnabled!: boolean;

  @ApiProperty()
  welcomeBonusAmount!: string;

  @ApiProperty()
  dailyBonusEnabled!: boolean;

  @ApiProperty()
  rakebackEnabled!: boolean;

  @ApiProperty()
  rakebackPercent!: number;

  @ApiProperty()
  vipProgramEnabled!: boolean;

  @ApiProperty()
  affiliateEnabled!: boolean;

  @ApiProperty()
  affiliateCommissionPercent!: number;
}

export class EmailSettingsDto {
  @ApiProperty()
  smtpHost!: string;

  @ApiProperty()
  smtpPort!: number;

  @ApiProperty()
  smtpUser!: string;

  @ApiPropertyOptional()
  smtpPassword?: string;

  @ApiProperty()
  smtpSecure!: boolean;

  @ApiProperty()
  fromEmail!: string;

  @ApiProperty()
  fromName!: string;

  @ApiProperty()
  emailVerificationRequired!: boolean;
}

export class GameSettingsDto {
  @ApiProperty()
  crashMaxPayout!: string;

  @ApiProperty()
  crashMinBet!: string;

  @ApiProperty()
  crashMaxBet!: string;

  @ApiProperty()
  blackjackMinBet!: string;

  @ApiProperty()
  blackjackMaxBet!: string;

  @ApiProperty()
  diceMinBet!: string;

  @ApiProperty()
  diceMaxBet!: string;

  @ApiProperty()
  limboMinBet!: string;

  @ApiProperty()
  limboMaxBet!: string;

  @ApiProperty()
  minesMinBet!: string;

  @ApiProperty()
  minesMaxBet!: string;

  @ApiProperty()
  plinkoMinBet!: string;

  @ApiProperty()
  plinkoMaxBet!: string;

  @ApiProperty()
  rouletteMinBet!: string;

  @ApiProperty()
  rouletteMaxBet!: string;

  @ApiProperty()
  kenoMinBet!: string;

  @ApiProperty()
  kenoMaxBet!: string;
}

export class UpdateGameSettingsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  crashMaxPayout?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  crashMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  crashMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  blackjackMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  blackjackMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diceMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diceMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  limboMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  limboMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  minesMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  minesMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  plinkoMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  plinkoMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rouletteMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rouletteMaxBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  kenoMinBet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  kenoMaxBet?: string;
}

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  registrationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  withdrawalsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  depositsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  minDepositAmount?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  minWithdrawalAmount?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  maxWithdrawalDaily?: string;

  @ApiPropertyOptional()
  @IsOptional()
  withdrawalFeePercent?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  kycRequired?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  kycThreshold?: string;
}
