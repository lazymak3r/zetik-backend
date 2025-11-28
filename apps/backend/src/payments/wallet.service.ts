import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetTypeEnum, WalletEntity } from '@zetik/shared-entities';
import { QueryRunner, Repository } from 'typeorm';
import { getAddressKey } from './utils/address-keys.util';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepo: Repository<WalletEntity>,
  ) {}

  /**
   * Get stored address for a specific asset and network
   * Uses consistent key generation for USDC/USDT
   */
  getStoredAddress(wallet: WalletEntity, asset: AssetTypeEnum, network?: string): string | null {
    const key = getAddressKey(asset, network);
    return wallet.addresses?.[key] || null;
  }

  async findUserWallet(
    userId: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity | null> {
    if (queryRunner) {
      return queryRunner.manager.findOne(WalletEntity, { where: { userId, asset } });
    }
    return this.walletRepo.findOne({ where: { userId, asset } });
  }

  async upsertWallet(
    userId: string,
    asset: AssetTypeEnum,
    address: string,
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity> {
    let wallet: WalletEntity | null;
    if (queryRunner) {
      const em = queryRunner.manager;
      wallet = await em.findOne(WalletEntity, {
        where: { userId, asset },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        wallet = em.create(WalletEntity, {
          userId,
          asset,
          addresses: { [asset]: address },
        });
      } else {
        wallet.addresses = { ...wallet.addresses, [asset]: address };
      }
      return em.save(wallet);
    }
    wallet = await this.walletRepo.findOne({ where: { userId, asset } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        asset,
        addresses: { [asset]: address },
      });
    } else {
      wallet.addresses = { ...wallet.addresses, [asset]: address };
    }
    return this.walletRepo.save(wallet);
  }

  async findWalletByAddress(
    address: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity | null> {
    const repo = queryRunner ? queryRunner.manager.getRepository(WalletEntity) : this.walletRepo;

    // For USDC/USDT, search across all possible network keys
    if (asset === AssetTypeEnum.USDC || asset === AssetTypeEnum.USDT) {
      // Generate all possible compound keys for this asset
      const possibleKeys = ['ETH', 'BSC', 'SOL', 'TRX'].map((network) => `${asset}_${network}`);

      // Build parameterized query with safe key names
      // Since we control the key names (they're from our own array), we can validate them
      const validKeys = possibleKeys.filter((key) => key.match(/^(USDC|USDT)_(ETH|BSC|SOL|TRX)$/));

      if (validKeys.length === 0) {
        return null;
      }

      // Create parameterized conditions
      const orConditions = validKeys
        .map((_, index) => `wallet.addresses ->> :key${index} = :address`)
        .join(' OR ');

      // Build parameters object
      const parameters: any = { address };
      validKeys.forEach((key, index) => {
        parameters[`key${index}`] = key;
      });

      return repo
        .createQueryBuilder('wallet')
        .where('wallet.asset = :asset', { asset })
        .andWhere(`(${orConditions})`, parameters)
        .getOne();
    }

    // For other assets, use the simple asset-key lookup
    return repo
      .createQueryBuilder('wallet')
      .where('wallet.asset = :asset', { asset })
      .andWhere('wallet.addresses ->> :asset::text = :address', { asset, address })
      .getOne();
  }

  async getWalletsByUserId(userId: string, queryRunner?: QueryRunner): Promise<WalletEntity[]> {
    const manager = queryRunner ? queryRunner.manager : this.walletRepo;
    const repo = manager as Repository<WalletEntity>;
    return repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Add or update a network-specific address in the JSONB addresses field
   * Optionally update vaultId as well
   */
  async addNetworkAddress(
    userId: string,
    asset: AssetTypeEnum,
    network: string,
    address: string,
    vaultId?: string | null, // Make vaultId optional for backward compatibility
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity> {
    const repo = queryRunner ? queryRunner.manager.getRepository(WalletEntity) : this.walletRepo;

    let wallet = await repo.findOne({ where: { userId, asset } });
    if (!wallet) {
      wallet = repo.create({
        userId,
        asset,
        vaultId: vaultId || null, // Store vaultId if provided
        addresses: { [network]: address },
      });
    } else {
      // Update address and optionally vaultId
      if (vaultId !== undefined) {
        wallet.vaultId = vaultId;
      }
      wallet.addresses = { ...wallet.addresses, [network]: address };
    }

    return repo.save(wallet);
  }

  /**
   * Find wallet by vaultId
   */
  async findWalletByVaultId(
    vaultId: string,
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity | null> {
    const repo = queryRunner ? queryRunner.manager.getRepository(WalletEntity) : this.walletRepo;
    return repo.findOne({ where: { vaultId } });
  }

  /**
   * Get vaultId for user (from any of their wallets)
   */
  async getVaultIdForUser(userId: string, queryRunner?: QueryRunner): Promise<string | null> {
    const wallets = await this.getWalletsByUserId(userId, queryRunner);
    const walletWithVaultId = wallets.find((wallet) => wallet.vaultId != null);
    return walletWithVaultId?.vaultId || null;
  }

  async updateWalletVaultId(
    userId: string,
    asset: AssetTypeEnum,
    vaultId: string | null,
    queryRunner?: QueryRunner,
  ): Promise<WalletEntity> {
    const repo = queryRunner ? queryRunner.manager.getRepository(WalletEntity) : this.walletRepo;

    let wallet = await repo.findOne({ where: { userId, asset } });
    if (!wallet) {
      wallet = repo.create({
        userId,
        asset,
        vaultId: vaultId, // Just pass the value directly (could be string or null)
        addresses: {},
      });
    } else {
      wallet.vaultId = vaultId;
    }

    return repo.save(wallet);
  }
}
