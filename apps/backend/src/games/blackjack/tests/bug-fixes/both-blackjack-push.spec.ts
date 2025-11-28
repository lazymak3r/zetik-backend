import { Test, TestingModule } from '@nestjs/testing';
import { BlackjackGameEntity } from '@zetik/shared-entities';
import { BalanceService } from '../../../../balance/balance.service';
import { BlackjackPayoutService } from '../../services/blackjack-payout.service';

describe('Bug Fix: Both Dealer and Player Blackjack - Push Multiplier', () => {
  let payoutService: BlackjackPayoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlackjackPayoutService,
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn().mockResolvedValue({
              success: true,
              balance: '1000',
              status: 'SUCCESS',
            }),
          },
        },
      ],
    }).compile();

    payoutService = module.get<BlackjackPayoutService>(BlackjackPayoutService);
  });

  it('🐛 BUG FIX: When both dealer and player have blackjack (push), multiplier should be 1x not 0x', () => {
    const game = new BlackjackGameEntity();
    game.id = 'test-game-1';
    game.userId = 'test-user';
    game.betAmount = '200.00000000';
    game.asset = 'USDT';

    // Both dealer and player have blackjack - this is a PUSH
    // Player should get their bet back (1x multiplier)
    payoutService.setGamePayout(game, game.betAmount, true, true, false);

    // EXPECTED: Push returns the bet (1x multiplier)
    expect(game.payoutMultiplier).toBe('1.0000'); // NOT '0.0000'
    expect(game.winAmount).toBe('200.00000000'); // Bet returned
  });

  it('🐛 BUG FIX: Regular push (no blackjack) should also be 1x multiplier', () => {
    const game = new BlackjackGameEntity();
    game.id = 'test-game-2';
    game.userId = 'test-user';
    game.betAmount = '100.00000000';
    game.asset = 'USDT';

    // Regular push (both have 20, for example)
    payoutService.setGamePayout(game, game.betAmount, false, true, false);

    // EXPECTED: Push returns the bet (1x multiplier)
    expect(game.payoutMultiplier).toBe('1.0000');
    expect(game.winAmount).toBe('100.00000000');
  });

  it('✅ VERIFY: Blackjack win (player only) should be 2.5x multiplier', () => {
    const game = new BlackjackGameEntity();
    game.id = 'test-game-3';
    game.userId = 'test-user';
    game.betAmount = '200.00000000';
    game.asset = 'USDT';

    // Player blackjack, dealer doesn't - WIN
    payoutService.setGamePayout(game, game.betAmount, true, false, true);

    // EXPECTED: Blackjack pays 3:2 (2.5x total return)
    expect(game.payoutMultiplier).toBe('2.5000');
    expect(game.winAmount).toBe('500.00000000'); // 200 * 2.5
  });

  it('✅ VERIFY: Regular win should be 2x multiplier', () => {
    const game = new BlackjackGameEntity();
    game.id = 'test-game-4';
    game.userId = 'test-user';
    game.betAmount = '200.00000000';
    game.asset = 'USDT';

    // Regular win (no blackjack)
    payoutService.setGamePayout(game, game.betAmount, false, false, true);

    // EXPECTED: Regular win pays 1:1 (2x total return)
    expect(game.payoutMultiplier).toBe('2.0000');
    expect(game.winAmount).toBe('400.00000000'); // 200 * 2
  });

  it('✅ VERIFY: Loss should be 0x multiplier', () => {
    const game = new BlackjackGameEntity();
    game.id = 'test-game-5';
    game.userId = 'test-user';
    game.betAmount = '200.00000000';
    game.asset = 'USDT';

    // Loss
    payoutService.setGamePayout(game, game.betAmount, false, false, false);

    // EXPECTED: Loss pays nothing (0x)
    expect(game.payoutMultiplier).toBe('0.0000');
    expect(game.winAmount).toBe('0.00000000');
  });
});
