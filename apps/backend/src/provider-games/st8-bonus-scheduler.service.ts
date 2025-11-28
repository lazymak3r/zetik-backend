import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { St8BonusEntity, St8BonusStatusEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { St8BonusService } from './st8-bonus.service';

@Injectable()
export class St8BonusSchedulerService {
  private readonly logger = new Logger(St8BonusSchedulerService.name);

  constructor(
    @InjectRepository(St8BonusEntity)
    private readonly st8BonusRepository: Repository<St8BonusEntity>,
    private readonly st8BonusService: St8BonusService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkProcessingBonuses(): Promise<void> {
    try {
      const processingBonuses = await this.st8BonusRepository.find({
        where: {
          status: St8BonusStatusEnum.PROCESSING,
        },
      });

      if (processingBonuses.length > 0) {
        const BATCH_SIZE = 10;

        for (let i = 0; i < processingBonuses.length; i += BATCH_SIZE) {
          const batch = processingBonuses.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (bonus) => {
            try {
              await this.st8BonusService.updateBonusStatusFromSt8(bonus.bonus_id, bonus.site);
            } catch (error) {
              this.logger.error(`Failed to update bonus ${bonus.bonus_id}:`, error);
              try {
                await this.st8BonusRepository.update(
                  { bonus_id: bonus.bonus_id },
                  { status: St8BonusStatusEnum.ERROR },
                );
                this.logger.log(`Updated bonus ${bonus.bonus_id} status to ERROR`);
              } catch (updateError) {
                this.logger.error(
                  `Failed to update bonus ${bonus.bonus_id} status to ERROR:`,
                  updateError,
                );
              }
            }
          });

          await Promise.all(batchPromises);

          if (i + BATCH_SIZE < processingBonuses.length) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        }
      }
    } catch (error) {
      this.logger.error('Error during ST8 bonus processing check', error);
    }
  }
}
