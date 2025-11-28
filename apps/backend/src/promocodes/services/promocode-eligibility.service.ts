import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  BonusVipTierEntity,
  PromocodeClaimEntity,
  PromocodeEntity,
  UserEntity,
  UserVerificationEntity,
  UserVipStatusEntity,
  VerificationLevel,
  VerificationStatus,
} from '@zetik/shared-entities';
import { createHash } from 'crypto';
import * as geoip from 'geoip-lite';
import { Repository } from 'typeorm';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

@Injectable()
export class PromocodeEligibilityService {
  private readonly logger = new Logger(PromocodeEligibilityService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserVipStatusEntity)
    private readonly userVipStatusRepository: Repository<UserVipStatusEntity>,
    @InjectRepository(BonusVipTierEntity)
    private readonly bonusVipTierRepository: Repository<BonusVipTierEntity>,
    @InjectRepository(UserVerificationEntity)
    private readonly userVerificationRepository: Repository<UserVerificationEntity>,
    @InjectRepository(AffiliateCampaignEntity)
    private readonly affiliateCampaignRepository: Repository<AffiliateCampaignEntity>,
    @InjectRepository(PromocodeClaimEntity)
    private readonly promocodeClaimRepository: Repository<PromocodeClaimEntity>,
  ) {}

  async checkEligibility(
    userId: string,
    promocode: PromocodeEntity,
    ipAddress: string,
    userAgent: string,
  ): Promise<EligibilityResult> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        return {
          eligible: false,
          reason: 'User not found',
        };
      }

      const rules = promocode.eligibilityRules || {};

      if (rules.minRank !== undefined) {
        const vipStatus = await this.userVipStatusRepository.findOne({
          where: { userId },
          relations: ['currentBonusVipTier'],
        });

        const userRank = vipStatus?.currentVipLevel || 0;
        if (userRank < rules.minRank) {
          // Getting the required tier name to show in the error message
          const requiredTier = await this.bonusVipTierRepository.findOne({
            where: { level: rules.minRank },
          });

          const requiredTierName = requiredTier?.name || `Level ${rules.minRank}`;

          return {
            eligible: false,
            reason: `Minimum VIP rank "${requiredTierName}" required`,
          };
        }
      }

      if (rules.requireKyc) {
        const userVerification = await this.userVerificationRepository.findOne({
          where: { userId },
        });

        if (!userVerification || userVerification.status !== VerificationStatus.APPROVED) {
          return {
            eligible: false,
            reason: 'Verification required',
          };
        }

        if (rules.minKycLevel) {
          if (!this.isKycLevelSufficient(userVerification.level, rules.minKycLevel)) {
            return {
              eligible: false,
              reason: `Minimum verification level ${rules.minKycLevel} required`,
            };
          }
        }
      }
      if (rules.allowedCountries || rules.excludedCountries) {
        const userCountry = this.getUserCountry(ipAddress);

        if (userCountry) {
          if (rules.allowedCountries && rules.allowedCountries.length > 0) {
            if (!rules.allowedCountries.includes(userCountry)) {
              return {
                eligible: false,
                reason: `Country ${userCountry} not allowed`,
              };
            }
          }

          if (rules.excludedCountries && rules.excludedCountries.length > 0) {
            if (rules.excludedCountries.includes(userCountry)) {
              return {
                eligible: false,
                reason: `Country ${userCountry} is excluded`,
              };
            }
          }
        } else {
          return {
            eligible: false,
            reason: 'Failed to get user country',
          };
        }
      }

      if (rules.referralCodes && rules.referralCodes.length > 0) {
        if (!user.affiliateCampaignId) {
          return {
            eligible: false,
            reason: 'Referral code required',
          };
        }

        const affiliateCampaign = await this.affiliateCampaignRepository.findOne({
          where: { id: user.affiliateCampaignId },
        });

        if (!affiliateCampaign || !rules.referralCodes.includes(affiliateCampaign.code)) {
          return {
            eligible: false,
            reason: 'Invalid referral code',
          };
        }
      }

      if (rules.accountCreatedBefore) {
        const beforeDate = new Date(rules.accountCreatedBefore);
        if (user.createdAt > beforeDate) {
          return {
            eligible: false,
            reason: 'Account created too recently',
          };
        }
      }

      const userClaimCount = await this.promocodeClaimRepository.count({
        where: {
          promocodeId: promocode.id,
          userId,
        },
      });

      const perUserLimit = promocode.eligibilityRules?.perUserLimit || 1;
      if (userClaimCount >= perUserLimit) {
        return {
          eligible: false,
          reason: `User has already claimed this promocode ${perUserLimit} time(s)`,
        };
      }

      if (promocode.eligibilityRules?.onePerDevice || promocode.eligibilityRules?.onePerIp) {
        const deviceFingerprint = this.getDeviceFingerprint(userAgent);

        const existingClaim = await this.promocodeClaimRepository.findOne({
          where: [
            ...(promocode.eligibilityRules.onePerDevice ? [{ deviceFingerprint }] : []),
            ...(promocode.eligibilityRules.onePerIp ? [{ ipAddress }] : []),
          ],
        });

        if (existingClaim) {
          return {
            eligible: false,
            reason: 'This device/IP has already claimed this promocode',
          };
        }
      }

      return { eligible: true };
    } catch (error) {
      this.logger.error('Error checking promocode eligibility', error);
      return {
        eligible: false,
        reason: 'Internal error during eligibility check',
      };
    }
  }

  private getUserCountry(ipAddress: string): string | null {
    try {
      const geo = geoip.lookup(ipAddress);
      return geo?.country || null;
    } catch (error) {
      this.logger.warn('Failed to get IP geolocation', error);
      return null;
    }
  }

  private isKycLevelSufficient(
    userLevel: VerificationLevel,
    requiredLevel: VerificationLevel,
  ): boolean {
    const levelHierarchy = {
      [VerificationLevel.LEVEL_1_EMAIL]: 1,
      [VerificationLevel.LEVEL_2_BASIC_INFO]: 2,
      [VerificationLevel.LEVEL_3_IDENTITY]: 3,
    };

    const userLevelNum = levelHierarchy[userLevel] || 0;
    const requiredLevelNum = levelHierarchy[requiredLevel] || 0;

    return userLevelNum >= requiredLevelNum;
  }

  getDeviceFingerprint(userAgent: string): string {
    return createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  }
}
