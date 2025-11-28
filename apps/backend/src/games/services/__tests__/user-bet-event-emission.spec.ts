import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssetTypeEnum, GameTypeEnum, UserBetEntity } from '@zetik/shared-entities';
import { CryptoConverterService } from '../../../balance/services/crypto-converter.service';
import { IUserBetCreatedEvent, UserBetService } from '../user-bet.service';

/**
 * Test: user-bet.created event emission with full UserBetEntity
 *
 * Verifies that the event payload includes:
 * 1. All UserBetEntity fields (game, betId, userId, betAmount, asset, multiplier, payout, etc.)
 * 2. Calculated USD values (betAmountUsd, payoutUsd) for backward compatibility
 * 3. Existing listeners can still access userId, betAmountUsd, payoutUsd
 */
describe('UserBetService - Event Emission', () => {
  let service: UserBetService;
  let eventEmitter: EventEmitter2;

  const mockCryptoConverterService = {
    toUsd: jest.fn((amount: string, asset: AssetTypeEnum) => {
      // Simple mock conversion rates
      const rates: Record<AssetTypeEnum, number> = {
        [AssetTypeEnum.BTC]: 50000,
        [AssetTypeEnum.ETH]: 3000,
        [AssetTypeEnum.USDT]: 1,
        [AssetTypeEnum.USDC]: 1,
        [AssetTypeEnum.SOL]: 100,
        [AssetTypeEnum.LTC]: 80,
        [AssetTypeEnum.DOGE]: 0.08,
        [AssetTypeEnum.TRX]: 0.1,
        [AssetTypeEnum.XRP]: 0.5,
      };
      return (parseFloat(amount) * rates[asset]).toFixed(4);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBetService,
        {
          provide: getRepositoryToken(UserBetEntity),
          useValue: {
            create: jest.fn((data) => ({ ...data, createdAt: new Date() })),
            save: jest.fn((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: CryptoConverterService,
          useValue: mockCryptoConverterService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserBetService>(UserBetService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  describe('user-bet.created event emission', () => {
    it('should emit event with full UserBetEntity fields', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.0000',
        payout: '0.002',
      };

      await service.createUserBet(betInput);

      // Verify event was emitted
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('user-bet.created', expect.any(Object));

      // Get the emitted event payload
      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [eventName, eventPayload] = emitCalls[0];

      expect(eventName).toBe('user-bet.created');

      // Verify all UserBetEntity fields are present
      expect(eventPayload).toMatchObject({
        game: GameTypeEnum.DICE,
        betId: betInput.betId,
        userId: betInput.userId,
        betAmount: betInput.betAmount,
        asset: betInput.asset,
        multiplier: betInput.multiplier,
        payout: betInput.payout,
      });

      // Verify USD values are present (for backward compatibility)
      expect(eventPayload).toHaveProperty('betAmountUsd');
      expect(eventPayload).toHaveProperty('payoutUsd');
      expect(eventPayload.betAmountUsd).toBe('50.0000'); // 0.001 BTC * 50000
      expect(eventPayload.payoutUsd).toBe('100.0000'); // 0.002 BTC * 50000

      // Verify createdAt timestamp is present
      expect(eventPayload).toHaveProperty('createdAt');
      expect(eventPayload.createdAt).toBeInstanceOf(Date);
    });

    it('should emit event with all fields for different game types', async () => {
      const testCases = [
        {
          game: GameTypeEnum.PLINKO,
          betId: 'plinko-bet-1',
          asset: AssetTypeEnum.ETH,
          betAmount: '0.1',
          multiplier: '5.0000',
          payout: '0.5',
          expectedBetUsd: '300.0000', // 0.1 ETH * 3000
          expectedPayoutUsd: '1500.0000', // 0.5 ETH * 3000
        },
        {
          game: GameTypeEnum.LIMBO,
          betId: 'limbo-bet-1',
          asset: AssetTypeEnum.USDT,
          betAmount: '100',
          multiplier: '1.5000',
          payout: '150',
          expectedBetUsd: '100.0000', // 100 USDT * 1
          expectedPayoutUsd: '150.0000', // 150 USDT * 1
        },
        {
          game: GameTypeEnum.MINES,
          betId: 'mines-bet-1',
          asset: AssetTypeEnum.SOL,
          betAmount: '1.5',
          multiplier: '10.0000',
          payout: '15',
          expectedBetUsd: '150.0000', // 1.5 SOL * 100
          expectedPayoutUsd: '1500.0000', // 15 SOL * 100
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        await service.createUserBet({
          game: testCase.game,
          betId: testCase.betId,
          userId: 'user-123',
          betAmount: testCase.betAmount,
          asset: testCase.asset,
          multiplier: testCase.multiplier,
          payout: testCase.payout,
        });

        const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
        const [, eventPayload] = emitCalls[0];

        expect(eventPayload).toMatchObject({
          game: testCase.game,
          betId: testCase.betId,
          asset: testCase.asset,
          betAmount: testCase.betAmount,
          multiplier: testCase.multiplier,
          payout: testCase.payout,
          betAmountUsd: testCase.expectedBetUsd,
          payoutUsd: testCase.expectedPayoutUsd,
        });
      }
    });

    it('should emit event with gameName field', async () => {
      const betInput = {
        game: GameTypeEnum.ROULETTE,
        betId: 'roulette-bet-1',
        userId: 'user-123',
        betAmount: '10',
        asset: AssetTypeEnum.USDT,
        multiplier: '35.0000',
        payout: '350',
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0];

      // gameName should be populated by GAME_DISPLAY_NAMES
      expect(eventPayload).toHaveProperty('gameName');
      expect(eventPayload.gameName).toBeTruthy();
    });

    it('should handle backward compatibility - existing listeners can access userId, betAmountUsd, payoutUsd', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: 'dice-bet-1',
        userId: 'user-456',
        betAmount: '0.05',
        asset: AssetTypeEnum.ETH,
        multiplier: '2.0000',
        payout: '0.1',
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0] as [string, IUserBetCreatedEvent];

      // Existing listeners only use these three fields
      expect(eventPayload.userId).toBe('user-456');
      expect(eventPayload.betAmountUsd).toBe('150.0000'); // 0.05 ETH * 3000
      expect(eventPayload.payoutUsd).toBe('300.0000'); // 0.1 ETH * 3000

      // TypeScript should recognize these fields
      const userId: string = eventPayload.userId;
      const betAmountUsd: string = eventPayload.betAmountUsd;
      const payoutUsd: string = eventPayload.payoutUsd;

      expect(userId).toBe('user-456');
      expect(betAmountUsd).toBe('150.0000');
      expect(payoutUsd).toBe('300.0000');
    });

    it('should emit event with fiat currency fields if provided', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: 'fiat-bet-1',
        userId: 'user-789',
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.0000',
        payout: '0.002',
        originalFiatAmount: '45.50',
        originalFiatCurrency: 'USD' as any,
        fiatToUsdRate: '1.0000',
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0];

      // Verify fiat fields are included
      expect(eventPayload).toHaveProperty('originalFiatAmount');
      expect(eventPayload).toHaveProperty('originalFiatCurrency');
      expect(eventPayload).toHaveProperty('fiatToUsdRate');
      expect(eventPayload.originalFiatAmount).toBe('45.50');
      expect(eventPayload.originalFiatCurrency).toBe('USD');
      expect(eventPayload.fiatToUsdRate).toBe('1.0000');
    });

    it('should calculate USD values if not provided', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: 'auto-usd-bet-1',
        userId: 'user-999',
        betAmount: '0.5',
        asset: AssetTypeEnum.SOL,
        multiplier: '3.0000',
        payout: '1.5',
        // betAmountUsd and payoutUsd NOT provided
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0];

      // USD values should be auto-calculated by CryptoConverterService
      expect(eventPayload.betAmountUsd).toBe('50.0000'); // 0.5 SOL * 100
      expect(eventPayload.payoutUsd).toBe('150.0000'); // 1.5 SOL * 100
    });

    it('should use provided USD values if given', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: 'custom-usd-bet-1',
        userId: 'user-111',
        betAmount: '0.001',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.0000',
        payout: '0.002',
        betAmountUsd: '48.5000', // Custom USD value (different from auto-calc)
        payoutUsd: '97.0000', // Custom USD value
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0];

      // Should use provided USD values, not auto-calculated
      expect(eventPayload.betAmountUsd).toBe('48.5000');
      expect(eventPayload.payoutUsd).toBe('97.0000');
    });
  });

  describe('interface compatibility', () => {
    it('should satisfy IUserBetCreatedEvent interface', async () => {
      const betInput = {
        game: GameTypeEnum.DICE,
        betId: 'interface-test-1',
        userId: 'user-222',
        betAmount: '0.01',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.0000',
        payout: '0.02',
      };

      await service.createUserBet(betInput);

      const emitCalls = (eventEmitter.emit as jest.Mock).mock.calls;
      const [, eventPayload] = emitCalls[0] as [string, IUserBetCreatedEvent];

      // TypeScript compilation ensures interface compatibility
      const event: IUserBetCreatedEvent = eventPayload;

      // Required fields from interface
      expect(event.userId).toBeDefined();
      expect(event.betAmountUsd).toBeDefined();
      expect(event.payoutUsd).toBeDefined();

      // Optional fields from UserBetEntity (via Partial<UserBetEntity>)
      expect(event.game).toBe(GameTypeEnum.DICE);
      expect(event.betId).toBe('interface-test-1');
      expect(event.betAmount).toBe('0.01');
      expect(event.asset).toBe(AssetTypeEnum.BTC);
      expect(event.multiplier).toBe('2.0000');
      expect(event.payout).toBe('0.02');
    });
  });
});
