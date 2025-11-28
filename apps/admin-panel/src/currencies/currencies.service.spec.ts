import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AssetStatusEnum, CurrenciesService } from './currencies.service';

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrenciesService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CurrenciesService>(CurrenciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllAssets', () => {
    it('should return all assets', async () => {
      const mockAssets = [
        {
          symbol: 'BTC',
          status: AssetStatusEnum.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          symbol: 'LTC',
          status: AssetStatusEnum.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDataSource.query.mockResolvedValue(mockAssets);

      const result = await service.getAllAssets();

      expect(result).toEqual(mockAssets);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets ORDER BY symbol ASC',
      );
    });
  });

  describe('updateAsset', () => {
    it('should update asset status', async () => {
      const symbol = 'BTC';
      const input = { status: AssetStatusEnum.INACTIVE };
      const mockAsset = {
        symbol,
        status: AssetStatusEnum.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedAsset = { ...mockAsset, status: AssetStatusEnum.INACTIVE };

      mockDataSource.query
        .mockResolvedValueOnce([mockAsset]) // First call to check if asset exists
        .mockResolvedValueOnce(undefined) // UPDATE call
        .mockResolvedValueOnce([updatedAsset]); // Final SELECT call

      const result = await service.updateAsset(symbol, input);

      expect(result).toEqual(updatedAsset);
      expect(mockDataSource.query).toHaveBeenCalledTimes(3);
    });
  });
});
