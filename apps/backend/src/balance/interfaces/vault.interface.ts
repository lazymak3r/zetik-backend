import { AssetTypeEnum } from '@zetik/shared-entities';

export interface IVaultInfo {
  asset: AssetTypeEnum;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVaultTransferResult {
  asset: AssetTypeEnum;
  walletBalance: string;
  vaultBalance: string;
}
