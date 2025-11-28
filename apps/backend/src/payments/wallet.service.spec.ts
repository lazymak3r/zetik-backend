/* eslint-disable */
// Tests for WalletService
import { AssetTypeEnum, WalletEntity } from '@zetik/shared-entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createTestProviders } from '../test-utils';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let repo: Repository<WalletEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        ...createTestProviders(),
        // Override specific mocks
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(WalletEntity), useClass: Repository },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repo = module.get<Repository<WalletEntity>>(getRepositoryToken(WalletEntity));
  });

  describe('findUserWallet', () => {
    it('returns null if no wallet found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const result = await service.findUserWallet('1', AssetTypeEnum.BTC);
      expect(result).toBeNull();
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: '1', asset: AssetTypeEnum.BTC },
      });
    });

    it('returns wallet when found', async () => {
      const mockWallet = { userId: '1', asset: AssetTypeEnum.BTC } as WalletEntity;
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockWallet);
      const result = await service.findUserWallet('1', AssetTypeEnum.BTC);
      expect(result).toBe(mockWallet);
    });
  });

  describe('upsertWallet', () => {
    it('creates a new wallet if none exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const createSpy = jest.spyOn(repo, 'create').mockReturnValue({} as any);
      const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue({} as any);
      await service.upsertWallet('2', AssetTypeEnum.BTC, 'addr');
      expect(createSpy).toHaveBeenCalledWith({
        userId: '2',
        asset: AssetTypeEnum.BTC,
        addresses: { [AssetTypeEnum.BTC]: 'addr' },
      });
      expect(saveSpy).toHaveBeenCalled();
    });

    it('updates wallet if exists', async () => {
      const existing = { addresses: {} } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(existing);
      const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue(existing);
      const result = await service.upsertWallet('3', AssetTypeEnum.BTC, 'newAddr');
      expect(existing.addresses[AssetTypeEnum.BTC]).toBe('newAddr');
      expect(saveSpy).toHaveBeenCalledWith(existing);
      expect(result).toBe(existing);
    });
  });

  describe('findWalletByAddress', () => {
    it('returns wallet when found', async () => {
      const mock = {} as WalletEntity;
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mock),
      };
      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
      const result = await service.findWalletByAddress('a', AssetTypeEnum.BTC);
      expect(qb.where).toHaveBeenCalledWith('wallet.asset = :asset', { asset: AssetTypeEnum.BTC });
      expect(qb.andWhere).toHaveBeenCalledWith('wallet.addresses ->> :asset::text = :address', {
        asset: AssetTypeEnum.BTC,
        address: 'a',
      });
      expect(result).toBe(mock);
    });

    it('returns null when not found', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
      const result = await service.findWalletByAddress('x', AssetTypeEnum.BTC);
      expect(result).toBeNull();
    });
  });

  describe('addNetworkAddress', () => {
    it('creates a new wallet if none exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      const createSpy = jest.spyOn(repo, 'create').mockReturnValue({} as any);
      const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue({} as any);
      const result = await service.addNetworkAddress('4', AssetTypeEnum.BTC, 'network1', 'addr1');
      expect(createSpy).toHaveBeenCalledWith({
        userId: '4',
        asset: AssetTypeEnum.BTC,
        addresses: { network1: 'addr1' },
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({} as any);
    });

    it('updates existing wallet addresses', async () => {
      const existing = { addresses: { old: 'o' } } as any;
      jest.spyOn(repo, 'findOne').mockResolvedValue(existing);
      const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue(existing);
      const result = await service.addNetworkAddress('5', AssetTypeEnum.ETH, 'network2', 'addr2');
      expect(existing.addresses.network2).toBe('addr2');
      expect(saveSpy).toHaveBeenCalledWith(existing);
      expect(result).toBe(existing);
    });
  });
});
