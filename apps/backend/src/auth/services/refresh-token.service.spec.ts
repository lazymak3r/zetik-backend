import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshTokenEntity, UserEntity } from '@zetik/shared-entities';
import * as geoip from 'geoip-lite';
import { Repository } from 'typeorm';
import { RefreshTokenService } from './refresh-token.service';

// Mock geoip-lite
jest.mock('geoip-lite');
const mockGeoip = geoip as jest.Mocked<typeof geoip>;

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repository: jest.Mocked<Repository<RefreshTokenEntity>>;

  const mockUser: UserEntity = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
  } as UserEntity;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: mockRepository,
        },
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            refreshExpiration: '7d',
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    repository = module.get(getRepositoryToken(RefreshTokenEntity));

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create refresh token with location for public IP', async () => {
      const mockToken = {
        id: 1,
        token: 'test-token',
        userId: 'test-user-id',
        location: 'New York, US',
      } as RefreshTokenEntity;

      // Mock geoip to return location data
      mockGeoip.lookup.mockReturnValue({
        range: [134744064, 134744319],
        country: 'US',
        region: 'NY',
        city: 'New York',
        ll: [40.7128, -74.006],
        metro: 501,
        eu: '0',
        timezone: 'America/New_York',
        area: 1000,
      });

      repository.create.mockReturnValue(mockToken);
      repository.save.mockResolvedValue(mockToken);

      const result = await service.createRefreshToken(
        mockUser,
        'test-token-value',
        'Mozilla/5.0',
        '8.8.8.8', // Google DNS IP
      );

      expect(mockGeoip.lookup).toHaveBeenCalledWith('8.8.8.8');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'New York, US',
        }),
      );
      expect(result).toEqual(mockToken);
    });

    it('should create refresh token with "Unknown" location for localhost IP', async () => {
      const mockToken = {
        id: 1,
        token: 'test-token',
        userId: 'test-user-id',
        location: 'Unknown',
      } as RefreshTokenEntity;

      // Mock geoip to return null for localhost
      mockGeoip.lookup.mockReturnValue(null);

      repository.create.mockReturnValue(mockToken);
      repository.save.mockResolvedValue(mockToken);

      const result = await service.createRefreshToken(
        mockUser,
        'test-token-value',
        'Mozilla/5.0',
        '127.0.0.1', // localhost
      );

      expect(mockGeoip.lookup).toHaveBeenCalledWith('127.0.0.1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Unknown',
        }),
      );
      expect(result).toEqual(mockToken);
    });

    it('should create refresh token with country only when city is not available', async () => {
      const mockToken = {
        id: 1,
        token: 'test-token',
        userId: 'test-user-id',
        location: 'US',
      } as RefreshTokenEntity;

      // Mock geoip to return only country data
      mockGeoip.lookup.mockReturnValue({
        range: [0, 0],
        country: 'US',
        region: '',
        city: '',
        ll: [39.0, -76.0],
        metro: 0,
        eu: '0',
        timezone: 'America/New_York',
        area: 1000,
      });

      repository.create.mockReturnValue(mockToken);
      repository.save.mockResolvedValue(mockToken);

      const result = await service.createRefreshToken(
        mockUser,
        'test-token-value',
        'Mozilla/5.0',
        '192.168.1.1', // private IP
      );

      expect(mockGeoip.lookup).toHaveBeenCalledWith('192.168.1.1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'US',
        }),
      );
      expect(result).toEqual(mockToken);
    });

    it('should create refresh token with "Unknown" location when geoip throws error', async () => {
      const mockToken = {
        id: 1,
        token: 'test-token',
        userId: 'test-user-id',
        location: 'Unknown',
      } as RefreshTokenEntity;

      // Mock geoip to throw an error
      mockGeoip.lookup.mockImplementation(() => {
        throw new Error('Geoip error');
      });

      repository.create.mockReturnValue(mockToken);
      repository.save.mockResolvedValue(mockToken);

      const result = await service.createRefreshToken(
        mockUser,
        'test-token-value',
        'Mozilla/5.0',
        '8.8.8.8',
      );

      expect(mockGeoip.lookup).toHaveBeenCalledWith('8.8.8.8');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Unknown',
        }),
      );
      expect(result).toEqual(mockToken);
    });

    it('should create refresh token with region when only region is available', async () => {
      const mockToken = {
        id: 1,
        token: 'test-token',
        userId: 'test-user-id',
        location: 'CA',
      } as RefreshTokenEntity;

      // Mock geoip to return only region data
      mockGeoip.lookup.mockReturnValue({
        range: [0, 0],
        country: '',
        region: 'CA',
        city: '',
        ll: [56.0, -106.0],
        metro: 0,
        eu: '0',
        timezone: 'America/Toronto',
        area: 1000,
      });

      repository.create.mockReturnValue(mockToken);
      repository.save.mockResolvedValue(mockToken);

      const result = await service.createRefreshToken(
        mockUser,
        'test-token-value',
        'Mozilla/5.0',
        '192.168.1.100',
      );

      expect(mockGeoip.lookup).toHaveBeenCalledWith('192.168.1.100');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'CA',
        }),
      );
      expect(result).toEqual(mockToken);
    });
  });
});
