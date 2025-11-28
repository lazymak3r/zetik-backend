import { Fireblocks } from '@fireblocks/ts-sdk';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  FireblocksException,
  extractFireblocksErrorDetails,
} from '../../common/utils/error-handler';
import { fireblocksConfig } from '../config/fireblocks.config';

// Constants for magic strings
export const FIREBLOCKS_ERROR_CONTEXTS = {
  ADDRESS_GENERATION: 'address_generation',
  CONNECTION_TEST: 'connection_test',
  PRICE_CACHING: 'price_caching',
} as const;

const ADDRESS_DESCRIPTION_PREFIX = 'Deposit address for';
const CUSTOMER_REF_ID_PREFIX = 'ref';

@Injectable()
export class FireblocksService implements OnModuleDestroy {
  private readonly logger = new Logger(FireblocksService.name);
  private readonly fireblocks: Fireblocks;
  private readonly vaultAccountId: string;
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    const config = fireblocksConfig();

    try {
      this.fireblocks = new Fireblocks({
        apiKey: config.apiKey,
        basePath: config.apiUrl,
        secretKey: config.apiSecret,
      });

      this.vaultAccountId = config.vaultAccountId;
      this.logger.debug(
        `Initialized Fireblocks SDK with new @fireblocks/ts-sdk - Vault Account ID: ${this.vaultAccountId}`,
      );

      // Start periodic cache cleanup to prevent memory leak
      this.cleanupInterval = setInterval(() => {
        this.cleanupCache();
      }, this.CACHE_TTL); // Run cleanup every 5 minutes
    } catch (error) {
      this.handleFireblocksError(error, 'sdk_initialization');
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Remove stale entries from price cache to prevent memory leak
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, value] of this.priceCache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.priceCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Cleaned up ${removedCount} stale price cache entries`);
    }
  }

  getFireblocksSDK(): Fireblocks {
    return this.fireblocks;
  }

  getVaultAccountId(): string {
    return this.vaultAccountId;
  }

  private handleFireblocksError(error: unknown, context: string): never {
    const errorDetails = extractFireblocksErrorDetails(error);

    this.logger.error(`Fireblocks error in ${context}:`, {
      message: errorDetails.message,
      code: errorDetails.code,
      status: errorDetails.status,
      context,
    });

    throw new FireblocksException(
      errorDetails.message,
      errorDetails.code,
      errorDetails.status,
      context,
    );
  }

  private generateCustomerRefId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9); // 7 chars
    return `${CUSTOMER_REF_ID_PREFIX}-${timestamp}-${randomSuffix}`;
  }

  // Helper method for address generation using new SDK
  async generateNewAddress(
    vaultAccountId: string,
    assetId: string,
    description?: string,
    customerRefId?: string,
  ): Promise<any> {
    try {
      const response = await this.fireblocks.vaults.createVaultAccountAssetAddress({
        vaultAccountId,
        assetId,
        createAddressRequest: {
          description: description || `${ADDRESS_DESCRIPTION_PREFIX} ${assetId}`,
          customerRefId: customerRefId || this.generateCustomerRefId(),
        },
      });
      return response.data;
    } catch (error) {
      this.handleFireblocksError(error, FIREBLOCKS_ERROR_CONTEXTS.ADDRESS_GENERATION);
    }
  }

  // Add simple test method from docs
  async testConnection(): Promise<boolean> {
    try {
      await this.fireblocks.vaults.getPagedVaultAccounts({
        limit: 1,
      });
      this.logger.log('Fireblocks connection test successful');
      return true;
    } catch (error) {
      this.handleFireblocksError(error, FIREBLOCKS_ERROR_CONTEXTS.CONNECTION_TEST);
    }
  }

  getAssetPrice(assetId: string): number | null {
    // Check cache first
    const cached = this.priceCache.get(assetId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    // Since Fireblocks doesn't provide direct price APIs,
    // this method returns null to indicate price should be fetched elsewhere
    this.logger.debug(`Price requested for ${assetId}, but Fireblocks has no direct price API`);
    return null;
  }

  setAssetPrice(assetId: string, price: number): boolean {
    try {
      // Cache the price locally for potential future use
      this.priceCache.set(assetId, { price, timestamp: Date.now() });
      this.logger.debug(`Cached price for ${assetId}: $${price}`);
      return true;
    } catch (error) {
      this.handleFireblocksError(error, FIREBLOCKS_ERROR_CONTEXTS.PRICE_CACHING);
    }
  }
}
