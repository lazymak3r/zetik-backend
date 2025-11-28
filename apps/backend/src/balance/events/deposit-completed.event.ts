import { AssetTypeEnum } from '@zetik/shared-entities';

export interface DepositCompletedEvent {
  userId: string;
  amount: string;
  asset: AssetTypeEnum;
  operationId: string;
}
