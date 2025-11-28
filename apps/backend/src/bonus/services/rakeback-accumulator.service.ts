import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import BigNumber from 'bignumber.js';
import { DataSource } from 'typeorm';

import { AssetTypeEnum } from '@zetik/shared-entities';

import { IBetConfirmedEventPayload } from '../interfaces/ibet-confirmed-event-payload.interface';
import { IBetRefundedEventPayload } from '../interfaces/ibet-refunded-event-payload.interface';

/**
 * Service responsible for accumulating house side amounts from bets for rakeback calculation
 */
@Injectable()
export class RakebackAccumulatorService {
  private readonly logger = new Logger(RakebackAccumulatorService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Validate that asset is supported
   */
  private validateAsset(asset: string): boolean {
    return Object.values(AssetTypeEnum).includes(asset as AssetTypeEnum);
  }

  /**
   * Handle bet.confirmed event to accumulate house side for rakeback calculation
   */
  @OnEvent('bet.confirmed')
  async handleBetConfirmed(payload: IBetConfirmedEventPayload): Promise<void> {
    const { userId, betAmount, asset } = payload;

    try {
      // Validate asset before processing
      if (!this.validateAsset(asset)) {
        this.logger.warn(`Unsupported asset for rakeback: ${asset}`, { userId });
        return;
      }

      // Get house edge from payload or use default
      const houseEdge = payload.houseEdge || 1;

      // Skip if no bet amount (refunds, bonuses, etc.)
      if (!houseEdge || houseEdge <= 0 || betAmount === '0') {
        return;
      }

      // Calculate house side: betAmount × house edge (in native asset)
      // betAmount is now in native asset (e.g., BTC) not cents
      const betAmountBN = new BigNumber(betAmount || '0');
      const houseSideAmount = betAmountBN
        .multipliedBy(houseEdge / 100)
        .decimalPlaces(8, BigNumber.ROUND_DOWN); // Round down in favor of casino

      if (houseSideAmount.isGreaterThan(0)) {
        await this.addHouseSide(userId, asset, houseSideAmount.toString());
      }
    } catch (error: any) {
      this.logger.error(`Failed to process house side for rakeback: ${error.message}`, {
        userId,
        betAmount,
        asset,
        error: error.stack,
      });
      // Don't throw - rakeback failure shouldn't block bet processing
    }
  }

  /**
   * Handle bet.refunded event to reverse accumulated house side
   */
  @OnEvent('bet.refunded')
  async handleBetRefunded(payload: IBetRefundedEventPayload): Promise<void> {
    const { userId, refundAmount, asset } = payload;

    try {
      // Validate asset before processing
      if (!this.validateAsset(asset)) {
        this.logger.warn(`Unsupported asset for rakeback refund: ${asset}`, { userId });
        return;
      }

      // Skip if no refund amount
      if (!refundAmount || refundAmount === '0') {
        return;
      }

      // Calculate negative house side to reverse: refundAmount × (1% house edge)
      // Use fixed 1% for refund reversal (matches commission reversal logic)
      const refundAmountBN = new BigNumber(refundAmount || '0');
      const negativeHouseSide = refundAmountBN
        .multipliedBy(-1 / 100) // Negative to reverse
        .decimalPlaces(8, BigNumber.ROUND_UP); // Round up (negative, so down in absolute value)

      if (negativeHouseSide.isLessThan(0)) {
        await this.addHouseSide(userId, asset, negativeHouseSide.toString());
      }
    } catch (error: any) {
      this.logger.error(`Failed to reverse house side for rakeback refund: ${error.message}`, {
        userId,
        refundAmount,
        asset,
        error: error.stack,
      });
      // Don't throw - rakeback failure shouldn't block refund processing
    }
  }

  /**
   * Add house side amount to user's accumulated house side for rakeback calculation
   * Uses PostgreSQL UPSERT to handle race conditions
   */
  async addHouseSide(userId: string, asset: string, houseSideAmount: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Use PostgreSQL UPSERT to avoid race conditions
      await queryRunner.query(
        `
        INSERT INTO "balance"."rakeback" ("userId", "asset", "accumulatedHouseSideAmount", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT ("userId", "asset")
        DO UPDATE SET
          "accumulatedHouseSideAmount" = (
            SELECT (COALESCE("balance"."rakeback"."accumulatedHouseSideAmount", 0) + $3)::decimal(18,8)
          ),
          "updatedAt" = NOW()
        `,
        [userId, asset, houseSideAmount],
      );
    } finally {
      await queryRunner.release();
    }
  }
}
