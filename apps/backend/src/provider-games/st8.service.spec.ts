import { AssetTypeEnum, GameTypeEnum } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';

describe('St8Service - Helper Methods', () => {
  class St8ServiceMock {
    private readonly MAX_GAME_NAME_LENGTH = 50;

    buildBetEntity(
      gameName: string,
      betId: string,
      userId: string,
      betAmount: string,
      asset: AssetTypeEnum,
      multiplier: string,
      payout: string,
      betAmountUsd: string,
      payoutUsd: string,
      createdAt: Date,
    ) {
      return {
        game: GameTypeEnum.PROVIDER,
        gameName,
        betId,
        userId,
        betAmount,
        asset,
        multiplier,
        payout,
        betAmountUsd,
        payoutUsd,
        createdAt,
      };
    }

    getBetId(body: any): string {
      return body.provider?.transaction_id || body.transaction_id;
    }

    getGameName(body: any): string {
      const gameCode = (body as any).game_code ?? (body as any).game_code ?? '';
      const developerCode = body.developer_code;
      return `${developerCode}:${gameCode}`.slice(0, this.MAX_GAME_NAME_LENGTH);
    }

    parseAmounts(amount: BigNumber): { fixedAmount: string; fixedAmountUsd: string } {
      return {
        fixedAmount: amount.toFixed(8),
        fixedAmountUsd: amount.toFixed(4),
      };
    }
  }

  let service: St8ServiceMock;

  beforeEach(() => {
    service = new St8ServiceMock();
  });

  describe('buildBetEntity helper', () => {
    it('should build a bet entity with correct structure', () => {
      const result = service.buildBetEntity(
        'pragmaticplay:sugar-rush',
        'bet-123',
        'user-456',
        '1.00000000',
        AssetTypeEnum.BTC,
        '2.5000',
        '2.50000000',
        '50.0000',
        '125.0000',
        new Date('2025-01-01'),
      );

      expect(result).toEqual({
        game: GameTypeEnum.PROVIDER,
        gameName: 'pragmaticplay:sugar-rush',
        betId: 'bet-123',
        userId: 'user-456',
        betAmount: '1.00000000',
        asset: AssetTypeEnum.BTC,
        multiplier: '2.5000',
        payout: '2.50000000',
        betAmountUsd: '50.0000',
        payoutUsd: '125.0000',
        createdAt: new Date('2025-01-01'),
      });
    });
  });

  describe('getBetId helper', () => {
    it('should extract bet ID from provider transaction', () => {
      const result = service.getBetId({
        transaction_id: 'tx-123',
        provider: { transaction_id: 'provider-tx-456' },
      });

      expect(result).toBe('provider-tx-456');
    });

    it('should fallback to transaction_id if provider.transaction_id is missing', () => {
      const result = service.getBetId({
        transaction_id: 'tx-123',
      });

      expect(result).toBe('tx-123');
    });
  });

  describe('getGameName helper', () => {
    it('should format game name correctly', () => {
      const result = service.getGameName({
        developer_code: 'pragmaticplay',
        game_code: 'sugar-rush',
      });

      expect(result).toBe('pragmaticplay:sugar-rush');
    });

    it('should trim game name to MAX_GAME_NAME_LENGTH', () => {
      const longDeveloper = 'a'.repeat(30);
      const longGame = 'b'.repeat(30);
      const result = service.getGameName({
        developer_code: longDeveloper,
        game_code: longGame,
      });

      expect(result).toHaveLength(50);
      expect(result).toBe(`${longDeveloper}:${longGame}`.slice(0, 50));
    });
  });

  describe('parseAmounts helper', () => {
    it('should format amounts correctly', () => {
      const amount = new BigNumber('1.23456789');
      const result = service.parseAmounts(amount);

      expect(result).toEqual({
        fixedAmount: '1.23456789',
        fixedAmountUsd: '1.2346',
      });
    });
  });
});
