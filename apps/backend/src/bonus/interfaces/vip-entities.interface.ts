export interface IUserVipStatus {
  userId: string;
  currentWager: string;
  currentVipLevel: number;
  previousVipLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVipTier {
  level: number;
  name: string;
  description?: string;
  isForVip: boolean;
  imageUrl?: string;
  wagerRequirement: string;
  levelUpBonusAmount?: string;
  rakebackPercentage?: string;
  rankUpBonusAmount?: string;
  weeklyBonusPercentage?: string;
  monthlyBonusPercentage?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
