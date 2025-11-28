/* eslint-disable */
import { TransactionEntity } from '@zetik/shared-entities';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { commonConfig } from '../../config/common.config';
import { fireblocksConfig } from '../config/fireblocks.config';
import { PaymentsService } from '../payments.service';
import { FireblocksWebhookController } from './fireblocks-webhook.controller';

// Mock the external dependencies
jest.mock('../../config/common.config');
jest.mock('../config/fireblocks.config');
jest.mock('crypto');

describe('FireblocksWebhookController', () => {
  let controller: FireblocksWebhookController;
  let paymentsService: PaymentsService;

  // Mock data
  const mockValidTransactionData = {
    id: 'test-transaction-id',
    assetId: 'BTC_TEST',
    status: 'COMPLETED',
    amount: 0.1,
    createdAt: Date.now(),
    source: { type: 'UNKNOWN', name: 'External' },
    destination: {
      name: 'user_123e4567-e89b-12d3-a456-426614174000',
      oneTimeAddress: { address: 'tb1qtestaddress123' },
    },
  };

  const mockValidWebhookPayload = {
    eventType: 'transaction.status.updated',
    data: mockValidTransactionData,
  };

  const mockValidSignature = 'valid-signature-base64';

  beforeEach(async () => {
    // Mock configs
    (commonConfig as unknown as jest.Mock).mockReturnValue({
      nodeEnv: 'development',
    });

    (fireblocksConfig as unknown as jest.Mock).mockReturnValue({
      webhookPublicKey: 'prod-public-key',
      webhookSandboxPublicKey: 'sandbox-public-key',
    });

    // Mock crypto
    (crypto.createVerify as jest.Mock).mockReturnValue({
      write: jest.fn(),
      end: jest.fn(),
      verify: jest.fn().mockReturnValue(true),
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FireblocksWebhookController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            findUserByDepositAddress: jest.fn(),
            handleDepositEvent: jest.fn(),
            handleDepositEventWithUserIdentification: jest.fn(),
            handleWithdrawalEvent: jest.fn(),
          },
        },
        {
          provide: DistributedLockService,
          useValue: {
            withLock: jest.fn((resource, ttl, operation) => operation()),
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FireblocksWebhookController>(FireblocksWebhookController);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  describe('handleWebhook', () => {
    it('should verify webhook signatures correctly', async () => {
      const result = await controller.handleWebhook(mockValidWebhookPayload, mockValidSignature);

      expect(result).toEqual({ status: 'success' });
      expect(crypto.createVerify).toHaveBeenCalledWith('RSA-SHA512');
    });

    it('should reject invalid signatures', async () => {
      (crypto.createVerify as jest.Mock).mockReturnValue({
        write: jest.fn(),
        end: jest.fn(),
        verify: jest.fn().mockReturnValue(false),
      });

      await expect(
        controller.handleWebhook(mockValidWebhookPayload, 'invalid-signature'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject missing signatures', async () => {
      await expect(controller.handleWebhook(mockValidWebhookPayload, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle all three user detection methods', async () => {
      const validUserId = '123e4567-e89b-12d3-a456-426614174000';

      // Test 1: Destination name method
      const destinationNamePayload = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          destination: { name: `user_${validUserId}` },
          source: { type: 'UNKNOWN', name: 'External' },
        },
      };

      (paymentsService.handleDepositEvent as jest.Mock).mockResolvedValue(undefined);

      await controller.handleWebhook(destinationNamePayload, mockValidSignature);

      expect(paymentsService.handleDepositEvent).toHaveBeenCalledWith(
        validUserId,
        expect.objectContaining({
          id: 'test-transaction-id',
          assetId: 'BTC_TEST',
        }),
      );

      // Test 2: OneTimeAddress method
      (paymentsService.findUserByDepositAddress as jest.Mock).mockResolvedValue(validUserId);

      const oneTimeAddressPayload = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          destination: {
            oneTimeAddress: { address: 'tb1qtestaddress456' },
          },
          source: { type: 'UNKNOWN', name: 'External' },
        },
      };

      await controller.handleWebhook(oneTimeAddressPayload, mockValidSignature);

      expect(paymentsService.findUserByDepositAddress).toHaveBeenCalledWith(
        'tb1qtestaddress456',
        'BTC_TEST',
      );

      // Test 3: DestinationAddressDescription method
      const descriptionPayload = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          destinationAddressDescription: `user_${validUserId}`,
          source: { type: 'UNKNOWN', name: 'External' },
        },
      };

      await controller.handleWebhook(descriptionPayload, mockValidSignature);

      expect(paymentsService.handleDepositEvent).toHaveBeenCalledWith(
        validUserId,
        expect.any(Object),
      );
    });

    it('should handle malformed webhook data', async () => {
      const malformedPayloads = [
        null,
        undefined,
        'invalid-string',
        { invalid: 'structure' },
        { eventType: 123 }, // Wrong type
        { eventType: 'transaction.status.updated', data: 'invalid' },
        { eventType: 'transaction.status.updated', data: { id: 123 } }, // Wrong ID type
        { eventType: 'transaction.status.updated', data: { id: 'test', assetId: 456 } }, // Wrong assetId type
      ];

      for (const payload of malformedPayloads) {
        await expect(controller.handleWebhook(payload as any, mockValidSignature)).rejects.toThrow(
          UnauthorizedException,
        );
      }
    });

    it('should handle withdrawal events correctly', async () => {
      const withdrawalPayload = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          source: { type: 'VAULT_ACCOUNT', name: 'withdraw_hot' },
          customerRefId: 'withdrawal-123',
        },
      };

      await controller.handleWebhook(withdrawalPayload, mockValidSignature);

      expect(paymentsService.handleWithdrawalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { type: 'VAULT_ACCOUNT', name: 'withdraw_hot' },
        }),
      );
    });

    it('should handle invalid user IDs gracefully', async () => {
      const invalidUserIdPayload = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          destination: { name: 'user_invalid-uuid-format' },
          source: { type: 'UNKNOWN', name: 'External' },
        },
      };

      await controller.handleWebhook(invalidUserIdPayload, mockValidSignature);

      // Should not call handleDepositEvent with invalid user ID
      expect(paymentsService.handleDepositEvent).not.toHaveBeenCalled();
    });

    it('should handle errors in payment service gracefully', async () => {
      (paymentsService.handleDepositEvent as jest.Mock).mockRejectedValue(
        new Error('Service error'),
      );

      const result = await controller.handleWebhook(mockValidWebhookPayload, mockValidSignature);

      // Should return error response but not throw
      expect(result).toEqual({
        status: 'error',
        message: 'Error processing webhook, but received',
      });
    });

    it('should convert null values to undefined in payload sanitization', async () => {
      const payloadWithNulls = {
        eventType: 'transaction.status.updated',
        data: {
          ...mockValidTransactionData,
          customerRefId: null,
          txHash: null,
          source: null,
          destination: null,
        },
      };

      await controller.handleWebhook(payloadWithNulls, mockValidSignature);

      // The service should receive data with undefined instead of null
      expect(paymentsService.handleDepositEvent).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        expect.objectContaining({
          customerRefId: undefined,
          txHash: undefined,
          source: undefined,
          destination: undefined,
        }),
      );
    });

    it('should ignore non-transaction events', async () => {
      const nonTransactionPayload = {
        eventType: 'vault.account.added',
        data: { someOtherData: 'value' },
      };

      const result = await controller.handleWebhook(
        nonTransactionPayload as any,
        mockValidSignature,
      );

      expect(result).toEqual({ status: 'success' });
      // Should not call any payment service methods
      expect(paymentsService.handleDepositEvent).not.toHaveBeenCalled();
      expect(paymentsService.handleWithdrawalEvent).not.toHaveBeenCalled();
    });
  });

  describe('signature verification', () => {
    it('should handle crypto errors gracefully', async () => {
      (crypto.createVerify as jest.Mock).mockImplementation(() => {
        throw new Error('Crypto error');
      });

      const result = await controller['verifySignature']('data', 'signature', 'public-key');

      expect(result).toBe(false);
    });
  });

  describe('user ID validation', () => {
    it('should validate correct UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '00000000-0000-0000-0000-000000000000',
      ];

      validUUIDs.forEach((uuid) => {
        expect(controller['isValidUserId'](uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123e4567-e89b-12d3-a456-42661417400', // too short
        '123e4567-e89b-12d3-a456-4266141740000', // too long
        '123e4567-e89b-12d3-a456_426614174000', // invalid character
        '',
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(controller['isValidUserId'](uuid)).toBe(false);
      });
    });
  });

  describe('environment configuration', () => {
    it('should use production public key in production', () => {
      (commonConfig as unknown as jest.Mock).mockReturnValue({
        nodeEnv: 'production',
      });

      const mockDistributedLockService = {
        withLock: jest.fn((resource, ttl, operation) => operation()),
      } as any;

      const mockTransactionRepository = {
        findOne: jest.fn(),
      } as any;

      const prodController = new FireblocksWebhookController(
        paymentsService,
        mockDistributedLockService,
        mockTransactionRepository,
      );

      // Access private property for testing
      expect(prodController['webhookPublicKey']).toBe('prod-public-key');
    });

    it('should use sandbox public key in development', () => {
      (commonConfig as unknown as jest.Mock).mockReturnValue({
        nodeEnv: 'development',
      });

      const mockDistributedLockService = {
        withLock: jest.fn((resource, ttl, operation) => operation()),
      } as any;

      const mockTransactionRepository = {
        findOne: jest.fn(),
      } as any;

      const devController = new FireblocksWebhookController(
        paymentsService,
        mockDistributedLockService,
        mockTransactionRepository,
      );

      expect(devController['webhookPublicKey']).toBe('sandbox-public-key');
    });
  });
});
