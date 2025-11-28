import { Injectable, Logger } from '@nestjs/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { FireblocksService } from '../../payments/fireblocks/fireblocks.service';

interface ICachedPrice {
  price: number;
  timestamp: number;
}

@Injectable()
export class FireblocksRateService {
  private readonly logger = new Logger(FireblocksRateService.name);
  private readonly priceCache = new Map<AssetTypeEnum, ICachedPrice>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly fireblocksService: FireblocksService) {}

  getAssetPrice(asset: AssetTypeEnum): number | null {
    const cached = this.priceCache.get(asset);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug(`Using cached price for ${asset}: $${cached.price}`);
      return cached.price;
    }

    // For now, return null since Fireblocks doesn't have a direct price API
    // This could be replaced with your price source of choice
    this.logger.debug(`No cached price available for ${asset}`);
    return null;
  }

  setAssetPrice(asset: AssetTypeEnum, price: number): void {
    try {
      // Cache the price
      this.priceCache.set(asset, {
        price,
        timestamp: Date.now(),
      });

      // Try to set in Fireblocks (if supported)
      const fireblocksAssetId = this.getFireblocksAssetId(asset);
      if (fireblocksAssetId) {
        this.fireblocksService.setAssetPrice(fireblocksAssetId, price);
      }

      this.logger.debug(`Set and cached price for ${asset}: $${price}`);
    } catch (err) {
      this.logger.warn(`Failed to set price for ${asset}`, err);
    }
  }

  getAllCachedPrices(): Record<string, number> {
    const prices: Record<string, number> = {};
    const now = Date.now();

    for (const [asset, cachedPrice] of this.priceCache.entries()) {
      if (now - cachedPrice.timestamp < this.CACHE_TTL_MS) {
        prices[asset] = cachedPrice.price;
      }
    }

    return prices;
  }

  clearCache(): void {
    this.priceCache.clear();
    this.logger.debug('Cleared price cache');
  }

  private getFireblocksAssetId(asset: AssetTypeEnum): string | null {
    const assetMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'BTC',
      [AssetTypeEnum.ETH]: 'ETH',
      [AssetTypeEnum.USDC]: 'USDC',
      [AssetTypeEnum.USDT]: 'USDT',
      [AssetTypeEnum.LTC]: 'LTC',
      [AssetTypeEnum.DOGE]: 'DOGE',
      [AssetTypeEnum.TRX]: 'TRX',
      [AssetTypeEnum.XRP]: 'XRP',
      [AssetTypeEnum.SOL]: 'SOL',
    };

    return assetMap[asset] || null;
  }
}
