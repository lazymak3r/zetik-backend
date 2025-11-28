import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SELF_EXCLUSION_QUEUE_NAME,
  SelfExclusionJobType,
} from './constants/self-exclusion-queue.constants';
import { SelfExclusionService } from './self-exclusion.service';

interface ISelfExclusionJobData {
  type: SelfExclusionJobType;
}

@Processor(SELF_EXCLUSION_QUEUE_NAME)
@Injectable()
export class SelfExclusionProcessor extends WorkerHost {
  private readonly logger = new Logger(SelfExclusionProcessor.name);

  constructor(private readonly selfExclusionService: SelfExclusionService) {
    super();
  }

  async process(job: Job<ISelfExclusionJobData>): Promise<void> {
    this.logger.log(`Processing self-exclusion job: ${job.data.type}`);

    try {
      switch (job.data.type) {
        case SelfExclusionJobType.EXPIRE_OUTDATED:
          await this.selfExclusionService.expireOutdatedSelfExclusions();
          this.logger.log(`Processed self-exclusion expiration job successfully`);
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.data.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process job ${job.data.type}:`, error);
      throw error; // Re-throw to trigger BullMQ retry logic
    }
  }
}
