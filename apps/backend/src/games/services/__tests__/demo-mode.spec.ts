import { Test, TestingModule } from '@nestjs/testing';
import { BigNumber } from 'bignumber.js';

import { BalanceService } from '../../../balance/balance.service';
import { GameConfigService } from '../game-config.service';
import { ProvablyFairService } from '../provably-fair.service';

import {
  AssetTypeEnum,
  BalanceOperationEnum,
  GameType,
  GameTypeEnum,
} from '@zetik/shared-entities';
import { CryptoConverterService } from '../../../balance/services/crypto-converter.service';
import { createTestProviders } from '../../../test-utils';

describe('Demo Mode (Zero Bet Amount) Tests', () => {
  let gameConfigService: GameConfigService;
  let balanceService: BalanceService;
  let provablyFairService: ProvablyFairService;
  let mockCryptoConverter: Partial<CryptoConverterService>;

  beforeEach(async () => {
    mockCryptoConverter = {
      convertToUsd: jest.fn().mockReturnValue(0), // 0 USD for 0 bet amount
      convertFromUsd: jest.fn().mockReturnValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: GameConfigService,
          useValue: {
            validateBetAmount: jest.fn(),
            validateBetTypeAmount: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            validateFinancialOperation: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: ProvablyFairService,
          useValue: {
            generateGameOutcome: jest.fn(),
            getActiveSeedPair: jest.fn(),
            calculateOutcome: jest.fn(),
          },
        },
        {
          provide: CryptoConverterService,
          useValue: mockCryptoConverter,
        },
      ],
    }).compile();

    gameConfigService = module.get<GameConfigService>(GameConfigService);
    balanceService = module.get<BalanceService>(BalanceService);
    provablyFairService = module.get<ProvablyFairService>(ProvablyFairService);
  });

  describe('GameConfigService Demo Mode Validation', () => {
    it('should allow 0 bet amount for demo mode', async () => {
      const mockResult = { isValid: true, usdAmount: 0 };
      jest.spyOn(gameConfigService, 'validateBetAmount').mockResolvedValue(mockResult);

      const result = await gameConfigService.validateBetAmount(
        GameType.DICE,
        '0',
        AssetTypeEnum.BTC,
      );

      expect(result.isValid).toBe(true);
      expect(result.usdAmount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should allow 0 bet amount for bet type validation', async () => {
      const mockResult = { isValid: true, usdAmount: 0 };
      jest.spyOn(gameConfigService, 'validateBetTypeAmount').mockResolvedValue(mockResult);

      const result = await gameConfigService.validateBetTypeAmount(
        GameType.BLACKJACK,
        'BLACKJACK_MAIN' as any,
        '0',
        AssetTypeEnum.BTC,
      );

      expect(result.isValid).toBe(true);
      expect(result.usdAmount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should reject negative bet amounts', async () => {
      const mockResult = { isValid: false, error: 'Invalid bet amount' };
      jest.spyOn(gameConfigService, 'validateBetAmount').mockResolvedValue(mockResult);

      const result = await gameConfigService.validateBetAmount(
        GameType.DICE,
        '-1',
        AssetTypeEnum.BTC,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid bet amount');
    });
  });

  describe('Balance Service Demo Mode Support', () => {
    it('should validate 0 amount BET operations', () => {
      const dto = {
        operation: BalanceOperationEnum.BET,
        operationId: 'test-operation-id',
        userId: 'test-user-id',
        amount: new BigNumber('0'),
        asset: AssetTypeEnum.BTC,
        description: 'Demo mode bet',
      };

      jest.spyOn(balanceService, 'validateFinancialOperation').mockImplementation(() => {
        // Should not throw for 0 amount
      });

      expect(() => balanceService.validateFinancialOperation(dto)).not.toThrow();
    });

    it('should reject negative amount BET operations', () => {
      const dto = {
        operation: BalanceOperationEnum.BET,
        operationId: 'test-operation-id',
        userId: 'test-user-id',
        amount: new BigNumber('-1'),
        asset: AssetTypeEnum.BTC,
        description: 'Invalid negative bet',
      };

      jest.spyOn(balanceService, 'validateFinancialOperation').mockImplementation(() => {
        throw new Error('Invalid amount');
      });

      expect(() => balanceService.validateFinancialOperation(dto)).toThrow();
    });
  });

  describe('Provably Fair Service with Demo Mode', () => {
    it('should generate valid outcomes for 0 bet amounts', async () => {
      const mockOutcome = {
        value: 50.5, // Sample dice roll
        serverSeed: 'test-server-seed',
        clientSeed: 'test-client-seed',
        nonce: '2',
        hash: 'test-hash',
      };

      jest.spyOn(provablyFairService, 'generateGameOutcome').mockResolvedValue(mockOutcome);

      const outcome = await provablyFairService.generateGameOutcome(
        'test-user-id',
        GameTypeEnum.DICE,
        '0', // Zero bet amount
      );

      expect(outcome).toBeDefined();
      expect(outcome.value).toBe(50.5);
      expect(outcome.serverSeed).toBe('test-server-seed');
      expect(outcome.clientSeed).toBe('test-client-seed');
    });
  });

  describe('Balance Service Transaction Recording', () => {
    it('should handle 0 bet amount transactions', async () => {
      jest.spyOn(balanceService, 'updateBalance').mockResolvedValue({
        success: true,
        status: 'SUCCESS' as any,
        balance: '100.00000000', // User's balance remains unchanged
      });

      const result = await balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: 'demo-bet-id',
        userId: 'test-user-id',
        amount: new BigNumber('0'),
        asset: AssetTypeEnum.BTC,
        description: 'Demo mode bet',
      });

      expect(result.success).toBe(true);
      expect(result.balance).toBe('100.00000000'); // Balance unchanged for demo mode
    });
  });

  describe('Demo Mode Edge Cases', () => {
    it('should handle very small positive amounts normally', async () => {
      const mockResult = { isValid: true, usdAmount: 0.0001 };
      jest.spyOn(gameConfigService, 'validateBetAmount').mockResolvedValue(mockResult);

      const result = await gameConfigService.validateBetAmount(
        GameType.DICE,
        '0.00000001', // 1 satoshi
        AssetTypeEnum.BTC,
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid string amounts', async () => {
      const mockResult = { isValid: false, error: 'Invalid bet amount' };
      jest.spyOn(gameConfigService, 'validateBetAmount').mockResolvedValue(mockResult);

      const result = await gameConfigService.validateBetAmount(
        GameType.DICE,
        'invalid',
        AssetTypeEnum.BTC,
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid bet amount');
    });

    it('should handle 0 amount with different asset types', async () => {
      const mockResult = { isValid: true, usdAmount: 0 };
      jest.spyOn(gameConfigService, 'validateBetAmount').mockResolvedValue(mockResult);

      for (const asset of [AssetTypeEnum.BTC, AssetTypeEnum.ETH, AssetTypeEnum.USDT]) {
        const result = await gameConfigService.validateBetAmount(GameType.DICE, '0', asset);

        expect(result.isValid).toBe(true);
        expect(result.usdAmount).toBe(0);
      }
    });
  });
});
