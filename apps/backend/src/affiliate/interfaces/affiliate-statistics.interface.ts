export interface IAffiliateCommissionDetail {
  asset: string;
  commission: string;
  claimed: string;
  claimable: string;
}

export interface IAffiliateStatistics {
  totalReferrals: number;
  totalWageredUsd: string;
  totalDepositedUsd: string;
  totalClaimedUsd: string;
  totalAvailableUsd: string;
  commissions: IAffiliateCommissionDetail[];
}
