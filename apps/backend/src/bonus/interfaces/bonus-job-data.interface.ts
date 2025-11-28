import { BonusJobTypeEnum } from '@zetik/shared-entities';

export interface IBonusJobData {
  type: BonusJobTypeEnum;
  period: {
    from: Date;
    to: Date;
  };
  metadata?: Record<string, any>;
}

export interface IBonusBatchJobData {
  offset: number;
  batchSize: number;
  batchIndex: number;
  totalBatches: number;
  jobId: string;
}

export interface IBonusJobResult {
  processed: number;
  failed: number;
  totalBonus: string;
  errors?: string[];
}
