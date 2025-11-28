import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BonusVipTierEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UpdateVipTierDto } from './dto/update-vip-tier.dto';
import { VipTierResponseDto } from './dto/vip-tier-response.dto';

@Injectable()
export class VipTiersService {
  constructor(
    @InjectRepository(BonusVipTierEntity)
    private readonly vipTierRepository: Repository<BonusVipTierEntity>,
  ) {}

  /**
   * Convert dollars to cents for backend storage
   */
  private dollarsToCents(dollars: string): string {
    const amount = parseFloat(dollars);
    return Math.round(amount * 100).toString();
  }

  /**
   * Convert cents to dollars for frontend display
   */
  private centsToDollars(cents: string): string {
    const amount = parseFloat(cents);
    return (amount / 100).toFixed(2);
  }

  async findAllTiers(): Promise<VipTierResponseDto[]> {
    const tiers = await this.vipTierRepository.find({
      order: { level: 'ASC' },
    });

    return tiers.map((tier) => ({
      level: tier.level,
      name: tier.name,
      description: tier.description,
      isForVip: tier.isForVip,
      imageUrl: tier.imageUrl,
      wagerRequirement: this.centsToDollars(tier.wagerRequirement),
      levelUpBonusAmount: tier.levelUpBonusAmount
        ? this.centsToDollars(tier.levelUpBonusAmount)
        : tier.levelUpBonusAmount,
      rakebackPercentage: tier.rakebackPercentage,
      weeklyBonusPercentage: tier.weeklyBonusPercentage,
      monthlyBonusPercentage: tier.monthlyBonusPercentage,
      weeklyReloadProfitablePercentage: tier.weeklyReloadProfitablePercentage,
      weeklyReloadLosingPercentage: tier.weeklyReloadLosingPercentage,
      weeklyReloadDailyMin: tier.weeklyReloadDailyMinCents
        ? this.centsToDollars(tier.weeklyReloadDailyMinCents)
        : undefined,
      rankUpBonusAmount: tier.rankUpBonusAmount
        ? this.centsToDollars(tier.rankUpBonusAmount)
        : tier.rankUpBonusAmount,
      createdBy: tier.createdBy,
      updatedBy: tier.updatedBy,
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
    }));
  }

  async updateTier(
    level: number,
    dto: UpdateVipTierDto,
    adminId: string,
  ): Promise<VipTierResponseDto> {
    const tier = await this.vipTierRepository.findOne({ where: { level } });
    if (!tier) {
      throw new NotFoundException('VIP Tier not found');
    }

    // Convert dollars to cents for backend storage
    const updateData: Partial<BonusVipTierEntity> = {
      name: dto.name,
      description: dto.description,
      isForVip: dto.isForVip,
      imageUrl: dto.imageUrl,
      wagerRequirement: dto.wagerRequirement
        ? this.dollarsToCents(dto.wagerRequirement)
        : undefined,
      levelUpBonusAmount: dto.levelUpBonusAmount
        ? this.dollarsToCents(dto.levelUpBonusAmount)
        : dto.levelUpBonusAmount,
      rakebackPercentage: dto.rakebackPercentage,
      rankUpBonusAmount: dto.rankUpBonusAmount
        ? this.dollarsToCents(dto.rankUpBonusAmount)
        : dto.rankUpBonusAmount,
      weeklyBonusPercentage: dto.weeklyBonusPercentage,
      monthlyBonusPercentage: dto.monthlyBonusPercentage,
      weeklyReloadProfitablePercentage: dto.weeklyReloadProfitablePercentage,
      weeklyReloadLosingPercentage: dto.weeklyReloadLosingPercentage,
      weeklyReloadDailyMinCents: dto.weeklyReloadDailyMin
        ? this.dollarsToCents(dto.weeklyReloadDailyMin)
        : undefined,
      updatedBy: adminId,
      updatedAt: new Date(),
    };

    await this.vipTierRepository.update({ level }, updateData);

    const updated = await this.vipTierRepository.findOne({ where: { level } });
    return {
      level: updated!.level,
      name: updated!.name,
      description: updated!.description,
      isForVip: updated!.isForVip,
      imageUrl: updated!.imageUrl,
      wagerRequirement: this.centsToDollars(updated!.wagerRequirement),
      levelUpBonusAmount: updated!.levelUpBonusAmount
        ? this.centsToDollars(updated!.levelUpBonusAmount)
        : updated!.levelUpBonusAmount,
      rakebackPercentage: updated!.rakebackPercentage,
      weeklyBonusPercentage: updated!.weeklyBonusPercentage,
      monthlyBonusPercentage: updated!.monthlyBonusPercentage,
      weeklyReloadProfitablePercentage: updated!.weeklyReloadProfitablePercentage,
      weeklyReloadLosingPercentage: updated!.weeklyReloadLosingPercentage,
      weeklyReloadDailyMin: updated!.weeklyReloadDailyMinCents
        ? this.centsToDollars(updated!.weeklyReloadDailyMinCents)
        : undefined,
      rankUpBonusAmount: updated!.rankUpBonusAmount
        ? this.centsToDollars(updated!.rankUpBonusAmount)
        : updated!.rankUpBonusAmount,
      createdBy: updated!.createdBy,
      updatedBy: updated!.updatedBy,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
    };
  }

  async cancelBonus(
    bonusId: string,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Call backend API to cancel bonus
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/v1/bonus/admin/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bonusId,
          adminId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        message: `Bonus ${bonusId} has been cancelled successfully`,
      };
    } catch (error) {
      console.error('Failed to cancel bonus:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to cancel bonus',
      );
    }
  }
}
