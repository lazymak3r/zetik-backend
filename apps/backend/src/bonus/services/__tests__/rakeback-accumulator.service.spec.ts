import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';

import { AssetTypeEnum } from '@zetik/shared-entities';

import { IBetConfirmedEventPayload } from '../../interfaces/ibet-confirmed-event-payload.interface';
import { IBetRefundedEventPayload } from '../../interfaces/ibet-refunded-event-payload.interface';
import { RakebackAccumulatorService } from '../rakeback-accumulator.service';

describe('RakebackAccumulatorService', () => {
  let service: RakebackAccumulatorService;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RakebackAccumulatorService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<RakebackAccumulatorService>(RakebackAccumulatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBetConfirmed', () => {
    it('should accumulate house side for valid bet', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-1',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.01000000'],
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should use default house edge of 1% if not provided', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '2.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-2',
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.02000000'],
      );
    });

    it('should handle different house edges correctly', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-3',
        houseEdge: 5, // 5% house edge
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.05000000'],
      );
    });

    it('should round down house side amount', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '0.12345678',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-4',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(payload);

      // 0.12345678 * 0.01 = 0.0012345678, rounded down to 8 decimals = 0.00123456
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.00123456'],
      );
    });

    it('should skip zero bet amounts', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '0',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-5',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should skip zero or negative house edge', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-6',
        houseEdge: 0,
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should skip unsupported assets', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: 'INVALID_ASSET' as AssetTypeEnum,
        operationId: 'op-7',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-8',
        houseEdge: 1,
      };

      queryRunner.query.mockRejectedValue(new Error('Database error'));

      await expect(service.handleBetConfirmed(payload)).resolves.not.toThrow();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should support multiple assets', async () => {
      const assets = [AssetTypeEnum.BTC, AssetTypeEnum.ETH, AssetTypeEnum.USDT];

      for (const asset of assets) {
        const payload: IBetConfirmedEventPayload = {
          userId: 'user-123',
          betAmount: '1.00000000',
          asset,
          operationId: `op-9-${asset}`,
          houseEdge: 1,
        };

        await service.handleBetConfirmed(payload);

        expect(queryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO "balance"."rakeback"'),
          ['user-123', asset, '0.01000000'],
        );

        jest.clearAllMocks();
      }
    });
  });

  describe('handleBetRefunded', () => {
    it('should reverse house side for valid refund', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-1',
      };

      await service.handleBetRefunded(payload);

      expect(queryRunner.connect).toHaveBeenCalled();
      // Negative value: 1.00000000 * -0.01 = -0.01000000
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.01000000'],
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should use fixed 1% house edge for refunds', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '2.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-2',
      };

      await service.handleBetRefunded(payload);

      // 2.00000000 * -0.01 = -0.02000000
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.02000000'],
      );
    });

    it('should round up negative house side (down in absolute value)', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0.12345678',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-3',
      };

      await service.handleBetRefunded(payload);

      // 0.12345678 * -0.01 = -0.0012345678, rounded up to 8 decimals = -0.00123456
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.00123456'],
      );
    });

    it('should skip zero refund amounts', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-4',
      };

      await service.handleBetRefunded(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should skip empty refund amounts', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-5',
      };

      await service.handleBetRefunded(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should skip unsupported assets', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        asset: 'INVALID_ASSET' as AssetTypeEnum,
        operationId: 'op-refund-6',
      };

      await service.handleBetRefunded(payload);

      expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-refund-7',
      };

      queryRunner.query.mockRejectedValue(new Error('Database error'));

      await expect(service.handleBetRefunded(payload)).resolves.not.toThrow();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should support multiple assets for refunds', async () => {
      const assets = [AssetTypeEnum.BTC, AssetTypeEnum.ETH, AssetTypeEnum.USDT];

      for (const asset of assets) {
        const payload: IBetRefundedEventPayload = {
          userId: 'user-123',
          refundAmount: '1.00000000',
          asset,
          operationId: `op-refund-8-${asset}`,
        };

        await service.handleBetRefunded(payload);

        expect(queryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO "balance"."rakeback"'),
          ['user-123', asset, '-0.01000000'],
        );

        jest.clearAllMocks();
      }
    });
  });

  describe('addHouseSide', () => {
    it('should execute UPSERT query with correct parameters', async () => {
      await service.addHouseSide('user-123', AssetTypeEnum.BTC, '0.01000000');

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.01000000'],
      );
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array),
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should handle negative amounts for refunds', async () => {
      await service.addHouseSide('user-123', AssetTypeEnum.BTC, '-0.01000000');

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.01000000'],
      );
    });

    it('should release query runner even on error', async () => {
      queryRunner.query.mockRejectedValue(new Error('Database error'));

      await expect(
        service.addHouseSide('user-123', AssetTypeEnum.BTC, '0.01000000'),
      ).rejects.toThrow('Database error');

      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should correctly accumulate and reverse house side', async () => {
      // Bet: 1 BTC with 1% house edge
      const betPayload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-1',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(betPayload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.01000000'],
      );

      jest.clearAllMocks();

      // Refund: 1 BTC
      const refundPayload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-refund-1',
      };

      await service.handleBetRefunded(refundPayload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.01000000'],
      );
    });

    it('should handle partial refunds correctly', async () => {
      // Bet: 2 BTC
      const betPayload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '2.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-2',
        houseEdge: 1,
      };

      await service.handleBetConfirmed(betPayload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.02000000'],
      );

      jest.clearAllMocks();

      // Partial refund: 0.5 BTC
      const refundPayload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0.50000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-refund-2',
      };

      await service.handleBetRefunded(refundPayload);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.00500000'],
      );
    });

    it('should handle multiple bets and refunds for same user', async () => {
      // First bet: 1 BTC
      await service.handleBetConfirmed({
        userId: 'user-123',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-3-1',
        houseEdge: 1,
      });

      // Second bet: 0.5 BTC
      await service.handleBetConfirmed({
        userId: 'user-123',
        betAmount: '0.50000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-3-2',
        houseEdge: 1,
      });

      // Refund: 0.3 BTC
      await service.handleBetRefunded({
        userId: 'user-123',
        refundAmount: '0.30000000',
        asset: AssetTypeEnum.BTC,
        operationId: 'op-integration-refund-3',
      });

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.01000000'],
      );
      expect(queryRunner.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '0.00500000'],
      );
      expect(queryRunner.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO "balance"."rakeback"'),
        ['user-123', AssetTypeEnum.BTC, '-0.00300000'],
      );
    });
  });
});
