import { AssetTypeEnum } from '@zetik/shared-entities';

export interface ISportsbookBetSettledEventPayload {
  userId: string;
  betAmount: string;
  asset: AssetTypeEnum;
  betId: string;
  status: 'WON' | 'LOST' | 'CANCELED' | 'REFUND';
  operationId: string;
}
