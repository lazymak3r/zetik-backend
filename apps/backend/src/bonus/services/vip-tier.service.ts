import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BonusVipTierEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { CreateVipTierDto } from '../dto/create-vip-tier.dto';
import { UpdateVipTierDto } from '../dto/update-vip-tier.dto';

@Injectable()
export class VipTierService {
  constructor(
    @InjectRepository(BonusVipTierEntity)
    private readonly vipTierRepo: Repository<BonusVipTierEntity>,
    @InjectRepository(UserVipStatusEntity)
    private readonly userVipStatusRepo: Repository<UserVipStatusEntity>,
  ) {}

  async findAllTiers(): Promise<BonusVipTierEntity[]> {
    return this.vipTierRepo.find({ order: { level: 'ASC' } });
  }

  async findTierByLevel(level: number): Promise<BonusVipTierEntity | null> {
    return this.vipTierRepo.findOne({ where: { level } });
  }

  async findNextTier(currentLevel: number): Promise<BonusVipTierEntity | null> {
    return this.vipTierRepo
      .createQueryBuilder('tier')
      .where('tier.level > :currentLevel', { currentLevel })
      .orderBy('tier.level', 'ASC')
      .limit(1)
      .getOne();
  }

  async createTier(dto: CreateVipTierDto, adminId: string): Promise<BonusVipTierEntity> {
    // Validation: cannot skip levels
    const maxLevel = await this.vipTierRepo
      .createQueryBuilder('tier')
      .select('MAX(tier.level)', 'maxLevel')
      .getRawOne();

    const currentMaxLevel = maxLevel?.maxLevel || 0;

    if (dto.level > currentMaxLevel + 1) {
      throw new BadRequestException(
        `Cannot skip levels. Current max level is ${currentMaxLevel}, you can only create level ${currentMaxLevel + 1}`,
      );
    }

    // Check level uniqueness
    const existingTier = await this.vipTierRepo.findOne({
      where: { level: dto.level },
    });

    if (existingTier) {
      throw new BadRequestException(`VIP tier with level ${dto.level} already exists`);
    }

    const tier = this.vipTierRepo.create({
      ...dto,
      createdBy: adminId,
    });

    return this.vipTierRepo.save(tier);
  }

  async updateTier(
    level: number,
    dto: UpdateVipTierDto,
    adminId: string,
  ): Promise<BonusVipTierEntity> {
    const tier = await this.vipTierRepo.findOne({ where: { level } });
    if (!tier) {
      throw new NotFoundException('VIP Tier not found');
    }

    // Cannot change level - only other fields
    // UpdateVipTierDto does not contain level field

    await this.vipTierRepo.update(
      { level },
      {
        ...dto,
        updatedBy: adminId,
      },
    );

    const updated = await this.vipTierRepo.findOne({ where: { level } });
    return updated!;
  }

  async deleteTier(level: number): Promise<void> {
    const tier = await this.vipTierRepo.findOne({ where: { level } });
    if (!tier) {
      throw new NotFoundException('VIP Tier not found');
    }

    // Cannot delete tier if there are users at this level
    const usersCount = await this.userVipStatusRepo.count({
      where: { currentVipLevel: tier.level },
    });

    if (usersCount > 0) {
      throw new BadRequestException(
        `Cannot delete tier with active users (${usersCount} users on level ${tier.level})`,
      );
    }

    // Cannot delete tier if it creates a gap in levels
    const maxLevel = await this.vipTierRepo
      .createQueryBuilder('tier')
      .select('MAX(tier.level)', 'maxLevel')
      .getRawOne();

    if (tier.level < maxLevel?.maxLevel) {
      throw new BadRequestException(
        `Cannot delete tier level ${tier.level}. This would create a gap in levels. Delete higher levels first.`,
      );
    }

    await this.vipTierRepo.delete({ level });
  }
}
