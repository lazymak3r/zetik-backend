/* @noflow */
import { CreateAddressResponse, CreateVaultAssetResponse } from '@fireblocks/ts-sdk';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  TransactionEntity,
  TransactionStatusEnum,
  TransactionTypeEnum,
  UserEntity,
  WalletEntity,
  WithdrawRequestEntity,
  WithdrawStatusEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { instanceToPlain } from 'class-transformer';
import { randomUUID } from 'crypto';
import { QRCodeToStringOptions, toString as qrToSvgRaw } from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { CryptoConverterService } from '../balance/services/crypto-converter.service';
import { FiatRateService } from '../balance/services/fiat-rate.service';
import { LockTTL } from '../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../common/services/distributed-lock.service';
import { FeeCacheService } from '../common/services/fee-cache.service';
import { LockKeyBuilder } from '../common/utils/lock-key-builder';
import { EmailNotificationService } from '../email/email-notification.service';
import {
  CRYPTO_ASSETS_CONFIG,
  getAssetFromFireblocksId,
  getFireblocksAssetId,
} from './config/crypto-assets.config';
import { AssetFeesMapResponseDto, AssetFeesResponseDto } from './dto/asset-fees-response.dto';
import {
  AvailableAssetDto,
  AvailableAssetsResponseDto,
  NetworkOptionDto,
} from './dto/available-assets-response.dto';
import { CreateWithdrawRequestDto } from './dto/create-withdraw-request.dto';
import { CurrencyRatesResponseDto } from './dto/currency-rates-response.dto';
import { EstimateWithdrawFeeResponseDto } from './dto/estimate-withdraw-fee-response.dto';
import { EstimateWithdrawFeeDto } from './dto/estimate-withdraw-fee.dto';
import { MultiCurrencyRatesResponseDto } from './dto/multi-currency-rates-response.dto';
import {
  GetUserTransactionsQueryDto,
  TransactionResponseDto,
  UserTransactionItemDto,
  UserTransactionsResponseDto,
} from './dto/transaction-response.dto';
import { WithdrawResponseDto } from './dto/withdraw-response.dto';
import { FireblocksService } from './fireblocks/fireblocks.service';
import { CurrenciesService } from './services/currencies.service';
import { getAddressKey } from './utils/address-keys.util';
import { WalletService } from './wallet.service';

interface SuccessResult {
  success: true;
  vaultAccount: any;
  assetWallet: CreateVaultAssetResponse;
}

interface ErrorResult {
  success: false;
  error: string;
  message: string;
}

type CreateResult = SuccessResult | ErrorResult;

// Type alias for promise API
const qrToSvg = qrToSvgRaw as (data: string, options: QRCodeToStringOptions) => Promise<string>;
const USER_ID_PREFIX = 'user_';

interface FireblocksEventData {
  id: string;
  assetId: string;
  status: string;
  amount: number;
  amountUSD?: number;
  networkFee?: number;
  destination?: { oneTimeAddress?: { address?: string }; name?: string; type?: string };
  destinationAddress?: string;
  createdAt: number;
  customerRefId?: string;
  txHash?: string;
}

interface TransactionSource {
  id: string;
  type: string;
  name: string;
  subType: string;
}

interface ExtendedTransactionResponse {
  // Core transaction properties
  id: string;
  assetId: string;
  source: TransactionSource;
  destination: TransactionSource;
  requestedAmount: string;
  amount: string;
  netAmount: string;
  amountUSD: string;
  fee: string;
  networkFee: string;
  createdAt: number;
  lastUpdated: number;
  status: string;
  txHash: string;
  subStatus: string;
  sourceAddress: string;
  destinationAddress: string;
  destinationAddressDescription: string;
  destinationTag: string;
  signedBy: string[];
  createdBy: string;
  rejectedBy: string;
  addressType: string;
  note: string;
  exchangeTxId: string;
  feeCurrency: string;
  operation: string;
  numOfConfirmations: number;
  amountInfo: any;
  feeInfo: any;
  signedMessages: any[];
  destinations: any[];
  blockInfo: any;
  // Additional properties that may exist
  assetType: string;
  customerRefId?: string; // For withdrawals
  index?: number; // For deposits
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  // Cache for regular rates
  private currencyRatesCache: CurrencyRatesResponseDto | null = null;
  private cacheTimestamp: Date | null = null;

  // Cache for multi-currency rates
  private multiCurrencyRatesCache: MultiCurrencyRatesResponseDto | null = null;
  private multiCacheTimestamp: Date | null = null;

  private readonly CACHE_TTL_MINUTES = 15;

  constructor(
    @InjectRepository(TransactionEntity)
    private transactionRepository: Repository<TransactionEntity>,
    private readonly walletService: WalletService,
    @InjectRepository(WithdrawRequestEntity)
    private readonly withdrawRequestRepo: Repository<WithdrawRequestEntity>,
    private readonly fireblocksService: FireblocksService,
    private readonly balanceService: BalanceService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly currenciesService: CurrenciesService,
    private readonly cryptoConverterService: CryptoConverterService,
    private readonly fiatRateService: FiatRateService,
    private readonly distributedLockService: DistributedLockService,
    private readonly feeCacheService: FeeCacheService,
    private readonly emailNotificationService: EmailNotificationService,
  ) {
    this.transactionRepository = this.dataSource.getRepository(TransactionEntity);
    this.withdrawRequestRepo = this.dataSource.getRepository(WithdrawRequestEntity);
  }

  /**
   * Check if vault account exists for user - using database storage
   */
  private async getVaultAccountByUserId(userId: string): Promise<any> {
    try {
      // Get vaultId from database
      const vaultId = await this.walletService.getVaultIdForUser(userId);

      if (vaultId) {
        this.logger.debug(`Found vaultId ${vaultId} in database for user ${userId}`);

        // Verify the vault still exists in Fireblocks
        const fireblocks = this.fireblocksService.getFireblocksSDK();
        try {
          const vaultResponse = await fireblocks.vaults.getVaultAccount({
            vaultAccountId: vaultId,
          });

          if (vaultResponse.data?.name === `${USER_ID_PREFIX}${userId}`) {
            return vaultResponse.data;
          } else {
            this.logger.warn(
              `Vault ID ${vaultId} exists but name doesn't match for user ${userId}`,
            );
            // Vault exists but doesn't belong to this user - remove from database
            await this.removeVaultIdFromDatabase(userId);
          }
        } catch (error: any) {
          if (error?.response?.statusCode === 404) {
            this.logger.warn(`Vault ID ${vaultId} not found in Fireblocks for user ${userId}`);
            // Vault doesn't exist in Fireblocks anymore - remove from database
            await this.removeVaultIdFromDatabase(userId);
          } else {
            throw error;
          }
        }
      }

      // No vault found in database or vault is invalid
      return null;
    } catch (error: any) {
      this.logger.error(`Error checking vault account for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Remove vaultId from database (if vault no longer exists)
   */
  private async removeVaultIdFromDatabase(userId: string): Promise<void> {
    try {
      const userWallets = await this.walletService.getWalletsByUserId(userId);
      for (const wallet of userWallets) {
        if (wallet.vaultId) {
          await this.walletService.updateWalletVaultId(wallet.userId, wallet.asset, null);
        }
      }
      this.logger.debug(`Removed vaultId from database for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove vaultId from database for user ${userId}:`, error);
    }
  }

  /**
   * Check if asset wallet exists in vault account and get its address
   */
  private async getAssetWallet(vaultAccountId: string, assetId: string): Promise<any> {
    try {
      const fireblocks = this.fireblocksService.getFireblocksSDK();

      // First, get the asset wallet basic info
      const assetWalletResponse = await fireblocks.vaults.getVaultAccountAsset({
        vaultAccountId: vaultAccountId,
        assetId: assetId,
      });

      const assetWallet = assetWalletResponse.data;

      // If we don't have an address, try to get it from addresses endpoint
      // Note: VaultAsset type doesn't have address property, so we need to handle it differently
      const assetWithAddress = assetWallet as any; // Temporary type assertion
      if (!assetWithAddress?.address) {
        this.logger.debug(`No address in asset wallet response for ${assetId}, checking addresses`);

        const addresses = await this.getDepositAddresses(vaultAccountId, assetId);
        if (addresses.length > 0 && addresses[0]?.address) {
          // Add the address to the asset wallet data
          assetWithAddress.address = addresses[0].address;
          this.logger.debug(`Found address via addresses endpoint: ${assetWithAddress.address}`);
        }
      }

      return assetWithAddress;
    } catch (error: any) {
      // If asset wallet doesn't exist, it will throw a 404 error
      if (error?.response?.statusCode === 404 || error?.response?.data?.code === 1006) {
        return null;
      }
      this.logger.error(
        `Error checking asset wallet ${assetId} in vault ${vaultAccountId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if user has existing vault by checking database
   */
  private async userHasExistingVault(userId: string): Promise<boolean> {
    const vaultId = await this.walletService.getVaultIdForUser(userId);
    return vaultId != null;
  }

  private async getDepositAddresses(
    vaultAccountId: string,
    assetId: string,
  ): Promise<CreateAddressResponse[]> {
    try {
      const fireblocks = this.fireblocksService.getFireblocksSDK();

      const addressesResponse = await fireblocks.vaults.getVaultAccountAssetAddressesPaginated({
        vaultAccountId: vaultAccountId,
        assetId: assetId,
        limit: 10,
      });

      let addresses: CreateAddressResponse[] = [];

      if (addressesResponse.data) {
        // Check if data is directly an array
        if (Array.isArray(addressesResponse.data)) {
          addresses = addressesResponse.data;
        }
        // Check if data has an addresses property
        else if (
          (addressesResponse.data as any).addresses &&
          Array.isArray((addressesResponse.data as any).addresses)
        ) {
          addresses = (addressesResponse.data as any).addresses;
        }
        // Check if data has a data property (nested)
        else if (
          (addressesResponse.data as any).data &&
          Array.isArray((addressesResponse.data as any).data)
        ) {
          addresses = (addressesResponse.data as any).data;
        }
      }

      this.logger.debug(
        `Found ${addresses.length} deposit addresses for ${assetId} in vault ${vaultAccountId}`,
      );

      // Filter out any addresses that don't have an address field
      return addresses.filter(
        (addr: CreateAddressResponse) => addr && typeof addr.address === 'string',
      );
    } catch (error: any) {
      // If no addresses exist, it might throw an error
      if (error?.response?.statusCode === 404 || error?.response?.data?.code === 1006) {
        this.logger.debug(`No deposit addresses found for ${assetId} in vault ${vaultAccountId}`);
        return [];
      }
      this.logger.error(
        `Error getting deposit addresses for ${assetId} in vault ${vaultAccountId}:`,
        error,
      );
      return [];
    }
  }

  private isAddressUpdateSupported(assetId: string): boolean {
    const unsupportedPatterns = [
      'ETH_', // All Ethereum-based assets
      'USDC_ETH', // USDC on Ethereum
      'USDC_BSC', // USDC on BSC (EVM-compatible)
      'USDT_ETH', // USDT on Ethereum
      'USDT_BSC', // USDT on BSC (EVM-compatible)
      'BNB_', // BNB assets
      'MATIC_', // Polygon native
    ];

    // Return true if address updates ARE supported (i.e., NOT in the unsupported list)
    return !unsupportedPatterns.some((pattern) => assetId.includes(pattern));
  }

  /**
   * Update description for an existing asset address
   */
  private async updateAssetAddressDescription(
    vaultAccountId: string,
    assetId: string,
    address: string,
    description: string,
  ): Promise<void> {
    try {
      // Skip address updates for assets that don't support it
      if (!this.isAddressUpdateSupported(assetId)) {
        this.logger.debug(`Skipping address description update for asset: ${assetId}`);
        return;
      }

      const fireblocks = this.fireblocksService.getFireblocksSDK();

      // Use the address itself as the addressId (this works for most assets)
      // For XRP, you'd need to use address:tag format, but for BTC/LTC/DOGE, just the address works
      const addressId = address;

      await fireblocks.vaults.updateVaultAccountAssetAddress({
        vaultAccountId: vaultAccountId,
        assetId: assetId,
        addressId: addressId,
        updateVaultAccountAssetAddressRequest: {
          description: description,
        },
      });

      this.logger.debug(`Updated description for address ${address}: ${description}`);
    } catch (error: any) {
      // Log but don't fail the entire process if description update fails
      this.logger.warn(`Failed to update address description for ${address}:`, error.message);
    }
  }

  /**
   * Create user vault and asset wallet if they don't exist
   */
  private async createUserVaultAssetAddress(
    userId: string,
    assetId: string,
  ): Promise<CreateResult> {
    // Use distributed lock to prevent race condition in vault creation
    try {
      return await this.distributedLockService.withLock(
        LockKeyBuilder.paymentVaultCreate(userId),
        LockTTL.EXTERNAL_API_CALL,
        async () => {
          try {
            let vaultAccount: any;

            // Check if vault account already exists
            const existingVaultAccount = await this.getVaultAccountByUserId(userId);

            if (existingVaultAccount) {
              this.logger.log(
                `Vault account already exists for user ${userId}:`,
                existingVaultAccount.id,
              );
              vaultAccount = existingVaultAccount;
            } else {
              // Create new vault account
              const fireblocks = this.fireblocksService.getFireblocksSDK();
              const vaultResponse = await fireblocks.vaults.createVaultAccount({
                createVaultAccountRequest: {
                  name: `${USER_ID_PREFIX}${userId}`,
                  customerRefId: userId, // Add userId as customerRefId for easy tracking
                  autoFuel: false,
                  hiddenOnUI: true,
                },
              });

              vaultAccount = vaultResponse.data;
              this.logger.log(`Created new vault account for user ${userId}:`, vaultAccount.id);
            }

            // Check if asset wallet already exists
            const existingAssetWallet = await this.getAssetWallet(vaultAccount.id, assetId);

            let assetWallet: any; // Use any to handle dynamic address property
            if (existingAssetWallet) {
              this.logger.log(`Asset wallet ${assetId} already exists in vault ${vaultAccount.id}`);
              assetWallet = existingAssetWallet;

              // If we still don't have an address after getAssetWallet, try to create one
              if (!assetWallet?.address) {
                this.logger.warn(
                  `No address found for existing asset ${assetId}, creating deposit address`,
                );

                const addresses = await this.getDepositAddresses(vaultAccount.id, assetId);
                if (addresses.length > 0 && addresses[0]?.address) {
                  assetWallet.address = addresses[0].address;
                } else {
                  // Create a new deposit address
                  const fireblocks = this.fireblocksService.getFireblocksSDK();
                  const addressResponse = await fireblocks.vaults.createVaultAccountAssetAddress({
                    vaultAccountId: vaultAccount.id,
                    assetId: assetId,
                    createAddressRequest: { description: `${USER_ID_PREFIX}${userId}` },
                  });

                  if (addressResponse.data?.address) {
                    assetWallet.address = addressResponse.data.address;
                  }
                }
              }

              // Update description of existing asset that support it
              if (this.isAddressUpdateSupported(assetId) && assetWallet?.address) {
                await this.updateAssetAddressDescription(
                  vaultAccount.id,
                  assetId,
                  assetWallet.address,
                  `${USER_ID_PREFIX}${userId}`,
                );
              }
            } else {
              // Create new asset wallet
              const fireblocks = this.fireblocksService.getFireblocksSDK();
              const walletResponse = await fireblocks.vaults.createVaultAccountAsset({
                vaultAccountId: vaultAccount.id,
                assetId: assetId,
              });

              assetWallet = walletResponse.data;
              this.logger.log(`Created new asset wallet ${assetId} in vault ${vaultAccount.id}`);

              // Update description of newly created asset that support it
              if (this.isAddressUpdateSupported(assetId) && assetWallet?.address) {
                await this.updateAssetAddressDescription(
                  vaultAccount.id,
                  assetId,
                  assetWallet.address,
                  `${USER_ID_PREFIX}${userId}`,
                );
              }
            }

            // Final validation - if we still don't have an address, use the ETH address as fallback
            if (!assetWallet?.address) {
              this.logger.warn(
                `No address available for ${assetId}, using ETH address as fallback`,
              );

              // For ETH-based assets, they share the same address as ETH
              const ethWallet = await this.getAssetWallet(vaultAccount.id, 'ETH_TEST5');
              if (ethWallet?.address) {
                assetWallet = { ...assetWallet, address: ethWallet.address };
                this.logger.log(`Using ETH address as fallback: ${assetWallet.address}`);
              } else {
                throw new Error(
                  `Asset wallet created but no address returned for ${assetId} and no fallback available`,
                );
              }
            }

            return {
              success: true,
              vaultAccount,
              assetWallet,
            };
          } catch (error: any) {
            this.logger.error('Error in createUserVaultAssetAddress:', error);
            return {
              success: false,
              error: 'VAULT_CREATION_FAILED',
              message: error?.response?.data?.message || error.message,
            };
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for vault creation', {
          userId,
          assetId,
        });
        return {
          success: false,
          error: 'SYSTEM_BUSY',
          message: 'The system is currently busy. Please try again in a moment.',
        };
      }
      throw error;
    }
  }

  private async getOrCreateAddressForAsset(
    userId: string,
    vaultAccountId: string,
    assetId: string,
    assetWallet: CreateVaultAssetResponse,
  ): Promise<string> {
    // Get existing deposit addresses
    const depositAddresses = await this.getDepositAddresses(vaultAccountId, assetId);

    let address: string | undefined;

    // If we have existing deposit addresses, use the first one
    if (depositAddresses.length > 0 && depositAddresses[0]?.address) {
      address = depositAddresses[0].address; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
      this.logger.debug(`Using existing deposit address: ${address}`);
    } else {
      // Try to create a new deposit address
      try {
        const fireblocks = this.fireblocksService.getFireblocksSDK();
        const addressResponse = await fireblocks.vaults.createVaultAccountAssetAddress({
          vaultAccountId: vaultAccountId,
          assetId: assetId,
          createAddressRequest: { description: `${USER_ID_PREFIX}${userId}` },
        });

        const newDepositAddress = addressResponse.data;
        if (newDepositAddress?.address) {
          address = newDepositAddress.address; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
          this.logger.debug(`Created new deposit address: ${address}`);
        }
      } catch (error: any) {
        this.logger.error(`Failed to create deposit address:`, error);
        // Continue to fallback options
      }

      /**
       * Case-sensitive crypto wallet addresses:
       * A validate wallet address for cryptocoins is case sensitive and must be stored as it is!!
       * Converted and stored it as a lowercase format is completely wrong which will cause failure of
       * "invalid address" when process it in the blockchain system!
       * - A new Segwit format of BTC and LTC addresses are all lower case but still case-sensitive
       * - A legacy format of BTC and LTC addresses are combined with uppercase and lowercaes:
       *   legacy BTC_TEST example: mjVn4WbucPYEm2fieVh3cUAxKzA2YKiwtp
       * - A ETH or DOGE address contains both upper and lower cases - case-sensitive:
       *   ETH_TEST example: 0xf6EADC317BF57e18CD2Bd4598895bc683AA95aE9
       *   DOGE_TEST example: nYAz2jCV2kTzPtwthLMgaiiXazfuyY6ipX
       * - Existing stored invalid wallet addresses will be manually corrected later on
       */
      // If deposit address creation failed or returned no address, use asset wallet address
      if (!address && assetWallet?.address) {
        address = assetWallet.address; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
        this.logger.debug(`Falling back to asset wallet address: ${address}`);
      }
    }

    // If we still don't have an address, throw an error
    if (!address) {
      throw new BadRequestException(`Failed to generate deposit address for asset ${assetId}`);
    }

    return address;
  }

  async getOrCreateDepositAddress(
    userId: string,
    asset: AssetTypeEnum,
    network?: string,
  ): Promise<{ address: string; qrCode: string }> {
    // Check if asset is enabled in active currencies
    const supportedAssets = await this.currenciesService.getActiveCurrencies();
    if (!supportedAssets.includes(asset)) {
      throw new BadRequestException(`Asset ${asset} is not supported`);
    }

    // Create consistent key: for USDC/USDT with network, use compound key; for others use asset symbol
    const key = getAddressKey(asset, network);
    const wallet = await this.walletService.findUserWallet(userId, asset);
    let address: string;

    if (wallet?.addresses?.[key]) {
      address = wallet.addresses[key]; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
    } else {
      const fireblocksAssetId = this.mapAssetToFireblocksId(asset, network);

      // Check if user has a vault (by checking database first)
      const userHasVault = await this.userHasExistingVault(userId);

      // Log the appropriate message based on whether user has existing vault
      if (userHasVault) {
        this.logger.debug(`User ${userId} has existing vault, retrieving from database`);
      } else {
        this.logger.debug(`User ${userId} is new, creating vault and wallet`);
      }

      // Call the same function regardless - it handles both cases internally
      const vaultResult = await this.createUserVaultAssetAddress(userId, fireblocksAssetId);

      if (!vaultResult.success) {
        throw new BadRequestException(`Failed to create vault/wallet: ${vaultResult.message}`);
      }

      const { vaultAccount, assetWallet } = vaultResult;

      // Get or create address for the asset
      address = await this.getOrCreateAddressForAsset(
        userId,
        vaultAccount.id,
        fireblocksAssetId,
        assetWallet,
      );

      // Store the address AND vaultId in our local wallet database
      await this.walletService.addNetworkAddress(
        userId,
        asset,
        key,
        address,
        vaultAccount.id, // This will now store the vaultId as string (could be null in some cases)
      );
    }

    // Generate QR code
    let svgString: string;
    try {
      svgString = await qrToSvg(address, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'L',
      });
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      Logger.error('SVG QR code generation failed', errorObj.message, PaymentsService.name);
      throw new InternalServerErrorException(`SVG QR code generation failed: ${errorObj.message}`);
    }
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
    return { address, qrCode };
  }

  async findByExternalId(id: string): Promise<TransactionEntity | null> {
    return this.transactionRepository.findOne({
      where: { id },
    });
  }

  async findByAddress(address: string): Promise<TransactionEntity | null> {
    return this.transactionRepository.findOne({
      where: { address, type: TransactionTypeEnum.DEPOSIT },
    });
  }

  async updatePaymentStatus(id: string, status: TransactionStatusEnum): Promise<TransactionEntity> {
    const tx = await this.transactionRepository.findOne({ where: { id } });

    if (!tx) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    tx.status = status;

    return this.transactionRepository.save(tx);
  }

  /**
   * Sync transactions from Fireblocks
   * CRITICAL: Protected by distributed lock to prevent concurrent sync from multiple instances
   */
  public async syncTransactions(): Promise<{
    synced: number;
    creditedCount: number;
    creditedTotal: string;
  }> {
    // CRITICAL SECURITY FIX: Use blocking lock with retry to ensure sync doesn't skip
    // If another instance is syncing, wait up to 60 seconds for it to complete
    const lockResource = 'payment:sync:global';

    this.logger.log('Attempting to acquire sync lock, will wait if another sync is in progress...');

    let lock;
    try {
      // Wait up to 60 seconds for other sync to complete, then proceed with our own sync
      // retryCount: 60, retryDelay: 1000ms = max 60s wait time
      lock = await this.distributedLockService.acquireLock(
        lockResource,
        LockTTL.EXTERNAL_API_CALL, // Fireblocks API calls
        {
          retryCount: 60,
          retryDelay: 1000,
          retryJitter: 500,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.error(
          'Failed to acquire sync lock after waiting 60 seconds - another sync is still running',
        );
        throw error; // Re-throw the properly formatted exception
      }
      this.logger.error('Unexpected error while acquiring sync lock:', error);
      throw new InternalServerErrorException(
        'Transaction sync failed to acquire lock due to unexpected error',
      );
    }

    try {
      this.logger.log('[LOCK ACQUIRED] Starting transaction sync from Fireblocks');

      // Determine fetch window based on last Fireblocks-created timestamp
      const [lastTx] = await this.transactionRepository.find({
        order: { fbCreatedAt: 'DESC' },
        take: 1,
      });

      // Safe timestamp handling with validation
      const params: Record<string, string | number> = { limit: 100 };

      if (lastTx?.fbCreatedAt) {
        const lastTimestamp = lastTx.fbCreatedAt.getTime();

        // Validate timestamp is within reasonable bounds (not in future and not too old)
        if (lastTimestamp <= Date.now() && lastTimestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000) {
          // Within 30 days
          const afterTimestamp = Math.max(lastTimestamp - 5 * 60 * 1000, 0);
          params.after = afterTimestamp.toString();
        } else {
          this.logger.warn(`Invalid timestamp detected: ${lastTimestamp}. Using default params.`);
        }
      }

      const rawList = await this.fireblocksService
        .getFireblocksSDK()
        .transactions.getTransactions(params);

      // Fireblocks transaction shape including root destinationAddress
      type FbTx = {
        id: string;
        amount: number;
        status: string;
        assetId: string;
        destination: {
          oneTimeAddress?: {
            address?: string;
          };
        };
        destinationAddress?: string;
        createdAt: number;
        txHash?: string;
      };

      const fbTxList = rawList as unknown as FbTx[];
      if (fbTxList.length === 0) {
        this.logger.log('[LOCK RELEASING] No new transactions to sync');
        return {
          synced: 0,
          creditedCount: 0,
          creditedTotal: '0',
        };
      }
      // Transaction rows shape for bulk upsert
      type TxRow = {
        id: string;
        type: TransactionTypeEnum;
        asset: AssetTypeEnum;
        amount: string;
        address: string;
        status: TransactionStatusEnum;
        isCredited: boolean;
        fbCreatedAt: Date;
        txHash?: string;
      };
      const rows = fbTxList
        .map((tx) => {
          // try oneTimeAddress first, then root-level destinationAddress

          const rawAddr = tx.destination.oneTimeAddress?.address ?? tx.destinationAddress;
          if (!rawAddr) return null;
          const address = rawAddr; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
          const row: TxRow = {
            id: tx.id,
            type: TransactionTypeEnum.DEPOSIT,
            asset: this.mapFireblocksIdToAssetType(tx.assetId),
            amount: tx.amount.toString(),
            address,
            status: this.mapFireblocksStatus(tx.status),
            isCredited: false,
            fbCreatedAt: new Date(tx.createdAt),
            txHash: tx.txHash,
          };
          return row;
        })
        .filter((r): r is TxRow => r !== null);
      if (rows.length === 0) {
        this.logger.log('[LOCK RELEASING] No valid transactions after filtering');
        return {
          synced: 0,
          creditedCount: 0,
          creditedTotal: '0',
        };
      }
      // Bulk insert or update statuses
      await this.transactionRepository
        .createQueryBuilder()
        .insert()
        .into(TransactionEntity)
        .values(rows)
        .orUpdate({
          conflict_target: ['id'],
          overwrite: ['status', 'fbCreatedAt'],
        })
        .execute();
      // credit wallets automatically after sync and get stats
      const { creditedCount, creditedTotal } = await this.creditPendingTransactions();

      this.logger.log(
        `[LOCK RELEASING] Transaction sync completed: synced=${rows.length}, credited=${creditedCount}`,
      );

      return { synced: rows.length, creditedCount, creditedTotal };
    } finally {
      // Release the lock
      await this.distributedLockService.releaseLock(lock);
    }
  }

  private mapFireblocksIdToAssetType(fbId: string): AssetTypeEnum {
    const assetType = getAssetFromFireblocksId(fbId);
    if (!assetType) {
      this.logger.error(`Unsupported Fireblocks assetId: ${fbId}`);
      throw new Error(`Unsupported assetId ${fbId}`);
    }

    return assetType;
  }

  // Credit (or create) user wallet for confirmed deposit
  public async creditWallet(userId: string, asset: AssetTypeEnum, amount: string) {
    const userRepository = this.dataSource.getRepository(UserEntity);
    const user = await userRepository.findOne({ relations: [], where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const result = await this.balanceService.updateBalance({
      operation: BalanceOperationEnum.DEPOSIT,
      operationId: randomUUID(),
      userId,
      amount: new BigNumber(amount),
      asset,
      description: 'Deposit from Fireblocks',
    });

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to credit wallet');
    }

    // Note: Seed pairs are now automatically created on first game for seamless UX
    // No need to pre-generate them on deposit

    return result.balance;
  }

  private mapAssetToFireblocksId(assetType: AssetTypeEnum, network?: string): string {
    const apiUrl = this.configService.get<string>('fireblocks.apiUrl') || '';
    const isTestnet = apiUrl.includes('sandbox');
    return getFireblocksAssetId(assetType, isTestnet, network);
  }

  // Get user wallet balances
  getWalletsByUserId(userId: string): Promise<WalletEntity[]> {
    return this.walletService.getWalletsByUserId(userId);
  }

  // Get list of available assets with network options
  async getAvailableAssets(): Promise<AvailableAssetsResponseDto> {
    const supportedAssets = await this.currenciesService.getActiveCurrencies();
    const networkNames: Record<string, { name: string; description: string }> = {
      ethereum: { name: 'Ethereum', description: 'ERC-20 token' },
      bsc: { name: 'Binance Smart Chain', description: 'BEP-20 token' },
    };

    const assets: AvailableAssetDto[] = Object.values(CRYPTO_ASSETS_CONFIG)
      .filter((config) => supportedAssets.includes(config.symbol))
      .map((config) => {
        const networks: NetworkOptionDto[] | undefined = config.supportedNetworks?.map(
          (networkId) => ({
            id: networkId,
            name: networkNames[networkId]?.name || networkId,
            description: networkNames[networkId]?.description || `${networkId} network`,
          }),
        );

        return {
          symbol: config.symbol,
          name: config.name,
          decimals: config.decimals,
          requiresNetworkSelection: config.requiresNetworkSelection || false,
          networks,
        };
      });

    return { assets };
  }

  // Map Fireblocks SDK status to internal TransactionStatusEnum
  private mapFireblocksStatus(fbStatus: string): TransactionStatusEnum {
    switch (fbStatus) {
      case 'COMPLETED':
        return TransactionStatusEnum.COMPLETED;
      case 'CONFIRMING':
      case 'CONFIRMED':
        return TransactionStatusEnum.CONFIRMED;
      case 'FAILED':
      case 'REJECTED':
      case 'CANCELLED':
        return TransactionStatusEnum.FAILED;
      default:
        return TransactionStatusEnum.PENDING;
    }
  }

  // Credit completed deposit transactions in bulk
  public async creditPendingTransactions(): Promise<{
    creditedCount: number;
    creditedTotal: string;
  }> {
    // Credit each pending deposit transaction and accumulate total
    const pendingTxs = await this.transactionRepository.find({
      where: {
        type: TransactionTypeEnum.DEPOSIT,
        status: TransactionStatusEnum.COMPLETED,
        isCredited: false,
      },
    });
    let total = 0;
    for (const tx of pendingTxs) {
      const amount = parseFloat(tx.amount);
      // find wallet by address and asset
      const wallet = await this.walletService.findWalletByAddress(tx.address!, tx.asset);
      if (!wallet) continue;
      // credit wallet and update transaction
      await this.creditWallet(wallet.userId, tx.asset, tx.amount);
      tx.userId = wallet.userId;
      tx.isCredited = true;
      tx.creditedAt = new Date();
      await this.transactionRepository.save(tx);
      total += amount;
    }
    return {
      creditedCount: pendingTxs.length,
      creditedTotal: total.toFixed(8),
    };
  }

  async getWithdrawRequests(
    page: number = 1,
    limit: number = 10,
    status?: WithdrawStatusEnum,
  ): Promise<{ data: WithdrawRequestEntity[]; total: number }> {
    const queryBuilder = this.withdrawRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .orderBy('request.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: instanceToPlain(data) as WithdrawRequestEntity[],
      total,
    };
  }

  async createWithdrawRequest(
    user: UserEntity,
    dto: CreateWithdrawRequestDto,
  ): Promise<WithdrawResponseDto> {
    // Generate unique request ID server-side
    const requestId = randomUUID();

    // Use transaction to prevent race conditions
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for duplicate request ID within transaction with lock
      const existingRequest = await queryRunner.manager.findOne(WithdrawRequestEntity, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingRequest) {
        // This should be extremely rare with UUIDs, but handle it
        throw new InternalServerErrorException('Duplicate request ID generated');
      }

      // First, estimate the network fee
      const feeEstimate = await this.estimateNetworkFee(dto.asset, dto.toAddress, dto.amount);

      /**
       * Withdrawal flow (Network fee charged to user):
       * 1. User requests to withdraw X amount
       * 2. Network fee Y is estimated
       * 3. Full amount X is deducted from user balance
       * 4. Net amount (X - Y) is sent to destination
       * 5. Network fee Y is paid by user (absorbed by the system as cost)
       */
      const amountAfterFee = new BigNumber(dto.amount).minus(new BigNumber(feeEstimate.networkFee));

      if (amountAfterFee.lte(0)) {
        throw new BadRequestException('Withdrawal amount is too small to cover network fees');
      }

      // Deduct the full amount from user balance (includes network fee)
      const result = await this.balanceService.updateBalance(
        {
          operation: BalanceOperationEnum.WITHDRAW,
          operationId: requestId, // Use server-generated UUID
          userId: user.id,
          amount: new BigNumber(dto.amount), // Deduct full amount (includes network fee)
          asset: dto.asset,
          description: `Withdraw request - Network fee: ${feeEstimate.networkFee} ${dto.asset}`,
        },
        queryRunner,
      );

      if (!result.success) {
        throw new BadRequestException(result.error || 'Failed to create withdraw request');
      }

      const request = this.withdrawRequestRepo.create({
        id: requestId, // Use server-generated UUID
        userId: user.id,
        amount: amountAfterFee.toString(), // Store net amount to be sent
        estimateNetworkFee: feeEstimate.networkFee,
        asset: dto.asset,
        toAddress: dto.toAddress,
        status: WithdrawStatusEnum.PENDING,
      });

      await queryRunner.manager.save(request);
      await queryRunner.commitTransaction();

      // Send email notification
      await this.emailNotificationService.sendWithdrawalNotification(request.userId, {
        requestId: request.id,
        asset: request.asset,
        amount: request.amount,
        networkFee: request.estimateNetworkFee,
        toAddress: request.toAddress,
        status: WithdrawStatusEnum.PENDING,
      });

      return {
        requestId: request.id,
        status: request.status,
        asset: request.asset,
        amount: request.amount, // Return net amount to client
        estimateNetworkFee: request.estimateNetworkFee,
        toAddress: request.toAddress,
        createdAt: request.createdAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Add this method for dummy values
  private getDummyValues(asset: AssetTypeEnum): { amount: string; address: string } {
    const apiUrl = this.configService.get<string>('fireblocks.apiUrl') || '';
    const isTestnet = apiUrl.includes('sandbox');

    const dummyValues: Record<
      AssetTypeEnum,
      { amount: string; testnetAddress: string; mainnetAddress: string }
    > = {
      [AssetTypeEnum.BTC]: {
        amount: '0.0001',
        testnetAddress: 'tb1q9wnckupf2j7n8fkl6g2eekqzphs46pf5ajc4ce',
        mainnetAddress: 'bc1q7z8ftdwdpyc5a4yg4l27eu63ek9s5hzdf989ua',
      },
      [AssetTypeEnum.LTC]: {
        amount: '0.001',
        testnetAddress: 'QPX9yfqoRicVYL4UJ32d4wYw38YEcJgZvG',
        mainnetAddress: 'LUsss958JmDpyHyHG2BLDroZGqm5PVbKMb',
      },
      [AssetTypeEnum.DOGE]: {
        amount: '5',
        testnetAddress: '2MvPkgWcFhswhmcKb1fR15W17dkZ6foMqAQ',
        mainnetAddress: 'D7Y7Dn9b3nL7q6L7Y7Y7n9b3nL7q6L7Y7Y7n',
      },
      [AssetTypeEnum.ETH]: {
        amount: '0.0001',
        testnetAddress: '0xf6EADC317BF57e18CD2Bd4598895bc683AA95aE9',
        mainnetAddress: '0x5aBBd5c9B79BCd91aFe72745d09f3A603C44Acf9',
      },
      [AssetTypeEnum.SOL]: {
        amount: '0.1',
        testnetAddress: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        mainnetAddress: 'TU59dytwqQKswgSQvDFvNjYF7CKApwj9JoQbghpGewm',
      },
      [AssetTypeEnum.USDC]: {
        amount: '5',
        testnetAddress: '0x742d35Cc6634C0532925a3b8Dc9F5a6f6a8c8e6a',
        mainnetAddress: '0x742d35Cc6634C0532925a3b8Dc9F5a6f6a8c8e6a',
      },
      [AssetTypeEnum.USDT]: {
        amount: '5',
        testnetAddress: '0x742d35Cc6634C0532925a3b8Dc9F5a6f6a8c8e6a',
        mainnetAddress: '0x742d35Cc6634C0532925a3b8Dc9F5a6f6a8c8e6a',
      },
      [AssetTypeEnum.TRX]: {
        amount: '5',
        testnetAddress: 'TXYZopYRdj2D9XRtbG411X9RuRxWQk8y3C',
        mainnetAddress: 'TCptxrwJENtBBxutJW9MjnsFpd47e8H6EZ',
      },
      [AssetTypeEnum.XRP]: {
        amount: '5',
        testnetAddress: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
        mainnetAddress: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
      },
    };

    const values = dummyValues[asset];
    const address = isTestnet ? values.testnetAddress : values.mainnetAddress;

    return {
      amount: values.amount,
      address: address,
    };
  }

  /**
   * Get cached fee estimate for an asset (for initial display)
   */
  async getCachedFeeEstimate(
    asset: AssetTypeEnum,
  ): Promise<{ networkFee: string; isFromApi: boolean; cachedAt: Date }> {
    const cached = await this.feeCacheService.get(asset);

    // Return cached value if valid
    if (cached) {
      return {
        networkFee: cached.fee,
        isFromApi: cached.isFromApi,
        cachedAt: cached.cachedAt,
      };
    }

    // Get fresh estimate from Fireblocks
    const dummy = this.getDummyValues(asset);
    try {
      const estimate = await this.estimateNetworkFee(asset, dummy.address, dummy.amount);

      // Update cache
      await this.feeCacheService.set(asset, estimate.networkFee, estimate.isFromApi);

      return {
        networkFee: estimate.networkFee,
        isFromApi: estimate.isFromApi,
        cachedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to estimate network fee for ${asset}:`, error);

      // Fallback to default fee
      const defaultFee = this.getDefaultNetworkFee(asset);
      await this.feeCacheService.set(asset, defaultFee, false);

      return {
        networkFee: defaultFee,
        isFromApi: false,
        cachedAt: new Date(),
      };
    }
  }

  /**
   * Get fee estimates for all supported assets (for initial display)
   */
  async getAssetFees(forceRefresh?: boolean): Promise<AssetFeesMapResponseDto> {
    // Clear cache if forceRefresh is true
    if (forceRefresh) {
      await this.feeCacheService.invalidateAll();
      this.logger.debug('Cache cleared due to forceRefresh parameter');
    }

    const supportedAssets = await this.currenciesService.getActiveCurrencies();
    const fees: Record<string, AssetFeesResponseDto> = {};

    // Get fees for all supported assets in parallel
    const feePromises = supportedAssets.map(async (asset) => {
      const feeEstimate = await this.getCachedFeeEstimate(asset);
      fees[asset] = {
        asset,
        networkFee: feeEstimate.networkFee,
        cachedAt: feeEstimate.cachedAt,
      };
    });

    await Promise.all(feePromises);

    return { fees };
  }

  // Add a method to get cache stats (optional, for monitoring)
  async getFeeCacheStats(): Promise<{ totalEntries: number }> {
    return this.feeCacheService.getStats();
  }

  /**
   * Estimate network fee for withdrawal using Fireblocks (for specific transactions)
   */
  private async estimateNetworkFee(
    asset: AssetTypeEnum,
    toAddress: string,
    amount: string,
  ): Promise<{ networkFee: string; isFromApi: boolean }> {
    try {
      const apiUrl = this.configService.get<string>('fireblocks.apiUrl') || '';
      const isTestnet = apiUrl.includes('sandbox');
      const fireblocksAssetId = getFireblocksAssetId(asset, isTestnet);

      const fireblocks = this.fireblocksService.getFireblocksSDK();

      // Determine fee level based on asset type
      const feeLevel = this.getFeeLevelForAsset(asset);

      this.logger.debug(`Attempting fee estimation for ${asset}`, {
        asset,
        toAddress,
        amount,
        fireblocksAssetId,
        feeLevel,
        vaultAccountId: this.fireblocksService.getVaultAccountId(),
        isTestnet,
      });

      // Use Fireblocks transaction fee estimation endpoint
      const feeEstimation = await fireblocks.transactions.estimateTransactionFee({
        transactionRequest: {
          assetId: fireblocksAssetId,
          amount: amount,
          source: {
            type: 'VAULT_ACCOUNT',
            id: this.fireblocksService.getVaultAccountId(),
          },
          destination: {
            type: 'ONE_TIME_ADDRESS',
            oneTimeAddress: {
              address: toAddress,
            },
          },
        },
      });

      this.logger.debug(
        `Fireblocks transaction fee estimation for ${asset} (level: ${feeLevel}):`,
        {
          data: feeEstimation.data,
        },
      );

      // Extract network fee based on the fee level
      let networkFee = '0';

      if (feeEstimation.data) {
        const feeLevelData = feeEstimation.data[feeLevel.toLowerCase()];

        if (
          feeLevelData &&
          feeLevelData.networkFee !== undefined &&
          feeLevelData.networkFee !== null
        ) {
          networkFee = feeLevelData.networkFee.toString();
          this.logger.log(`Using ${feeLevel} network fee for ${asset}: ${networkFee}`);
        } else {
          const availableFee =
            feeEstimation.data.medium?.networkFee ||
            feeEstimation.data.low?.networkFee ||
            feeEstimation.data.high?.networkFee;

          if (availableFee !== undefined && availableFee !== null) {
            networkFee = availableFee.toString();
            this.logger.warn(
              `Fee level ${feeLevel} not available for ${asset}, using available fee: ${networkFee}`,
            );
          } else {
            throw new Error(`No network fee estimates available for ${asset}`);
          }
        }
      } else {
        throw new Error('No data in transaction fee estimation response');
      }

      return {
        networkFee,
        isFromApi: true,
      };
    } catch (error: any) {
      // Specific handling for error code 1903
      if (error?.response?.data?.code === 1903) {
        this.logger.warn(
          `Fireblocks fee estimation failed with code 1903 for ${asset}. This may be a temporary issue or asset balance is zero.`,
        );

        // Return a more realistic default fee based on recent successful estimates
        const realisticFee = this.getRealisticDefaultFee(asset);

        return {
          networkFee: realisticFee,
          isFromApi: false,
        };
      }

      this.logger.error(`Failed to estimate network fee for ${asset}:`, error);

      const defaultFee = this.getDefaultNetworkFee(asset);

      return {
        networkFee: defaultFee,
        isFromApi: false,
      };
    }
  }

  /**
   * Configurable fee levels for different asset types
   * Uses Partial record with fallback to 'LOW'
   */
  private readonly assetFeeLevels: Partial<Record<AssetTypeEnum, 'LOW' | 'MEDIUM' | 'HIGH'>> = {
    [AssetTypeEnum.BTC]: 'MEDIUM',
    [AssetTypeEnum.ETH]: 'MEDIUM',
    [AssetTypeEnum.LTC]: 'LOW',
    [AssetTypeEnum.DOGE]: 'LOW',
    [AssetTypeEnum.USDC]: 'LOW',
    [AssetTypeEnum.USDT]: 'LOW',
    [AssetTypeEnum.SOL]: 'LOW',
    [AssetTypeEnum.TRX]: 'LOW',
    [AssetTypeEnum.XRP]: 'LOW',
    // Add other assets as needed
  };

  private getFeeLevelForAsset(asset: AssetTypeEnum): 'LOW' | 'MEDIUM' | 'HIGH' {
    return this.assetFeeLevels[asset] || 'LOW';
  }

  /**
   * Get default network fees for different assets
   */
  private getDefaultNetworkFee(asset: AssetTypeEnum): string {
    const defaultFees: Record<string, string> = {
      [AssetTypeEnum.BTC]: '0.0001',
      [AssetTypeEnum.ETH]: '0.0001',
      [AssetTypeEnum.LTC]: '0.0001',
      [AssetTypeEnum.DOGE]: '1.0',
      [AssetTypeEnum.USDC]: '0.001',
      [AssetTypeEnum.USDT]: '0.001',
      [AssetTypeEnum.SOL]: '0.000005',
      [AssetTypeEnum.TRX]: '0.001',
      [AssetTypeEnum.XRP]: '0.00001',
    };

    return defaultFees[asset] || '0.001';
  }

  /**
   * Get more realistic default fees based on typical network conditions
   */
  private getRealisticDefaultFee(asset: AssetTypeEnum): string {
    // These are more realistic estimates based on current network conditions
    const realisticFees: Record<string, string> = {
      [AssetTypeEnum.BTC]: '0.00009165', // Based on successful estimate received from fireblocks
      [AssetTypeEnum.ETH]: '0.000021000000546', // Based on successful estimate received from fireblocks
      [AssetTypeEnum.LTC]: '0.00001420', // Base on successful estimate received from fireblocks
      [AssetTypeEnum.DOGE]: '0.45200000',
      [AssetTypeEnum.USDC]: '0.00100000',
      [AssetTypeEnum.USDT]: '0.00100000',
      [AssetTypeEnum.SOL]: '0.00000500',
      [AssetTypeEnum.TRX]: '0.00100000',
      [AssetTypeEnum.XRP]: '0.00001000',
    };

    return realisticFees[asset] || this.getDefaultNetworkFee(asset);
  }

  /**
   * Get network fee estimate without creating a withdrawal request
   */
  async getWithdrawalFeeEstimate(
    dto: EstimateWithdrawFeeDto,
  ): Promise<EstimateWithdrawFeeResponseDto> {
    const feeEstimate = await this.estimateNetworkFee(dto.asset, dto.toAddress, dto.amount);

    const netAmount = new BigNumber(dto.amount).minus(new BigNumber(feeEstimate.networkFee));

    return {
      asset: dto.asset,
      originalAmount: dto.amount,
      networkFee: feeEstimate.networkFee,
      netAmount: netAmount.toString(),
    };
  }

  /**
   * ADMIN: Approve withdrawal request and send to Fireblocks
   * CRITICAL: Protected by distributed lock to prevent double-processing
   */
  async approveWithdrawRequest(
    id: string,
    comment?: string,
  ): Promise<{ success: boolean; message: string; request: any }> {
    // CRITICAL SECURITY FIX: Acquire distributed lock to prevent concurrent approval
    const lockResource = LockKeyBuilder.paymentWithdrawal(id);

    try {
      return await this.distributedLockService.withLock(
        lockResource,
        LockTTL.EXTERNAL_API_CALL, // Fireblocks API call
        async () => {
          this.logger.log(`[LOCK ACQUIRED] Approving withdrawal request ${id}`);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Find and lock the withdrawal request
            const request = await queryRunner.manager.findOne(WithdrawRequestEntity, {
              where: { id },
              lock: { mode: 'pessimistic_write' },
            });

            if (!request) {
              throw new NotFoundException(`Withdrawal request with ID '${id}' not found`);
            }

            if (request.status !== WithdrawStatusEnum.PENDING) {
              throw new BadRequestException(
                `Cannot approve request with status '${request.status}'. Only PENDING requests can be approved.`,
              );
            }

            this.logger.log(`Approving withdrawal request ${id}`, {
              userId: request.userId,
              amount: request.amount,
              asset: request.asset,
              toAddress: request.toAddress,
            });

            // Update request status to APPROVED
            request.status = WithdrawStatusEnum.APPROVED;
            request.approvedAt = new Date();

            await queryRunner.manager.save(request);

            // Send to Fireblocks immediately (rollback on any failure)
            await this.sendWithdrawRequestToFireblocks(request);

            // Update status to PROCESSING after successful submission to Fireblocks
            request.status = WithdrawStatusEnum.PROCESSING;
            await queryRunner.manager.save(request);

            this.logger.log(`Successfully sent withdrawal request ${id} to Fireblocks`);

            await queryRunner.commitTransaction();

            this.logger.log(`[LOCK RELEASING] Successfully approved withdrawal request ${id}`);

            // Send email notification
            await this.emailNotificationService.sendWithdrawalNotification(request.userId, {
              requestId: request.id,
              asset: request.asset,
              amount: request.amount,
              networkFee: request.estimateNetworkFee,
              toAddress: request.toAddress,
              status: WithdrawStatusEnum.APPROVED,
            });

            return {
              success: true,
              message: comment
                ? `Withdrawal request approved with comment: ${comment}`
                : 'Withdrawal request approved and sent to Fireblocks',
              request: instanceToPlain(request),
            };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to approve withdrawal request ${id}:`, error);
            throw error;
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for withdrawal approval', {
          id,
          lockResource,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  /**
   * ADMIN: Reject withdrawal request and refund balance
   * CRITICAL: Protected by distributed lock to prevent double-processing
   */
  async rejectWithdrawRequest(
    id: string,
    reason: string,
  ): Promise<{ success: boolean; message: string; request: any }> {
    // CRITICAL SECURITY FIX: Acquire distributed lock to prevent concurrent rejection
    const lockResource = LockKeyBuilder.paymentWithdrawal(id);

    return this.distributedLockService.withLock(
      lockResource,
      LockTTL.STANDARD_OPERATION, // Payment operation with DB updates
      async () => {
        this.logger.log(`[LOCK ACQUIRED] Rejecting withdrawal request ${id}`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Find and lock the withdrawal request
          const request = await queryRunner.manager.findOne(WithdrawRequestEntity, {
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });

          if (!request) {
            throw new NotFoundException(`Withdrawal request with ID '${id}' not found`);
          }

          if (request.status !== WithdrawStatusEnum.PENDING) {
            throw new BadRequestException(
              `Cannot reject request with status '${request.status}'. Only PENDING requests can be rejected.`,
            );
          }

          this.logger.log(`Rejecting withdrawal request ${id}`, {
            userId: request.userId,
            amount: request.amount,
            asset: request.asset,
            networkFee: request.estimateNetworkFee,
            reason,
          });

          // Calculate refund amount (original amount + estimated network fee)
          const originalAmount = new BigNumber(request.amount);
          const networkFee = request.estimateNetworkFee
            ? new BigNumber(request.estimateNetworkFee)
            : new BigNumber(0);

          const refundAmount = originalAmount.plus(networkFee);

          this.logger.debug(
            `Refund calculation: ${originalAmount.toString()} + ${networkFee.toString()} = ${refundAmount.toString()}`,
          );

          // Refund the withdrawn amount + network fee back to user's balance
          // NOTE: Using ROLLBACK_WITHDRAW instead of REFUND
          // REFUND is specifically for canceling BET operations (bet refunds)
          // ROLLBACK_WITHDRAW is for returning failed/rejected withdrawal amounts
          const refundResult = await this.balanceService.updateBalance(
            {
              operation: BalanceOperationEnum.ROLLBACK_WITHDRAW,
              operationId: randomUUID(),
              userId: request.userId,
              amount: refundAmount,
              asset: request.asset as AssetTypeEnum,
              description: `Withdrawal refund: ${reason}`,
              metadata: {
                originalWithdrawRequestId: request.id,
                rejectionReason: reason,
              },
            },
            queryRunner,
          );

          if (!refundResult.success) {
            throw new InternalServerErrorException(
              `Failed to refund balance: ${refundResult.error}`,
            );
          }

          // Update request status to REJECTED
          request.status = WithdrawStatusEnum.REJECTED;
          request.failureReason = reason;

          await queryRunner.manager.save(request);
          await queryRunner.commitTransaction();

          this.logger.log(`[LOCK RELEASING] Successfully rejected withdrawal request ${id}`);

          // Send email notification
          await this.emailNotificationService.sendWithdrawalNotification(request.userId, {
            requestId: request.id,
            asset: request.asset,
            amount: request.amount,
            networkFee: request.estimateNetworkFee,
            toAddress: request.toAddress,
            status: WithdrawStatusEnum.REJECTED,
            reason,
          });

          return {
            success: true,
            message: `Withdrawal request rejected and balance refunded. Reason: ${reason}`,
            request: instanceToPlain(request),
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`Failed to reject withdrawal request ${id}:`, error);
          throw error;
        } finally {
          await queryRunner.release();
        }
      },
    );
  }

  /**
   * Send withdrawal request to Fireblocks
   */
  private async sendWithdrawRequestToFireblocks(request: WithdrawRequestEntity): Promise<void> {
    const apiUrl = this.configService.get<string>('fireblocks.apiUrl') || '';
    const isTestnet = apiUrl.includes('sandbox');
    const fireblocksAssetId = getFireblocksAssetId(request.asset as AssetTypeEnum, isTestnet);
    const asset = request.asset as AssetTypeEnum;
    const feeLevel = this.getFeeLevelForAsset(asset);

    this.logger.log(`Sending withdrawal to Fireblocks`, {
      requestId: request.id,
      userId: request.userId,
      amount: request.amount,
      asset: request.asset,
      fireblocksAssetId,
      toAddress: request.toAddress,
      feeLevel,
      isTestnet,
    });

    try {
      const fireblocks = this.fireblocksService.getFireblocksSDK();

      // Create withdrawal transaction in Fireblocks
      const withdrawalRequest = {
        assetId: fireblocksAssetId,
        amount: request.amount,
        feeLevel: feeLevel,
        source: {
          type: 'VAULT_ACCOUNT',
          id: this.fireblocksService.getVaultAccountId(),
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          oneTimeAddress: {
            address: request.toAddress,
          },
        },
        customerRefId: request.id, // Link back to our withdrawal request
        note: `Withdrawal for user ${request.userId}`,
      };

      const response = await fireblocks.transactions.createTransaction({
        transactionRequest: withdrawalRequest as any,
      });

      this.logger.log(`Fireblocks withdrawal transaction created`, {
        requestId: request.id,
        fireblocksTransactionId: response.data?.id,
        status: response.data?.status,
        feeLevel: feeLevel,
      });
    } catch (error) {
      this.logger.error(`Fireblocks withdrawal failed for request ${request.id}:`, error);
      throw error;
    }
  }

  /**
   * Find user by deposit address and asset ID
   */
  public async findUserByDepositAddress(
    address: string,
    fbAssetId: string,
  ): Promise<string | null> {
    this.logger.log(`Finding user by deposit address: ${address} for asset: ${fbAssetId}`);
    const asset = this.mapFireblocksIdToAssetType(fbAssetId);
    this.logger.log(`Mapped Fireblocks asset ID ${fbAssetId} to internal asset ${asset}`);
    const wallet = await this.walletService.findWalletByAddress(address, asset);
    this.logger.log(
      wallet
        ? `Found wallet for address ${address}: userId=${wallet.userId}`
        : `No wallet found for address ${address} and asset ${asset}`,
    );
    return wallet ? wallet.userId : null;
  }

  /**
   * Find user by deposit address for any supported cryptocurrency
   */
  public async findUserByDepositAddressAnyAsset(
    address: string,
  ): Promise<{ userId: string; asset: AssetTypeEnum } | null> {
    this.logger.log(`Finding user by deposit address: ${address} for any supported asset`);

    // Try to find wallet for each supported asset
    for (const asset of Object.values(AssetTypeEnum)) {
      const wallet = await this.walletService.findWalletByAddress(address, asset);
      if (wallet) {
        this.logger.log(
          `Found wallet for address ${address}: userId=${wallet.userId}, asset=${asset}`,
        );
        return { userId: wallet.userId, asset };
      }
    }

    this.logger.log(`No wallet found for address ${address} in any supported asset`);
    return null;
  }

  /**
   * Handle deposit event received via webhook with user identification callback
   * CRITICAL: This method should be called WITHIN a distributed lock (acquired in controller)
   * User identification happens via callback to prevent TOCTOU race condition
   * @param data - Fireblocks event data
   * @param identifyUser - Callback function to identify user
   */
  public async handleDepositEventWithUserIdentification(
    data: FireblocksEventData,
    identifyUser: (data: FireblocksEventData) => Promise<string | null>,
  ): Promise<void> {
    // NOTE: Distributed lock is acquired in the webhook controller before calling this method
    // This ensures the duplicate check and all processing happens atomically
    this.logger.log(`Processing deposit for txId: ${data.id}`);

    // CRITICAL: User identification happens early
    const userId = await identifyUser(data);

    if (!userId) {
      this.logger.warn(`Could not identify user for deposit txId ${data.id}, skipping processing`);
      return;
    }

    this.logger.log(`Identified user ${userId} for txId: ${data.id}`);

    // Determine the deposit address - try all possible places
    let address = '';
    if (data.destination?.oneTimeAddress?.address) {
      address = data.destination.oneTimeAddress.address; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
      this.logger.log(`Found address in oneTimeAddress: ${address}`);
    } else if (data.destinationAddress) {
      address = data.destinationAddress; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
      this.logger.log(`Found address in root destinationAddress: ${address}`);
    }

    if (!address) {
      this.logger.warn(`No address found in deposit event data for txId: ${data.id}`);
    }

    // Map Fireblocks data to internal types
    const asset = this.mapFireblocksIdToAssetType(data.assetId);
    const status = this.mapFireblocksStatus(data.status);
    const amount = data.amount.toString();
    const fbCreatedAt = new Date(data.createdAt);

    // Extract USD amount and transaction fee
    const amountUSD = data.amountUSD?.toString() || null;
    const networkFee = data.networkFee?.toString() || null;
    const txHash = data.txHash || null;

    this.logger.log(
      `Processing transaction: id=${data.id}, user=${userId}, status=${status}, amount=${amount}, asset=${asset}, address=${address}, amountUSD=${amountUSD}, networkFee=${networkFee}, txHash=${txHash}`,
    );

    // Use database transaction for atomic operations
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if transaction exists and get with lock to prevent race conditions
      const existingTx = await queryRunner.manager.findOne(TransactionEntity, {
        where: { id: data.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingTx?.isCredited && status === TransactionStatusEnum.COMPLETED) {
        this.logger.log(`Transaction ${data.id} already credited, skipping`);
        await queryRunner.rollbackTransaction();
        return;
      }

      // Upsert transaction with txHash
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(TransactionEntity)
        .values([
          {
            id: data.id,
            userId,
            type: TransactionTypeEnum.DEPOSIT,
            status,
            amount,
            asset,
            address,
            isCredited: false,
            fbCreatedAt,
            amountUSD,
            networkFee,
            txHash,
          },
        ])
        .orUpdate({
          conflict_target: ['id'],
          overwrite: ['status', 'fbCreatedAt', 'amountUSD', 'networkFee', 'txHash'],
        })
        .execute();

      // Credit if completed and not yet credited
      if (status === TransactionStatusEnum.COMPLETED && !existingTx?.isCredited) {
        this.logger.log(`Transaction ${data.id} is COMPLETED, crediting wallet...`);

        // Get updated transaction with lock
        const tx = await queryRunner.manager.findOne(TransactionEntity, {
          where: { id: data.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (tx && !tx.isCredited) {
          this.logger.log(`Crediting wallet for user ${userId}, asset ${asset}, amount ${amount}`);

          // Credit wallet through balance service
          await this.creditWallet(userId, asset, amount);

          // Mark as credited
          tx.isCredited = true;
          tx.creditedAt = new Date();
          await queryRunner.manager.save(tx);

          this.logger.log(`Wallet credited and transaction ${data.id} marked as credited`);
        } else if (tx?.isCredited) {
          this.logger.log(`Transaction ${data.id} already credited during processing, skipping`);
        } else {
          this.logger.warn(`Transaction ${data.id} not found after insert, cannot credit`);
        }

        // Send deposit completed email
        await this.emailNotificationService.sendDepositNotification(userId, {
          transactionId: data.id,
          asset: asset,
          amount: amount,
          address: address,
          status: TransactionStatusEnum.COMPLETED,
          networkFee: networkFee || undefined,
          txHash: data.txHash,
        });
      } else if (status === TransactionStatusEnum.FAILED) {
        // Send deposit failed email
        await this.emailNotificationService.sendDepositNotification(userId, {
          transactionId: data.id,
          asset: asset,
          amount: amount,
          address: address,
          status: TransactionStatusEnum.FAILED,
          networkFee: networkFee || undefined,
        });
        this.logger.log(`Transaction ${data.id} status is FAILED, NO crediting`);
      } else if (status === TransactionStatusEnum.CONFIRMED) {
        // Send deposit confirmed email
        await this.emailNotificationService.sendDepositNotification(userId, {
          transactionId: data.id,
          asset: asset,
          amount: amount,
          address: address,
          status: TransactionStatusEnum.CONFIRMED,
          networkFee: networkFee || undefined,
          txHash: data.txHash,
        });
        this.logger.log(`Transaction ${data.id} status is ${status}, not crediting yet`);
      } else {
        this.logger.log(`Transaction ${data.id} status is ${status}, not crediting yet`);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully processed deposit event for txId ${data.id}`);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing deposit event for txId ${data.id}: ${errorMessage}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handle deposit event received via webhook (legacy method)
   * DEPRECATED: Use handleDepositEventWithUserIdentification instead
   * This method is kept for backward compatibility but should not be used for new code
   */
  public async handleDepositEvent(userId: string, data: FireblocksEventData): Promise<void> {
    // Wrapper that calls the new method with a simple callback
    return this.handleDepositEventWithUserIdentification(data, () => Promise.resolve(userId));
  }

  /**
   * Handle withdrawal event received via webhook
   * CRITICAL: This method should be called WITHIN a distributed lock (acquired in controller)
   */
  public async handleWithdrawalEvent(data: FireblocksEventData): Promise<void> {
    // NOTE: Distributed lock is acquired in the webhook controller before calling this method
    this.logger.log(`Processing withdrawal event for txId: ${data.id}`);

    // Record withdrawal transaction in transactions table
    if (data.customerRefId) {
      const request = await this.withdrawRequestRepo.findOne({
        where: { id: data.customerRefId },
      });
      if (request) {
        const asset = this.mapFireblocksIdToAssetType(data.assetId);
        const txStatus = this.mapFireblocksStatus(data.status);
        const amount = data.amount.toString();
        const address = data.destination?.oneTimeAddress?.address || data.destinationAddress || '';
        const fbCreatedAt = new Date(data.createdAt);

        // Extract USD amount and transaction fee
        const amountUSD = data.amountUSD?.toString() || null;
        const networkFee = data.networkFee?.toString() || null;
        const txHash = data.txHash || null;

        this.logger.log(
          `Withdrawal event details: status=${txStatus}, amount=${amount}, amountUSD=${amountUSD}, networkFee=${networkFee}, txHash=${txHash}`,
        );

        await this.transactionRepository
          .createQueryBuilder()
          .insert()
          .into(TransactionEntity)
          .values([
            {
              id: data.id,
              userId: request.userId,
              type: TransactionTypeEnum.WITHDRAWAL,
              status: txStatus,
              amount,
              asset,
              address,
              isCredited: false,
              fbCreatedAt,
              amountUSD,
              networkFee,
              txHash,
            },
          ])
          .orUpdate({
            conflict_target: ['id'],
            overwrite: ['status', 'fbCreatedAt', 'amountUSD', 'networkFee', 'txHash'],
          })
          .execute();
      }
    }

    // Update withdrawal request status from webhook data
    const requestId = data.customerRefId;
    if (!requestId) {
      this.logger.log('No customerRefId in withdrawal event');
      return;
    }

    const request = await this.withdrawRequestRepo.findOne({ where: { id: requestId } });
    if (!request) {
      this.logger.warn(`Withdrawal request not found for id ${requestId}`);
      return;
    }

    const originalStatus = request.status;
    let statusChanged = false;

    // Map Fireblocks status to internal status
    switch (data.status) {
      case 'COMPLETED':
        request.status = WithdrawStatusEnum.SENT;
        statusChanged = true;
        break;
      case 'CANCELLED':
        request.status = WithdrawStatusEnum.REJECTED;
        statusChanged = true;
        break;
      case 'FAILED':
        request.status = WithdrawStatusEnum.FAILED;
        statusChanged = true;
        break;
      case 'BROADCASTING':
      case 'CONFIRMING':
        // Keep current status for intermediate Fireblocks states
        // Don't change status - withdrawal is still processing
        this.logger.log(`Withdrawal ${requestId} is in intermediate status: ${data.status}`);
        break;
      default:
        // For unknown statuses, log but don't change current status
        this.logger.warn(
          `Unknown Fireblocks status '${data.status}' for withdrawal ${requestId}, keeping current status: ${request.status}`,
        );
    }

    // Update txHash if provided
    if (data.txHash) {
      request.txId = data.txHash;
      statusChanged = true; // Save to record txHash
    }

    // Only save if status or txHash changed
    if (statusChanged) {
      await this.withdrawRequestRepo.save(request);

      // Send email notification for status changes
      if (
        request.status === WithdrawStatusEnum.SENT ||
        request.status === WithdrawStatusEnum.FAILED
      ) {
        await this.emailNotificationService.sendWithdrawalNotification(request.userId, {
          requestId: request.id,
          transactionId: data.id,
          asset: request.asset,
          amount: request.amount,
          networkFee: request.estimateNetworkFee,
          toAddress: request.toAddress,
          status: request.status,
          txHash: data.txHash,
        });
      }

      this.logger.log(
        `Withdrawal ${requestId} status updated: ${originalStatus} → ${request.status}${data.txHash ? `, txHash: ${data.txHash}` : ''}`,
      );
    } else {
      this.logger.log(`No changes for withdrawal ${requestId}`);
    }
  }

  async getFireblocksTransaction(txId: string, userId: string): Promise<TransactionResponseDto> {
    try {
      // First, verify the user owns this transaction
      const userTransaction = await this.transactionRepository.findOne({
        where: {
          id: txId,
          userId: userId,
        },
      });

      if (!userTransaction) {
        this.logger.warn(
          `User ${userId} attempted to access transaction ${txId} without ownership`,
        );
        throw new NotFoundException('Transaction not found or access denied');
      }

      const fireblocks = this.fireblocksService.getFireblocksSDK();

      const response = (await Promise.race([
        fireblocks.transactions.getTransaction({ txId }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ])) as { data: ExtendedTransactionResponse };

      const transaction = response.data;

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID '${txId}' not found`);
      }
      this.logger.debug('Fireblocks transaction response:', JSON.stringify(transaction, null, 2));

      // Map Fireblocks asset ID to internal asset type
      const asset = this.mapFireblocksIdToAssetType(transaction.assetId || '');

      // Helper function to convert null to undefined
      const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
        return value === null ? undefined : value;
      };

      // Enhanced sanitization function
      const sanitizePII = (text: string | null | undefined): string | undefined => {
        if (!text) return undefined;

        let sanitized = text;

        // Mask UUIDs - keep first 8 and last 8 characters
        sanitized = sanitized.replace(
          /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
          (uuid) => {
            const first8 = uuid.substring(0, 8);
            const last8 = uuid.substring(uuid.length - 8);
            return `${first8}...${last8}`;
          },
        );

        // Mask user_ and customer_ prefixes but keep the ID partially visible
        sanitized = sanitized
          .replace(
            /user_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,
            (match, uuid) => {
              const first8 = uuid.substring(0, 8);
              const last8 = uuid.substring(uuid.length - 8);
              return `user_${first8}...${last8}`;
            },
          )
          .replace(
            /customer_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,
            (match, uuid) => {
              const first8 = uuid.substring(0, 8);
              const last8 = uuid.substring(uuid.length - 8);
              return `customer_${first8}...${last8}`;
            },
          );

        // Also handle cases where it's just the prefix without full UUID
        sanitized = sanitized
          .replace(/user_[a-f0-9]+/gi, 'user_[MASKED]')
          .replace(/customer_[a-f0-9]+/gi, 'customer_[MASKED]')
          .trim();

        return sanitized || undefined;
      };

      // Transform the response to match our DTO
      const transactionResponse: TransactionResponseDto = {
        id: transaction.id || '',
        assetId: transaction.assetId || '',
        asset: asset,
        source: {
          id: transaction.source?.id || '',
          type: transaction.source?.type || '',
          name: transaction.source?.name || '',
          subType: transaction.source?.subType || '',
        },
        destination: {
          id: transaction.destination?.id || '',
          type: transaction.destination?.type || '',
          name: transaction.destination?.name || '',
          subType: transaction.destination?.subType || '',
        },
        requestedAmount: transaction.requestedAmount || '0',
        amount: transaction.amount || '0',
        netAmount: transaction.netAmount || '0',
        amountUSD: transaction.amountUSD || '0',
        fee: transaction.fee || '0',
        networkFee: transaction.networkFee || '0',
        createdAt: transaction.createdAt || 0,
        lastUpdated: nullToUndefined(transaction.lastUpdated),
        status: transaction.status || '',
        subStatus: nullToUndefined(transaction.subStatus),
        txHash: nullToUndefined(transaction.txHash),
        sourceAddress: nullToUndefined(transaction.sourceAddress),
        destinationAddress: nullToUndefined(transaction.destinationAddress),
        destinationAddressDescription: sanitizePII(transaction.destinationAddressDescription),
        destinationTag: nullToUndefined(transaction.destinationTag),
        note: sanitizePII(transaction.note),
        feeCurrency: nullToUndefined(transaction.feeCurrency),
        operation: nullToUndefined(transaction.operation),
        numOfConfirmations: nullToUndefined(transaction.numOfConfirmations),
        amountInfo: transaction.amountInfo
          ? {
              amount: transaction.amountInfo.amount || '0',
              requestedAmount: transaction.amountInfo.requestedAmount || '0',
              netAmount: transaction.amountInfo.netAmount || '0',
              amountUSD: transaction.amountInfo.amountUSD || '0',
            }
          : undefined,
        feeInfo: transaction.feeInfo
          ? {
              networkFee: transaction.feeInfo.networkFee || '0',
            }
          : undefined,
        blockInfo: transaction.blockInfo
          ? {
              blockHeight: nullToUndefined(transaction.blockInfo.blockHeight),
              blockHash: nullToUndefined(transaction.blockInfo.blockHash),
            }
          : undefined,
        assetType: nullToUndefined(transaction.assetType),
        customerRefId: nullToUndefined(transaction.customerRefId),
        index: nullToUndefined(transaction.index),
      };

      this.logger.log(`User ${userId} successfully accessed transaction ${txId}`);
      return transactionResponse;
    } catch (error: any) {
      this.logger.error(`Failed to get Fireblocks transaction ${txId} for user ${userId}:`, error);

      if (error?.response?.statusCode === 404) {
        throw new NotFoundException(`Transaction with ID '${txId}' not found`);
      }

      // Don't expose internal error details to client
      if (error instanceof NotFoundException) {
        throw error; // Re-throw our custom not found errors
      }

      throw new InternalServerErrorException('Failed to retrieve transaction details');
    }
  }

  /**
   * Get transactions for a specific user (all statuses)
   */
  async getUserTransactions(
    userId: string,
    query: GetUserTransactionsQueryDto,
  ): Promise<UserTransactionsResponseDto> {
    const {
      page = 1,
      limit = 20,
      type,
      asset,
      status,
      orderBy = 'createdAt',
      orderDirection = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    // Build query for transactions for specific user (all statuses)
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId });

    // Apply filters if provided
    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    if (asset) {
      queryBuilder.andWhere('transaction.asset = :asset', { asset });
    }

    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }

    // Handle ordering
    const orderField = orderBy === 'amount' ? 'transaction.amount' : 'transaction.createdAt';
    const order = orderDirection === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(orderField, order);

    // Get transactions with pagination
    const [transactions, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

    // Transform entities to DTOs
    const transactionDtos: UserTransactionItemDto[] = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: tx.amount,
      asset: tx.asset,
      address: tx.address || undefined,
      txHash: tx.txHash || undefined,
      amountUSD: tx.amountUSD || undefined,
      networkFee: tx.networkFee || undefined,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      fbCreatedAt: tx.fbCreatedAt || undefined,
      creditedAt: tx.creditedAt || undefined,
      isCredited: tx.isCredited,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      transactions: transactionDtos,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getCurrencyRates(
    baseCurrency: CurrencyEnum = CurrencyEnum.USD,
  ): Promise<CurrencyRatesResponseDto> {
    const now = new Date();

    // If a base currency is USD, use the standard cache
    if (baseCurrency === CurrencyEnum.USD) {
      // Check if a cache is valid
      if (
        this.currencyRatesCache &&
        this.cacheTimestamp &&
        now.getTime() - this.cacheTimestamp.getTime() < this.CACHE_TTL_MINUTES * 60 * 1000
      ) {
        return this.currencyRatesCache;
      }

      // Fetch fresh rates
      const rates = await this.cryptoConverterService.getAllRatesInUsd();

      const response: CurrencyRatesResponseDto = {
        rates,
        lastUpdated: now.toISOString(),
        baseCurrency: CurrencyEnum.USD,
      };

      // Update cache
      this.currencyRatesCache = response;
      this.cacheTimestamp = now;

      return response;
    } else {
      // For non-USD base currencies, we need to convert the rates
      // First, get the USD rates
      const usdRates = await this.getCurrencyRates(CurrencyEnum.USD);

      // Get the fiat exchange rates
      const fiatRates = await this.fiatRateService.getFiatRates();

      // If the base currency is not in the fiat rates, return USD rates
      if (!fiatRates[baseCurrency]) {
        this.logger.warn(`Base currency ${baseCurrency} not found in fiat rates, using USD`);
        return usdRates;
      }

      // Convert all rates to the base currency
      const baseRate = fiatRates[baseCurrency];
      const convertedRates: Record<string, number> = {};

      Object.entries(usdRates.rates).forEach(([asset, usdRate]) => {
        // Convert USD rate to base currency rate
        convertedRates[asset] = usdRate * baseRate;
      });

      return {
        rates: convertedRates,
        lastUpdated: now.toISOString(),
        baseCurrency,
      };
    }
  }

  async getMultiCurrencyRates(): Promise<MultiCurrencyRatesResponseDto> {
    const now = new Date();

    // Check if cache is valid
    if (
      this.multiCurrencyRatesCache &&
      this.multiCacheTimestamp &&
      now.getTime() - this.multiCacheTimestamp.getTime() < this.CACHE_TTL_MINUTES * 60 * 1000
    ) {
      return this.multiCurrencyRatesCache;
    }

    // Fetch fresh crypto rates in USD
    const cryptoRatesUsd = await this.cryptoConverterService.getAllRatesInUsd();

    // Get fiat exchange rates
    const fiatRates = await this.fiatRateService.getFiatRates();

    // Convert crypto rates to multiple fiat currencies
    const rates: Record<string, Record<string, number>> = {};
    const availableCurrencies: string[] = ['USD'];

    Object.entries(cryptoRatesUsd).forEach(([asset, usdRate]) => {
      rates[asset] = {};

      // Add USD rate (base)
      rates[asset].USD = usdRate;

      // Convert to all available fiat currencies
      Object.entries(fiatRates).forEach(([currency, fiatRate]) => {
        if (currency !== 'USD') {
          // Skip USD as it's already added
          // Use proper decimal arithmetic to avoid floating-point precision errors
          const preciseRate = new BigNumber(usdRate).multipliedBy(new BigNumber(fiatRate));
          rates[asset][currency] = preciseRate.toNumber();
          if (!availableCurrencies.includes(currency)) {
            availableCurrencies.push(currency);
          }
        }
      });
    });

    const response: MultiCurrencyRatesResponseDto = {
      rates,
      lastUpdated: now.toISOString(),
      availableCurrencies,
    };

    // Update cache
    this.multiCurrencyRatesCache = response;
    this.multiCacheTimestamp = now;

    return response;
  }

  async testCurrencyRatesUpdate(): Promise<{ success: boolean; message: string; rates: any }> {
    await this.getCurrencyRates();
    this.logger.log('Currency rates updated successfully.');
    return {
      success: true,
      message: 'Currency rates updated successfully.',
      rates: this.currencyRatesCache!,
    };
  }
}
