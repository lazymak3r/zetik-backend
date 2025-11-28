import { BonusTypeEnum } from '@zetik/shared-entities';

export interface IIssueBonusCommand {
  operationId: string;
  userId: string;
  amount: string;
  bonusType: BonusTypeEnum;
  description?: string;
  relatedVipTierLevel?: number;
  metadata?: Record<string, any>;
}
