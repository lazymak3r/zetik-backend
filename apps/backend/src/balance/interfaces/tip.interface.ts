import { AssetTypeEnum } from '@zetik/shared-entities';

export interface ITipRequestInput {
  fromUserId: string;
  toUserId: string;
  fromUsername?: string;
  amount: BigNumber;
  asset: AssetTypeEnum;
  publicTip?: boolean;
  message?: string;
}

export interface ITipRequestResponse {
  sendOperationId: string;
  receiveOperationId: string;
  senderBalance: string;
  receiverBalance: string;
}
