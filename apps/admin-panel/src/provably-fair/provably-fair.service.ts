import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SeedPairEntity } from '@zetik/shared-entities';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { RotateSeedPairDto } from './dto/rotate-seed-pair.dto';
import { SeedPairResponseDto } from './dto/seed-pair-response.dto';
import { SeedPairsListResponseDto } from './dto/seed-pairs-list-response.dto';
import { UpdateSeedPairDto } from './dto/update-seed-pair.dto';

@Injectable()
export class ProvablyFairService {
  constructor(
    @InjectRepository(SeedPairEntity)
    private readonly seedPairRepository: Repository<SeedPairEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get all seed pairs for a user with pagination
   */
  async getSeedPairs(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<SeedPairsListResponseDto> {
    // Verify user exists
    await this.verifyUserExists(userId);

    const offset = (page - 1) * limit;

    const [seedPairs, total] = await this.seedPairRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const hasNext = offset + limit < total;

    return {
      seedPairs: seedPairs.map((sp) => this.toResponseDto(sp)),
      total,
      page,
      limit,
      hasNext,
    };
  }

  /**
   * Get the current active seed pair for a user
   */
  async getActiveSeedPair(userId: string): Promise<SeedPairResponseDto | null> {
    // Verify user exists
    await this.verifyUserExists(userId);

    const activeSeedPair = await this.seedPairRepository.findOne({
      where: { userId, isActive: true },
    });

    return activeSeedPair ? this.toResponseDto(activeSeedPair) : null;
  }

  /**
   * Get a specific seed pair by ID
   */
  async getSeedPairById(userId: string, seedPairId: number): Promise<SeedPairResponseDto> {
    // Verify user exists
    await this.verifyUserExists(userId);

    const seedPair = await this.seedPairRepository.findOne({
      where: { id: seedPairId, userId },
    });

    if (!seedPair) {
      throw new NotFoundException(`Seed pair with ID ${seedPairId} not found for user ${userId}`);
    }

    return this.toResponseDto(seedPair);
  }

  /**
   * Update a seed pair
   */
  async updateSeedPair(
    userId: string,
    seedPairId: number,
    updateDto: UpdateSeedPairDto,
  ): Promise<SeedPairResponseDto> {
    // Verify user exists
    await this.verifyUserExists(userId);

    return await this.dataSource.transaction(async (manager) => {
      const seedPair = await manager.findOne(SeedPairEntity, {
        where: { id: seedPairId, userId },
      });

      if (!seedPair) {
        throw new NotFoundException(`Seed pair with ID ${seedPairId} not found for user ${userId}`);
      }

      // Update fields if provided
      if (updateDto.clientSeed !== undefined) {
        seedPair.clientSeed = updateDto.clientSeed;
      }

      if (updateDto.nonce !== undefined) {
        seedPair.nonce = updateDto.nonce;
      }

      // Handle server seed update (automatically update hash)
      if (updateDto.serverSeed !== undefined) {
        this.validateHexString(updateDto.serverSeed, 'Server seed');
        seedPair.serverSeed = updateDto.serverSeed.toLowerCase();
        seedPair.serverSeedHash = this.hashSeed(seedPair.serverSeed);
      }

      // Handle next server seed update (automatically update hash)
      if (updateDto.nextServerSeed !== undefined) {
        this.validateHexString(updateDto.nextServerSeed, 'Next server seed');
        seedPair.nextServerSeed = updateDto.nextServerSeed.toLowerCase();
        seedPair.nextServerSeedHash = this.hashSeed(seedPair.nextServerSeed);
      } else if (updateDto.nextServerSeedHash !== undefined) {
        // Allow manual hash update only if seed not provided
        this.validateHexString(updateDto.nextServerSeedHash, 'Next server seed hash');
        seedPair.nextServerSeedHash = updateDto.nextServerSeedHash.toLowerCase();
      }

      const updated = await manager.save(SeedPairEntity, seedPair);
      return this.toResponseDto(updated);
    });
  }

  /**
   * Force rotate to a new seed pair
   */
  async rotateSeedPair(
    userId: string,
    rotateDto: RotateSeedPairDto,
  ): Promise<{ old: SeedPairResponseDto; new: SeedPairResponseDto }> {
    // Verify user exists
    await this.verifyUserExists(userId);

    return await this.dataSource.transaction(async (manager) => {
      // Get current active seed pair
      const currentSeedPair = await manager.findOne(SeedPairEntity, {
        where: { userId, isActive: true },
      });

      if (!currentSeedPair) {
        throw new NotFoundException(`No active seed pair found for user ${userId}`);
      }

      // Deactivate current seed pair and reveal if there's a next server seed
      if (currentSeedPair.nextServerSeed) {
        currentSeedPair.serverSeed = currentSeedPair.nextServerSeed;
        currentSeedPair.serverSeedHash = currentSeedPair.nextServerSeedHash!;
      }
      currentSeedPair.isActive = false;
      currentSeedPair.revealedAt = new Date();
      const oldSeedPair = await manager.save(SeedPairEntity, currentSeedPair);

      // Create new active seed pair
      const newServerSeed = this.generateServerSeed();
      const newServerSeedHash = this.hashSeed(newServerSeed);
      const nextServerSeed = this.generateServerSeed();
      const nextServerSeedHash = this.hashSeed(nextServerSeed);

      const newSeedPair = manager.create(SeedPairEntity, {
        userId,
        serverSeed: newServerSeed,
        serverSeedHash: newServerSeedHash,
        clientSeed: rotateDto.clientSeed,
        nonce: '0',
        nextServerSeed,
        nextServerSeedHash,
        isActive: true,
      });

      const createdSeedPair = await manager.save(SeedPairEntity, newSeedPair);

      return {
        old: this.toResponseDto(oldSeedPair),
        new: this.toResponseDto(createdSeedPair),
      };
    });
  }

  /**
   * Helper: Verify user exists
   */
  private async verifyUserExists(userId: string): Promise<void> {
    const userExists = await this.dataSource.query(
      `SELECT EXISTS(SELECT 1 FROM users.users WHERE id = $1)`,
      [userId],
    );

    if (!userExists[0].exists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }

  /**
   * Helper: Validate hex string
   */
  private validateHexString(value: string, fieldName: string): void {
    if (value.length !== 64) {
      throw new BadRequestException(`${fieldName} must be exactly 64 characters`);
    }

    if (!/^[a-f0-9]{64}$/i.test(value)) {
      throw new BadRequestException(`${fieldName} must be a valid 64-character hexadecimal string`);
    }
  }

  /**
   * Helper: Hash a seed using SHA256
   */
  private hashSeed(seed: string): string {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Helper: Generate a random server seed
   */
  private generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Helper: Convert entity to response DTO
   */
  private toResponseDto(seedPair: SeedPairEntity): SeedPairResponseDto {
    return {
      id: seedPair.id.toString(),
      userId: seedPair.userId,
      serverSeed: seedPair.serverSeed,
      serverSeedHash: seedPair.serverSeedHash,
      clientSeed: seedPair.clientSeed,
      nonce: seedPair.nonce,
      nextServerSeed: seedPair.nextServerSeed || '',
      nextServerSeedHash: seedPair.nextServerSeedHash || '',
      isActive: seedPair.isActive,
      createdAt: seedPair.createdAt,
      updatedAt: seedPair.updatedAt,
    };
  }
}
