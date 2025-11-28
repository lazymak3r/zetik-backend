import { AssetTypeEnum } from '../../balance/enums/asset-type.enum';

export interface ITipMessageMetadata {
  recipientId: string;
  asset: AssetTypeEnum;
  amount: string;
}
