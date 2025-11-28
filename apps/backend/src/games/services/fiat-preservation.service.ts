import { Injectable, Logger } from '@nestjs/common';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, UserEntity } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { FiatRateService } from '../../balance/services/fiat-rate.service';

export interface FiatPreservationData {
  originalFiatAmount?: string;
  originalFiatCurrency?: CurrencyEnum;
  fiatToUsdRate?: string;
}

/**
 * Shared service for preserving fiat currency data across all games
 * Ensures consistent handling of fiat-to-crypto conversion precision issues
 */
@Injectable()
export class FiatPreservationService {
  private readonly logger = new Logger(FiatPreservationService.name);

  constructor(
    private readonly fiatRateService: FiatRateService,
    private readonly cryptoConverterService: CryptoConverterService,
  ) {}

  /**
   * Extracts and calculates fiat preservation data from user input
   * This preserves the exact user input to prevent precision loss in display
   *
   * @param user User entity with currency preference
   * @param originalFiatAmount The exact fiat amount user entered (from DTO)
   * @param betAmount The crypto bet amount after conversion
   * @param primaryAsset The crypto asset being used for the bet
   * @returns Fiat preservation data for storing in user_bets
   */
  /**
   * Validates the provided originalFiatAmount against calculated value to prevent manipulation
   *
   * @param user User entity with currency preference
   * @param originalFiatAmount The fiat amount provided by frontend
   * @param betAmount The crypto bet amount after conversion
   * @param primaryAsset The crypto asset being used for the bet
   * @returns Validated fiat amount (uses calculated value if manipulation detected)
   */
  validateAndGetFiatAmount(
    user: UserEntity,
    originalFiatAmount: string | undefined,
    betAmount: string,
    primaryAsset: AssetTypeEnum,
  ): string | undefined {
    return this.validateAndGetFiatAmountByCurrency(
      user.currentCurrency,
      user.id,
      originalFiatAmount,
      betAmount,
      primaryAsset,
    );
  }

  validateAndGetFiatAmountByCurrency(
    currency: CurrencyEnum,
    userId: string,
    originalFiatAmount: string | undefined,
    betAmount: string,
    primaryAsset: AssetTypeEnum,
  ): string | undefined {
    if (!originalFiatAmount || currency === CurrencyEnum.USD) {
      // Always remove formatting from the amount, even for early returns
      return originalFiatAmount ? originalFiatAmount.replace(/,/g, '') : originalFiatAmount;
    }

    const rate = this.fiatRateService.getCurrentRate(currency);
    if (!rate) {
      return originalFiatAmount.replace(/,/g, '');
    }

    try {
      const cryptoRate = parseFloat(this.cryptoConverterService.getRate(primaryAsset));
      const betAmountBN = new BigNumber(betAmount);
      const usdAmount = betAmountBN.multipliedBy(cryptoRate);
      const calculatedFiatAmount = usdAmount.multipliedBy(rate);
      // Remove comma formatting before parsing to handle formatted input like "3,000.00"
      const cleanedOriginalAmount = originalFiatAmount.replace(/,/g, '');
      const providedFiatAmount = new BigNumber(cleanedOriginalAmount);

      // Allow 0.1% tolerance for exchange rate variations and rounding differences
      const tolerance = calculatedFiatAmount.multipliedBy(0.001);
      const difference = calculatedFiatAmount.minus(providedFiatAmount).abs();

      if (difference.isGreaterThan(tolerance)) {
        this.logger.warn(`Suspicious originalFiatAmount provided`, {
          userId,
          provided: originalFiatAmount,
          calculated: calculatedFiatAmount.toFixed(2),
          difference: difference.toFixed(2),
          tolerance: tolerance.toFixed(2),
          currency,
          asset: primaryAsset,
        });
        // Use calculated value instead of provided value to prevent manipulation
        return calculatedFiatAmount.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      }

      // Always return unformatted amount for database storage
      return cleanedOriginalAmount;
    } catch (error) {
      this.logger.error('Error validating original fiat amount:', error);
      // Return unformatted value on validation error
      return originalFiatAmount.replace(/,/g, '');
    }
  }

  extractFiatPreservationData(
    user: UserEntity,
    originalFiatAmount: string | undefined,
    betAmount: string,
    primaryAsset: AssetTypeEnum,
  ): FiatPreservationData {
    // Only preserve fiat data for non-USD currencies
    if (user.currentCurrency === CurrencyEnum.USD) {
      return {};
    }

    const originalFiatCurrency = user.currentCurrency;

    // Get the current exchange rate (fiat units per 1 USD)
    const rate = this.fiatRateService.getCurrentRate(originalFiatCurrency);
    if (!rate) {
      this.logger.warn(`No exchange rate found for currency: ${originalFiatCurrency}`);
      return {};
    }

    const fiatToUsdRate = rate.toString();

    let preservedFiatAmount: string;

    if (originalFiatAmount) {
      // Use the preserved original fiat amount directly (remove commas for consistency)
      preservedFiatAmount = originalFiatAmount.replace(/,/g, '');

      this.logger.debug('Using preserved original fiat amount', {
        originalFiatAmount,
        preservedAmount: preservedFiatAmount,
        currency: originalFiatCurrency,
      });
    } else {
      // Fallback: reverse calculate from crypto amount (will have precision issues)
      try {
        const cryptoRate = parseFloat(this.cryptoConverterService.getRate(primaryAsset));
        const betAmountBN = new BigNumber(betAmount);
        const usdAmount = betAmountBN.multipliedBy(cryptoRate);
        const fiatAmount = usdAmount.multipliedBy(rate);

        // Round down to 2 decimal places for house-favorable display
        preservedFiatAmount = fiatAmount.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();

        this.logger.debug('Calculated original fiat amount from crypto', {
          betAmount,
          cryptoRate,
          fiatAmount: preservedFiatAmount,
          currency: originalFiatCurrency,
        });
      } catch (error) {
        this.logger.error('Error calculating original fiat amount:', error);
        return {};
      }
    }

    return {
      originalFiatAmount: preservedFiatAmount,
      originalFiatCurrency,
      fiatToUsdRate,
    };
  }

  /**
   * Calculates the original fiat amount for payout display
   * Uses the stored exchange rate to maintain consistency
   *
   * @param cryptoPayout The payout amount in crypto
   * @param primaryAsset The crypto asset
   * @param preservationData The stored fiat preservation data
   * @returns Calculated fiat payout amount
   */
  calculateFiatPayout(
    cryptoPayout: string,
    primaryAsset: AssetTypeEnum,
    preservationData: FiatPreservationData,
  ): string | undefined {
    if (!preservationData.originalFiatCurrency || !preservationData.fiatToUsdRate) {
      return undefined;
    }

    try {
      const cryptoRate = parseFloat(this.cryptoConverterService.getRate(primaryAsset));
      const payoutBN = new BigNumber(cryptoPayout);
      const usdAmount = payoutBN.multipliedBy(cryptoRate);
      const fiatAmount = usdAmount.multipliedBy(preservationData.fiatToUsdRate);

      // Round down to 2 decimal places for house-favorable display
      return fiatAmount.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
    } catch (error) {
      this.logger.error('Error calculating fiat payout:', error);
      return undefined;
    }
  }
}
