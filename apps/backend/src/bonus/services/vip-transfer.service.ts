import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VipTransferSubmissionEntity, VipTransferTagEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CreateVipTransferSubmissionDto } from '../dto/create-vip-transfer-submission.dto';

@Injectable()
export class VipTransferService {
  constructor(
    @InjectRepository(VipTransferSubmissionEntity)
    private readonly vipTransferRepo: Repository<VipTransferSubmissionEntity>,
  ) {}

  async create(
    userId: string,
    dto: CreateVipTransferSubmissionDto,
  ): Promise<VipTransferSubmissionEntity> {
    const submission = this.vipTransferRepo.create({
      userId,
      name: dto.name,
      country: dto.country,
      contactMethod: dto.contactMethod || 'telegram',
      contactUsername: dto.contactUsername,
      casino: dto.casino,
      casinoUsername: dto.casinoUsername,
      totalWager: dto.totalWager,
      rank: dto.rank,
      howDidYouHear: dto.howDidYouHear,
      tag: VipTransferTagEnum.NEW,
    });

    return this.vipTransferRepo.save(submission);
  }
}
