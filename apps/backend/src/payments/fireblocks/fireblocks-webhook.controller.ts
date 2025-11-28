import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from '@zetik/shared-entities';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { AlreadyProcessedException } from '../../common/exceptions/already-processed.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { commonConfig } from '../../config/common.config';
import { fireblocksConfig } from '../config/fireblocks.config';
import { PaymentsService } from '../payments.service';

const FIREBLOCKS_WEBHOOK_EVENTS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_STATUS_UPDATED: 'transaction.status.updated',
} as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_ID_PREFIX = 'user_';

// Define interface that exactly matches FireblocksEventData
interface ValidatedFireblocksData {
  id: string;
  assetId: string;
  status: string;
  amount: number;
  createdAt: number;
  customerRefId?: string; // Only string or undefined, no null
  txHash?: string; // Only string or undefined, no null
  numOfConfirmations?: number;
  amountUSD?: number;
  networkFee?: number;
  source?: { type?: string; name?: string };
  destination?: {
    type?: string;
    name?: string;
    oneTimeAddress?: { address?: string };
  };
  destinationAddress?: string;
  destinationAddressDescription?: string;
}

interface FireblocksWebhookData {
  eventType: string;
  data?: any; // Use any for incoming data, we'll validate and convert it
}

@ApiTags('payments')
@Controller('payments/fireblocks-webhook')
export class FireblocksWebhookController {
  private readonly logger = new Logger(FireblocksWebhookController.name);
  private readonly webhookPublicKey: string;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly distributedLockService: DistributedLockService,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {
    const env = commonConfig().nodeEnv;
    const fbConfig = fireblocksConfig();

    if (env === 'production') {
      this.webhookPublicKey = fbConfig.webhookPublicKey;
    } else {
      this.webhookPublicKey = fbConfig.webhookSandboxPublicKey;
    }
    this.logger.log(`Using Fireblocks webhook public key for environment: ${env}`);
  }

  @Post()
  @ApiOperation({ summary: 'Handle Fireblocks webhook notifications' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleWebhook(
    @Body() data: FireblocksWebhookData,
    @Headers('fireblocks-signature') signature?: string,
  ) {
    this.logger.log(`Received Fireblocks webhook: ${JSON.stringify(data)}`);

    // Comprehensive payload validation
    const validationResult = this.validateAndSanitizeWebhookPayload(data);
    if (!validationResult.isValid) {
      this.logger.error(`Invalid webhook payload: ${validationResult.error}`);
      throw new UnauthorizedException('Invalid payload');
    }

    const payload = JSON.stringify(data);
    if (!signature) {
      this.logger.error('Missing Fireblocks webhook signature');
      throw new UnauthorizedException('Missing signature');
    }

    if (!this.verifySignature(payload, signature, this.webhookPublicKey)) {
      this.logger.error('Invalid Fireblocks webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    try {
      if (
        data.eventType === FIREBLOCKS_WEBHOOK_EVENTS.TRANSACTION_CREATED ||
        data.eventType === FIREBLOCKS_WEBHOOK_EVENTS.TRANSACTION_STATUS_UPDATED
      ) {
        // Safe access to validated data
        const transactionData = validationResult.data;

        // Process deposits and withdrawals with user identification inside lock
        await this.processTransaction(transactionData);
      }

      return { status: 'success' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Error processing Fireblocks webhook: ${errorMessage}`, errorStack);

      // Only return success for known idempotent cases (already processed transactions)
      // This allows Fireblocks to acknowledge the webhook without retrying
      if (
        error instanceof AlreadyProcessedException ||
        errorMessage.includes('already processed')
      ) {
        return {
          status: 'success',
          note: 'Transaction already processed (idempotent retry)',
        };
      }

      // Re-throw all other errors so Fireblocks can retry
      // This ensures critical failures don't get silently ignored
      throw error;
    }
  }

  /**
   * Validate webhook payload and convert null values to undefined
   */
  private validateAndSanitizeWebhookPayload(
    data: any,
  ): { isValid: true; data: ValidatedFireblocksData } | { isValid: false; error: string } {
    // Check root level structure
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Webhook payload is not an object' };
    }

    if (typeof data.eventType !== 'string') {
      return { isValid: false, error: 'Webhook eventType is missing or invalid' };
    }

    if (!data.data || typeof data.data !== 'object') {
      return { isValid: false, error: 'Webhook data property is missing or invalid' };
    }

    const transactionData = data.data;

    // Validate required fields
    if (typeof transactionData.id !== 'string') {
      return { isValid: false, error: 'Transaction ID is missing or invalid' };
    }

    if (typeof transactionData.assetId !== 'string') {
      return { isValid: false, error: 'Transaction assetId is missing or invalid' };
    }

    if (typeof transactionData.status !== 'string') {
      return { isValid: false, error: 'Transaction status is missing or invalid' };
    }

    if (typeof transactionData.amount !== 'number') {
      return { isValid: false, error: 'Transaction amount is missing or invalid' };
    }

    if (typeof transactionData.createdAt !== 'number') {
      return { isValid: false, error: 'Transaction createdAt is missing or invalid' };
    }

    // Create sanitized data with null converted to undefined
    const sanitizedData: ValidatedFireblocksData = {
      id: transactionData.id,
      assetId: transactionData.assetId,
      status: transactionData.status,
      amount: transactionData.amount,
      createdAt: transactionData.createdAt,
      // Convert null to undefined for optional fields
      customerRefId:
        transactionData.customerRefId === null ? undefined : transactionData.customerRefId,
      txHash: transactionData.txHash === null ? undefined : transactionData.txHash,
      numOfConfirmations: transactionData.numOfConfirmations,
      amountUSD: transactionData.amountUSD,
      networkFee: transactionData.networkFee,
      source: transactionData.source === null ? undefined : transactionData.source,
      destination: transactionData.destination === null ? undefined : transactionData.destination,
      destinationAddress: transactionData.destinationAddress,
      destinationAddressDescription: transactionData.destinationAddressDescription,
    };

    return { isValid: true, data: sanitizedData };
  }

  /**
   * Process transaction event - deposits and withdrawals
   * CRITICAL: Protected by distributed lock with early duplicate check to prevent race conditions
   * All user identification for deposits happens inside the lock via callback
   */
  private async processTransaction(transactionData: ValidatedFireblocksData): Promise<void> {
    // CRITICAL SECURITY FIX: Acquire distributed lock BEFORE any processing
    // This prevents race conditions if duplicate webhooks arrive simultaneously
    const lockResource = LockKeyBuilder.paymentWebhook(transactionData.id);

    await this.distributedLockService.withLock(
      lockResource,
      LockTTL.EXTERNAL_API_CALL,
      async () => {
        this.logger.log(
          `[LOCK ACQUIRED] Processing webhook for transaction: ${transactionData.id}`,
        );

        // Early duplicate check - if transaction already exists and is credited, skip processing
        const existingTransaction = await this.transactionRepository.findOne({
          where: { id: transactionData.id },
        });

        if (existingTransaction?.isCredited) {
          this.logger.warn(
            `Transaction ${transactionData.id} already processed and credited, skipping webhook`,
          );
          // Throw AlreadyProcessedException to signal idempotent retry
          throw new AlreadyProcessedException(
            transactionData.id,
            `Transaction ${transactionData.id} already processed and credited`,
          );
        }

        // Log if transaction exists but not yet credited
        if (existingTransaction) {
          this.logger.debug(
            `Transaction ${transactionData.id} exists but not yet credited, continuing processing`,
          );
        }

        // Check if this is a withdrawal event
        if (
          transactionData.source?.type === 'VAULT_ACCOUNT' &&
          transactionData.source?.name === 'withdraw_hot'
        ) {
          await this.paymentsService.handleWithdrawalEvent(transactionData);
          this.logger.log(
            `[LOCK RELEASING] Completed withdrawal processing for ${transactionData.id}`,
          );
          return;
        }

        // For deposits, pass user identification as a callback to be executed inside the lock
        // This prevents TOCTOU race condition where duplicate webhooks could both identify
        // the user before acquiring the lock
        await this.paymentsService.handleDepositEventWithUserIdentification(
          transactionData,
          (data) => this.identifyUser(data),
        );

        this.logger.log(`[LOCK RELEASING] Completed deposit processing for ${transactionData.id}`);
      },
    );
  }

  /**
   * Identify user from transaction data
   */
  private async identifyUser(transactionData: ValidatedFireblocksData): Promise<string | null> {
    let userId: string | null = null;
    let address: string | undefined;

    this.logger.debug(`Destination data: ${JSON.stringify(transactionData.destination)}`);

    // First attempt: destination name user_{id}
    if (
      transactionData.source?.type === 'UNKNOWN' &&
      transactionData.source?.name === 'External' &&
      transactionData.destination?.name?.startsWith(USER_ID_PREFIX)
    ) {
      const extractedUserId = transactionData.destination.name.replace(USER_ID_PREFIX, '');
      if (UUID_REGEX.test(extractedUserId)) {
        userId = extractedUserId;
        this.logger.log(`Detected deposit user via destination name: ${userId}`);
      } else {
        this.logger.warn(`Invalid user ID format from destination name: ${extractedUserId}`);
      }
    }

    // Second attempt: look for oneTimeAddress in destination
    else if (transactionData.destination?.oneTimeAddress?.address) {
      address = transactionData.destination.oneTimeAddress.address; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
      userId = await this.paymentsService.findUserByDepositAddress(
        address,
        transactionData.assetId,
      );
      if (userId && UUID_REGEX.test(userId)) {
        this.logger.log(
          `Detected deposit user via oneTimeAddress: ${userId} for address ${address}`,
        );
      } else {
        this.logger.warn(`Invalid or missing user ID for oneTimeAddress: ${address}`);
        userId = null;
      }
    }

    // Third attempt: look for destinationAddressDescription
    else if (transactionData.destinationAddressDescription?.startsWith(USER_ID_PREFIX)) {
      const extractedUserId = transactionData.destinationAddressDescription.replace(
        USER_ID_PREFIX,
        '',
      );
      if (UUID_REGEX.test(extractedUserId)) {
        userId = extractedUserId;
        this.logger.log(`Detected deposit user via destinationAddressDescription: ${userId}`);
      } else {
        this.logger.warn(
          `Invalid user ID format from destinationAddressDescription: ${extractedUserId}`,
        );
      }
    }

    // Fallback: root-level destinationAddress
    else if (transactionData.destinationAddress) {
      address = transactionData.destinationAddress; // BUG! Removed ".toLowerCase()" - a valid asset address is case sensitive!
      userId = await this.paymentsService.findUserByDepositAddress(
        address,
        transactionData.assetId,
      );
      if (userId && UUID_REGEX.test(userId)) {
        this.logger.log(
          `Detected deposit user via destinationAddress: ${userId} for address ${address}`,
        );
      } else {
        this.logger.warn(`Invalid or missing user ID for destinationAddress: ${address}`);
        userId = null;
      }
    }

    // Validate userId before returning
    if (userId && UUID_REGEX.test(userId)) {
      return userId;
    } else {
      this.logger.warn(
        `Could not identify valid user for deposit. Address: ${address}, AssetId: ${transactionData.assetId}, ExtractedUserId: ${userId}`,
      );
      return null;
    }
  }

  private verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verifier = crypto.createVerify('RSA-SHA512');
      verifier.write(data);
      verifier.end();
      return verifier.verify(publicKey, signature, 'base64');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error verifying signature: ${errorMessage}`);
      return false;
    }
  }
}
