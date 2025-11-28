import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BalanceOperationEnum,
  PromocodeClaimEntity,
  PromocodeEntity,
  PromocodeStatusEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { PromocodeResponseDto } from '../dto/promocode-response.dto';
import { PromocodeEligibilityService } from './promocode-eligibility.service';

@Injectable()
export class PromocodesService {
  private readonly logger = new Logger(PromocodesService.name);

  constructor(
    private readonly eligibilityService: PromocodeEligibilityService,
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async redeemPromocode(
    userId: string,
    code: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<PromocodeResponseDto> {
    const trimmedCode = code.trim().toLowerCase();

    if (!trimmedCode) {
      throw new BadRequestException('Promocode cannot be empty');
    }

    const promocode = await this.dataSource.manager.findOne(PromocodeEntity, {
      where: { code: trimmedCode },
    });

    if (!promocode) {
      throw new BadRequestException('Promocode not found');
    }

    const lockResource = LockKeyBuilder.promocodeClaim(promocode.id);

    return await this.distributedLockService.withLock(
      lockResource,
      LockTTL.STANDARD_OPERATION,
      async () => {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const lockedPromocode = await queryRunner.manager.findOne(PromocodeEntity, {
            where: { code: trimmedCode },
            lock: { mode: 'pessimistic_write' },
          });

          if (!lockedPromocode) {
            throw new BadRequestException('Promocode not found');
          }

          if (lockedPromocode.status !== PromocodeStatusEnum.ACTIVE) {
            throw new BadRequestException(`Promocode is ${lockedPromocode.status.toLowerCase()}`);
          }

          const now = new Date();

          if (now < lockedPromocode.startsAt) {
            throw new BadRequestException('Promocode is not yet active');
          }

          if (now > lockedPromocode.endsAt) {
            throw new BadRequestException('Promocode has expired');
          }

          if (lockedPromocode.claimedCount >= lockedPromocode.totalClaims) {
            throw new BadRequestException('Promocode has no remaining claims');
          }

          const eligibilityResult = await this.eligibilityService.checkEligibility(
            userId,
            lockedPromocode,
            ipAddress,
            userAgent,
          );

          if (!eligibilityResult.eligible) {
            throw new BadRequestException(
              eligibilityResult.reason || 'User not eligible for this promocode',
            );
          }

          const claimId = randomUUID();
          const deviceFingerprint = this.getDeviceFingerprint(userAgent);

          const claim = queryRunner.manager.create(PromocodeClaimEntity, {
            id: claimId,
            promocodeId: lockedPromocode.id,
            userId,
            amount: lockedPromocode.valuePerClaim,
            asset: lockedPromocode.asset,
            ipAddress,
            deviceFingerprint,
            userAgent,
            balanceOperationId: randomUUID(),
            metadata: {
              promocodeCode: lockedPromocode.code,
              userVipLevel: 0,
              userCountry: 'unknown',
              userKycLevel: 'NONE',
              accountAge: 0,
            },
          });

          await this.balanceService.updateBalance({
            operation: BalanceOperationEnum.PROMOCODE,
            operationId: claimId,
            userId,
            amount: new BigNumber(lockedPromocode.valuePerClaim),
            asset: lockedPromocode.asset,
            description: `Promocode redemption: ${lockedPromocode.code}`,
            metadata: {
              promocodeCode: lockedPromocode.code,
            },
          });

          await queryRunner.manager.save(claim);

          lockedPromocode.claimedCount += 1;

          if (lockedPromocode.claimedCount >= lockedPromocode.totalClaims) {
            lockedPromocode.status = PromocodeStatusEnum.EXPIRED;
          }

          await queryRunner.manager.save(lockedPromocode);

          await queryRunner.commitTransaction();

          this.logger.log(
            `User ${userId} successfully redeemed promocode ${lockedPromocode.code} for ${lockedPromocode.valuePerClaim} ${lockedPromocode.asset}`,
          );

          return {
            success: true,
            amount: lockedPromocode.valuePerClaim,
            asset: lockedPromocode.asset,
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          await queryRunner.release();
        }
      },
    );
  }

  getDeviceFingerprint(userAgent: string): string {
    return createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  }
}
