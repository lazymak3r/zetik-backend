import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CrashBetEntity, CrashGameEntity } from '@zetik/shared-entities';
import { BalanceService } from '../../../balance/balance.service';
import { CrashGateway } from '../gateways/crash.gateway.simple';
import { CrashWebSocketService } from '../services/crash-websocket.service';

describe('CrashWebSocket Integration', () => {
  let crashWebSocketService: CrashWebSocketService;
  let mockCrashGateway: Partial<CrashGateway>;

  beforeEach(async () => {
    // Mock CrashGateway
    mockCrashGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
        fetchSockets: jest.fn().mockResolvedValue([]),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashWebSocketService,
        {
          provide: getRepositoryToken(CrashGameEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CrashBetEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: 'DataSource',
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
        {
          provide: CrashGateway,
          useValue: mockCrashGateway,
        },
      ],
    }).compile();

    crashWebSocketService = module.get<CrashWebSocketService>(CrashWebSocketService);
  });

  it('should be defined', () => {
    expect(crashWebSocketService).toBeDefined();
  });

  it('should broadcast game state', async () => {
    const gameState = {
      id: 'test-game-id',
      status: 'WAITING' as any,
      betsCount: 0,
      totalBetAmount: '0',
      serverSeedHash: 'test-hash',
      gameIndex: 1,
    };

    await crashWebSocketService.broadcastGameState(gameState);

    expect(mockCrashGateway.server?.to).toHaveBeenCalledWith('crash-game');
  });

  it('should broadcast multiplier update', async () => {
    const update = {
      gameId: 'test-game-id',
      multiplier: '1.50',
      timestamp: Date.now(),
    };

    await crashWebSocketService.broadcastMultiplierUpdate(update);

    expect(mockCrashGateway.server?.to).toHaveBeenCalledWith('crash-game');
  });

  it('should throttle multiplier updates', async () => {
    const update = {
      gameId: 'test-game-id',
      multiplier: '1.50',
      timestamp: Date.now(),
    };

    // Send multiple updates quickly
    await crashWebSocketService.broadcastMultiplierUpdate(update);
    await crashWebSocketService.broadcastMultiplierUpdate(update);
    await crashWebSocketService.broadcastMultiplierUpdate(update);

    // Should only call once due to throttling
    expect(mockCrashGateway.server?.to).toHaveBeenCalledTimes(1);
  });
});
