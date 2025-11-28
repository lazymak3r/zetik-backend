export interface SystemSettings {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  withdrawalsEnabled: boolean;
  depositsEnabled: boolean;
  minWithdrawAmount: number;
  maxWithdrawAmount: number;
  withdrawalFeePercent: number;
  affiliateCommissionPercent: number;
  rakebackPercent: number;
  vipLevelRequirements: Record<string, number>;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  lastLogin: string;
  isActive: boolean;
  userId?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string;
  isActive: boolean;
}

export interface EmailCheckResult {
  exists: boolean;
  userId?: string;
  username?: string;
}
