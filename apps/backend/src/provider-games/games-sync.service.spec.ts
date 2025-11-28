import {
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
} from '@zetik/shared-entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamesSyncService } from './games-sync.service';
import { St8Service } from './st8.service';

describe('GamesSyncService', () => {
  let service: GamesSyncService;
  let mockSt8Service: jest.Mocked<St8Service>;
  let mockDeveloperRepository: jest.Mocked<Repository<ProviderDeveloperEntity>>;

  beforeEach(async () => {
    const mockGameRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockDevRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCatRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockSt8 = {
      getGames: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesSyncService,
        {
          provide: St8Service,
          useValue: mockSt8,
        },
        {
          provide: getRepositoryToken(ProviderGameEntity),
          useValue: mockGameRepo,
        },
        {
          provide: getRepositoryToken(ProviderDeveloperEntity),
          useValue: mockDevRepo,
        },
        {
          provide: getRepositoryToken(ProviderCategoryEntity),
          useValue: mockCatRepo,
        },
      ],
    }).compile();

    service = module.get<GamesSyncService>(GamesSyncService);
    mockSt8Service = module.get(St8Service);
    mockDeveloperRepository = module.get(getRepositoryToken(ProviderDeveloperEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle empty games data', async () => {
    mockSt8Service.getGames.mockResolvedValue({
      status: 'ok',
      developers: [],
      categories: [],
      games: [],
    });

    await expect(service.syncGames()).resolves.not.toThrow();
  });

  it('should handle sync failure gracefully', async () => {
    mockSt8Service.getGames.mockResolvedValue({
      status: 'error',
      developers: [],
      categories: [],
      games: [],
    });

    await expect(service.syncGames()).resolves.not.toThrow();
  });

  it('should sync developers correctly', async () => {
    const testDevelopers = [
      {
        name: 'Test Dev',
        code: 'test-dev',
        restricted_territories: [],
        prohibited_territories: [],
      },
    ];

    mockSt8Service.getGames.mockResolvedValue({
      status: 'ok',
      developers: testDevelopers,
      categories: [],
      games: [],
    });

    mockDeveloperRepository.save.mockResolvedValue({} as any);

    await service.syncGames();

    expect(mockDeveloperRepository.save).toHaveBeenCalledWith({
      code: 'test-dev',
      name: 'Test Dev',
      restrictedTerritories: [],
      prohibitedTerritories: [],
    });
  });
});
