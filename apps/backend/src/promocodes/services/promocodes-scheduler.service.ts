import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { PromocodeEntity, PromocodeStatusEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class PromocodesSchedulerService {
  private readonly logger = new Logger(PromocodesSchedulerService.name);

  constructor(
    @InjectRepository(PromocodeEntity)
    private readonly promocodeRepository: Repository<PromocodeEntity>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expirePromocodes(): Promise<void> {
    this.logger.log('Starting promocode expiration check...');

    try {
      const now = new Date();

      const result = await this.promocodeRepository
        .createQueryBuilder()
        .update(PromocodeEntity)
        .set({ status: PromocodeStatusEnum.EXPIRED })
        .where('status = :status', { status: PromocodeStatusEnum.ACTIVE })
        .andWhere('ends_at < :now', { now })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Expired ${result.affected} promocodes`);
      } else {
        this.logger.log('No promocodes to expire');
      }
    } catch (error) {
      this.logger.error('Error during promocode expiration check', error);
    }
  }
}
