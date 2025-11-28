import { AssetTypeEnum } from '@zetik/shared-entities';

export interface IWallet {
  userId: string;
  asset: AssetTypeEnum;
  address: string;
  balance: string;
}
