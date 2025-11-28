import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import { AuthStrategyEnum } from '@zetik/shared-entities';
import { SelfExclusionResponseDto } from '../dto/self-exclusion-response.dto';

export interface IVipInfo {
  level: number;
  name: string;
  imageUrl: string;
  percent: number;
}

export interface IUserStatistics {
  totalBets: number;
  numberOfWins: number;
  numberOfLosses: number;
  wageredCents: number;
}

export interface IUnifiedUserProfile {
  // Basic info
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
  isPrivate: boolean;

  // VIP info
  vipInfo: IVipInfo;

  // Statistics
  statistics: IUserStatistics;

  // Private data (only for own profile)
  email?: string;
  isEmailVerified?: boolean;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
  registrationStrategy?: AuthStrategyEnum;
  currentFiatFormat?: FiatFormatEnum;
  currentCurrency?: CurrencyEnum;
  activeSelfExclusions?: SelfExclusionResponseDto[];
  cookieConsentAcceptedAt?: Date;
  referralCode?: string;

  // User settings
  emailMarketing?: boolean;
  streamerMode?: boolean;
  excludeFromRain?: boolean;
  hideStatistics: boolean;
  hideRaceStatistics?: boolean;
}
