export interface IEligibilityRules {
  minRank?: number;
  requireKyc?: boolean;
  minKycLevel?: string;
  allowedCountries?: string[];
  excludedCountries?: string[];
  referralCodes?: string[];
  perUserLimit?: number;
  accountCreatedBefore?: string;
  onePerDevice?: boolean;
  onePerIp?: boolean;
}

export interface IPromocodeAdminResponse {
  id: string;
  code: string;
  createdByAdminId: string;
  createdByAdminEmail?: string;
  valuePerClaim: string;
  totalClaims: number;
  claimedCount: number;
  remainingClaims: number;
  asset: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  note?: string;
  eligibilityRules: IEligibilityRules;
  createdAt: string;
  updatedAt: string;
  claims?: IPromocodeClaim[];
}

export interface IPromocodeClaim {
  id: string;
  userId: string;
  userEmail?: string;
  amount: string;
  asset: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ICreatePromocode {
  code: string;
  valuePerClaim: number;
  totalClaims: number;
  asset: string;
  startsAt: string;
  endsAt: string;
  note?: string;
  eligibilityRules: IEligibilityRules;
}

export interface IUpdatePromocode {
  status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  endsAt?: string;
  note?: string;
}

export interface IPromocodeListQuery {
  status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  page?: number;
  limit?: number;
  search?: string;
}

export interface IPromocodeAuditItem {
  id: string;
  promocodeId: string;
  adminId: string;
  adminEmail?: string;
  action: 'CREATED' | 'PAUSED' | 'RESUMED' | 'CANCELLED' | 'UPDATED';
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
  createdAt: string;
}
