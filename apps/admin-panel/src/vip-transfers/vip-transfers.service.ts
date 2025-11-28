import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  UserVipStatusEntity,
  VipTransferSubmissionEntity,
  VipTransferTagEnum,
} from '@zetik/shared-entities';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { GetVipTransfersQueryDto } from './dto/get-vip-transfers-query.dto';
import { UpdateVipTransferNoteDto } from './dto/update-vip-transfer-note.dto';
import { UpdateVipTransferTagDto } from './dto/update-vip-transfer-tag.dto';

export interface IVipTransferSubmissionResponse {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  name: string;
  country: string;
  contactMethod: string;
  contactUsername: string;
  casino: string;
  casinoUsername: string;
  totalWager: string;
  rank: string;
  howDidYouHear?: string;
  tag?: VipTransferTagEnum;
  customNote?: string;
  taggedByAdminId?: string;
  taggedByAdmin?: {
    id: string;
    name: string;
    email: string;
  };
  taggedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVipTransfersResult {
  submissions: IVipTransferSubmissionResponse[];
  total: number;
}

@Injectable()
export class VipTransfersService {
  constructor(
    @InjectRepository(VipTransferSubmissionEntity)
    private readonly vipTransferRepo: Repository<VipTransferSubmissionEntity>,
    @InjectRepository(UserVipStatusEntity)
    private readonly userVipStatusRepo: Repository<UserVipStatusEntity>,
  ) {}

  async findAll(dto: GetVipTransfersQueryDto): Promise<IVipTransfersResult> {
    const queryBuilder = this.vipTransferRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.user', 'user')
      .leftJoinAndSelect('submission.taggedByAdmin', 'taggedByAdmin');

    this.applyFilters(queryBuilder, dto);

    const limit = dto.limit || 20;
    const page = dto.page || 1;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit).orderBy('submission.createdAt', 'DESC');

    const [submissions, total] = await queryBuilder.getManyAndCount();

    const result: IVipTransferSubmissionResponse[] = submissions.map((submission) => ({
      id: submission.id,
      userId: submission.userId,
      user: submission.user
        ? {
            id: submission.user.id,
            username: submission.user.username,
            email: submission.user.email,
          }
        : undefined,
      name: submission.name,
      country: submission.country,
      contactMethod: submission.contactMethod,
      contactUsername: submission.contactUsername,
      casino: submission.casino,
      casinoUsername: submission.casinoUsername,
      totalWager: submission.totalWager,
      rank: submission.rank,
      howDidYouHear: submission.howDidYouHear,
      tag: submission.tag,
      customNote: submission.customNote,
      taggedByAdminId: submission.taggedByAdminId,
      taggedByAdmin: submission.taggedByAdmin
        ? {
            id: submission.taggedByAdmin.id,
            name: submission.taggedByAdmin.name,
            email: submission.taggedByAdmin.email,
          }
        : undefined,
      taggedAt: submission.taggedAt,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    }));

    return {
      submissions: result,
      total,
    };
  }

  async updateTag(
    id: string,
    adminId: string,
    dto: UpdateVipTransferTagDto,
  ): Promise<VipTransferSubmissionEntity> {
    const submission = await this.vipTransferRepo.findOne({ where: { id } });

    if (!submission) {
      throw new NotFoundException(`VIP Transfer submission with ID ${id} not found`);
    }

    submission.tag = dto.tag;
    submission.taggedByAdminId = adminId;
    submission.taggedAt = new Date();

    // If tag is Approved and vipLevel is provided, update user's VIP level
    if (dto.tag === VipTransferTagEnum.APPROVED && dto.vipLevel !== undefined) {
      const userVipStatus = await this.userVipStatusRepo.findOne({
        where: { userId: submission.userId },
      });

      if (!userVipStatus) {
        // Create new VIP status if it doesn't exist
        const newVipStatus = this.userVipStatusRepo.create({
          userId: submission.userId,
          currentVipLevel: dto.vipLevel,
          previousVipLevel: 0,
          currentWager: '0',
        });
        await this.userVipStatusRepo.save(newVipStatus);
      } else {
        // Update existing VIP status
        const previousLevel = userVipStatus.currentVipLevel;
        userVipStatus.currentVipLevel = dto.vipLevel;
        userVipStatus.previousVipLevel = previousLevel;
        await this.userVipStatusRepo.save(userVipStatus);
      }
    }

    return this.vipTransferRepo.save(submission);
  }

  async updateNote(
    id: string,
    adminId: string,
    dto: UpdateVipTransferNoteDto,
  ): Promise<VipTransferSubmissionEntity> {
    const submission = await this.vipTransferRepo.findOne({ where: { id } });

    if (!submission) {
      throw new NotFoundException(`VIP Transfer submission with ID ${id} not found`);
    }

    submission.customNote = dto.customNote;
    if (!submission.taggedByAdminId) {
      submission.taggedByAdminId = adminId;
      submission.taggedAt = new Date();
    }

    return this.vipTransferRepo.save(submission);
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<VipTransferSubmissionEntity>,
    dto: GetVipTransfersQueryDto,
  ): void {
    if (dto.tag) {
      queryBuilder.andWhere('submission.tag = :tag', { tag: dto.tag });
    }

    if (dto.casino) {
      queryBuilder.andWhere('submission.casino = :casino', { casino: dto.casino });
    }

    if (dto.userId) {
      queryBuilder.andWhere('submission.userId = :userId', { userId: dto.userId });
    }

    if (dto.startDate) {
      queryBuilder.andWhere('submission.createdAt >= :startDate', { startDate: dto.startDate });
    }

    if (dto.endDate) {
      queryBuilder.andWhere('submission.createdAt <= :endDate', { endDate: dto.endDate });
    }
  }
}
