import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  BalanceOperationEnum,
  GameType,
  GameTypeEnum,
  KenoGameEntity,
  KenoGameStatus,
  KenoRiskLevel,
  UserEntity,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { KenoConfigResponseDto } from './dto/keno-config-response.dto';
import { KenoGameResponseDto } from './dto/keno-game-response.dto';
import { PlaceKenoBetDto } from './dto/place-keno-bet.dto';

@Injectable()
export class KenoService {
  private readonly logger = new Logger(KenoService.name);

  // Custom multiplier tables optimized for 99% RTP across all risk levels
  // Each risk level offers different volatility patterns while maintaining fair returns
  private readonly multiplierTables: Record<KenoRiskLevel, Record<number, string[]>> = {
    [KenoRiskLevel.CLASSIC]: {
      0: [],
      1: ['0.0', '3.96'],
      2: ['0.0', '1.9', '4.5'],
      3: ['0.0', '1.0', '3.1', '10.4'],
      4: ['0.0', '0.8', '1.8', '5.0', '22.5'],
      5: ['0.0', '0.25', '1.4', '4.1', '16.5', '36.0'],
      6: ['0.0', '0.0', '1.0', '3.68', '7.0', '16.5', '40.0'],
      7: ['0.0', '0.0', '0.47', '3.0', '4.5', '14.0', '31.0', '60.0'],
      8: ['0.0', '0.0', '0.0', '2.2', '4.0', '13.0', '22.0', '55.0', '70.0'],
      9: ['0.0', '0.0', '0.0', '1.55', '3.0', '8.0', '15.0', '44.0', '60.0', '85.0'],
      10: ['0.0', '0.0', '0.0', '1.4', '2.25', '4.5', '8.0', '17.0', '50.0', '80.0', '100.0'],
    },
    [KenoRiskLevel.LOW]: {
      0: [],
      1: ['0.7', '1.85'],
      2: ['0.0', '2.0', '3.8'],
      3: ['0.0', '1.1', '1.38', '26.0'],
      4: ['0.0', '0.0', '2.2', '7.9', '90.0'],
      5: ['0.0', '0.0', '1.5', '4.2', '13.0', '300.0'],
      6: ['0.0', '0.0', '1.1', '2.0', '6.2', '100.0', '700.0'],
      7: ['0.0', '0.0', '1.1', '1.6', '3.5', '15.0', '225.0', '700.0'],
      8: ['0.0', '0.0', '1.1', '1.5', '2.0', '5.5', '39.0', '100.0', '800.0'],
      9: ['0.0', '0.0', '1.1', '1.3', '1.7', '2.5', '7.5', '50.0', '250.0', '1000.0'],
      10: ['0.0', '0.0', '1.1', '1.2', '1.3', '1.8', '3.5', '13.0', '50.0', '250.0', '1000.0'],
    },
    [KenoRiskLevel.MEDIUM]: {
      0: [],
      1: ['0.4', '2.75'],
      2: ['0.0', '1.8', '5.1'],
      3: ['0.0', '0.0', '2.8', '50.0'],
      4: ['0.0', '0.0', '1.7', '10.0', '100.0'],
      5: ['0.0', '0.0', '1.4', '4.0', '14.0', '390.0'],
      6: ['0.0', '0.0', '0.0', '3.0', '9.0', '180.0', '710.0'],
      7: ['0.0', '0.0', '0.0', '2.0', '7.0', '30.0', '400.0', '800.0'],
      8: ['0.0', '0.0', '0.0', '2.0', '4.0', '11.0', '67.0', '400.0', '900.0'],
      9: ['0.0', '0.0', '0.0', '2.0', '2.5', '500.0', '15.0', '100.0', '500.0', '1000.0'],
      10: ['0.0', '0.0', '0.0', '1.6', '2.0', '4.0', '7.0', '26.0', '100.0', '500.0', '1000.0'],
    },
    [KenoRiskLevel.HIGH]: {
      0: [],
      1: ['0.0', '3.96'],
      2: ['0.0', '0.0', '17.1'],
      3: ['0.0', '0.0', '0.0', '81.5'],
      4: ['0.0', '0.0', '0.0', '10.0', '259.0'],
      5: ['0.0', '0.0', '0.0', '4.5', '48.0', '450.0'],
      6: ['0.0', '0.0', '0.0', '0.0', '11.0', '350.0', '710.0'],
      7: ['0.0', '0.0', '0.0', '0.0', '7.0', '90.0', '400.0', '800.0'],
      8: ['0.0', '0.0', '0.0', '0.0', '5.0', '20.0', '270.0', '600.0', '900.0'],
      9: ['0.0', '0.0', '0.0', '0.0', '4.0', '11.0', '56.0', '500.0', '800.0', '1000.0'],
      10: ['0.0', '0.0', '0.0', '0.0', '3.5', '8.0', '13.0', '63.0', '500.0', '800.0', '1000.0'],
    },
  };

  constructor(
    @InjectRepository(KenoGameEntity)
    private kenoGameRepository: Repository<KenoGameEntity>,
    private balanceService: BalanceService,
    private dataSource: DataSource,
    private gameConfigService: GameConfigService,
    private houseEdgeService: HouseEdgeService,
    private provablyFairService: ProvablyFairService,
    private userBetService: UserBetService,
    private userVipStatusService: UserVipStatusService,
    private fiatPreservationService: FiatPreservationService,
    private distributedLockService: DistributedLockService,
  ) {}

  async placeBet(user: UserEntity, dto: PlaceKenoBetDto): Promise<KenoGameResponseDto> {
    // Validate selected numbers
    this.validateSelectedNumbers(dto.selectedNumbers);

    // Acquire distributed lock for user bet to prevent race conditions across multiple instances
    const lockKey = LockKeyBuilder.gameKeno(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          // Get primary wallet for user
          const primaryWallet = await this.balanceService.getPrimaryWallet(user.id);
          if (!primaryWallet) {
            throw new BadRequestException('No primary wallet found for user');
          }
          const primaryAsset = primaryWallet.asset;

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Validate bet amount using GameConfigService
            const validation = await this.gameConfigService.validateBetAmount(
              GameType.KENO,
              dto.betAmount,
              primaryAsset,
            );

            if (!validation.isValid) {
              throw new BadRequestException(
                validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
              );
            }

            this.logger.log(`User ${user.id} placing keno bet`, {
              amount: dto.betAmount,
              selectedNumbers: dto.selectedNumbers,
              riskLevel: dto.riskLevel,
              asset: primaryAsset,
            });

            // Use centralized provably fair service to generate game outcome
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.KENO,
              dto.betAmount.toString(),
            );

            // Generate drawn numbers using centralized provably fair method
            const drawnNumbers = this.generateDrawnNumbers(
              gameOutcome.serverSeed,
              gameOutcome.clientSeed,
              parseInt(gameOutcome.nonce),
            );

            // Calculate matches
            const matches = this.calculateMatches(dto.selectedNumbers, drawnNumbers);

            // Get house edge for keno
            const houseEdge = this.houseEdgeService.getEdge('keno');
            if (!houseEdge) {
              throw new Error('House edge not found for keno game');
            }

            // Calculate payout using fixed multiplier tables
            const payoutMultiplier = this.getPayoutMultiplier(
              dto.riskLevel,
              dto.selectedNumbers.length,
              matches,
            );

            const winAmountBN = new BigNumber(dto.betAmount).multipliedBy(payoutMultiplier);

            // Extract fiat preservation data for display consistency
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              dto.betAmount,
              primaryAsset,
            );

            // Protect against BigNumber overflow and ensure 8 decimal precision
            let winAmount = '0';
            if (payoutMultiplier > 0) {
              // Use pure BigNumber flow to avoid JS number precision issues
              const rounded = winAmountBN.decimalPlaces(8, BigNumber.ROUND_HALF_UP);
              if (!rounded.isFinite() || rounded.isNaN()) {
                throw new BadRequestException('Win amount calculation error');
              }
              winAmount = rounded.toString();
            }

            let finalPayout = '0';
            let balanceResult;

            if (payoutMultiplier > 0 && parseFloat(winAmount) > 0) {
              // Win: Batch balance update [BET, WIN]
              const operationId = randomUUID();
              const winOperationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                [
                  {
                    operation: BalanceOperationEnum.BET,
                    operationId,
                    userId: user.id,
                    amount: new BigNumber(dto.betAmount),
                    asset: primaryAsset,
                    description: 'Keno bet',
                    houseEdge,
                    metadata: {
                      gameSessionId: dto.gameSessionId,
                      gameType: 'KENO',
                      riskLevel: dto.riskLevel,
                      selectedNumbers: dto.selectedNumbers,
                      drawnNumbers,
                      matches,
                    },
                  },
                  {
                    operation: BalanceOperationEnum.WIN,
                    operationId: winOperationId,
                    userId: user.id,
                    amount: new BigNumber(winAmount),
                    asset: primaryAsset,
                    description: 'Keno win',
                    metadata: {
                      gameSessionId: dto.gameSessionId,
                      gameType: 'KENO',
                      multiplier: payoutMultiplier,
                      matches,
                    },
                  },
                ],
                queryRunner,
              );

              finalPayout = winAmount;
            } else {
              // Loss: Single balance update [BET]
              const operationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                [
                  {
                    operation: BalanceOperationEnum.BET,
                    operationId,
                    userId: user.id,
                    amount: new BigNumber(dto.betAmount),
                    asset: primaryAsset,
                    description: 'Keno bet',
                    houseEdge,
                    metadata: {
                      gameSessionId: dto.gameSessionId,
                      gameType: 'KENO',
                      riskLevel: dto.riskLevel,
                      selectedNumbers: dto.selectedNumbers,
                      drawnNumbers,
                      matches,
                    },
                  },
                ],
                queryRunner,
              );

              finalPayout = '0';
            }

            if (!balanceResult.success) {
              throw new BadRequestException(balanceResult.error || 'Insufficient balance');
            }

            // Create game record
            const gameEntity = this.kenoGameRepository.create({
              userId: user.id,
              user: user,
              gameSessionId: dto.gameSessionId,
              betAmount: dto.betAmount,
              asset: primaryAsset,
              status: KenoGameStatus.COMPLETED,
              riskLevel: dto.riskLevel,
              selectedNumbers: dto.selectedNumbers,
              drawnNumbers,
              matches,
              winAmount: finalPayout,
              payoutMultiplier: payoutMultiplier.toString(),
              serverSeedHash: gameOutcome.hash,
              clientSeed: gameOutcome.clientSeed,
              nonce: gameOutcome.nonce,
              serverSeed: gameOutcome.serverSeed,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const savedGame = await queryRunner.manager.save(gameEntity);

            // Commit transaction
            await queryRunner.commitTransaction();

            this.logger.log(`Keno game completed successfully`, {
              gameId: savedGame.id,
              userId: user.id,
              matches,
              multiplier: payoutMultiplier,
              winAmount: finalPayout,
            });

            // Create bet record
            await this.userBetService.createUserBet({
              game: GameTypeEnum.KENO,
              betId: savedGame.id,
              userId: user.id,
              betAmount: dto.betAmount,
              asset: primaryAsset,
              multiplier: payoutMultiplier.toString(),
              payout: finalPayout,
              // Include fiat preservation data
              originalFiatAmount: fiatData.originalFiatAmount,
              originalFiatCurrency: fiatData.originalFiatCurrency,
              fiatToUsdRate: fiatData.fiatToUsdRate,
            });

            // Get user VIP info for response
            const userVipInfos = await this.userVipStatusService.getUsersVipStatus([user.id]);
            const userVipInfo = userVipInfos.length > 0 ? userVipInfos[0] : null;

            return await this.mapToResponseDto(savedGame, userVipInfo);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
              `Error in Keno placeBet: ${error instanceof Error ? error.message : String(error)}`,
              {
                userId: user.id,
                gameSessionId: dto.gameSessionId,
                error: error instanceof Error ? error.stack : undefined,
              },
            );

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException(ERROR_MESSAGES.SYSTEM.INTERNAL_SERVER_ERROR);
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for keno bet', {
          userId: user.id,
          betAmount: dto.betAmount,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  private validateSelectedNumbers(selectedNumbers: number[]): void {
    if (!selectedNumbers || selectedNumbers.length === 0) {
      throw new BadRequestException('At least one number must be selected');
    }

    if (selectedNumbers.length > 10) {
      throw new BadRequestException('Maximum 10 numbers can be selected');
    }

    // Check for valid range (1-40)
    for (const num of selectedNumbers) {
      if (!Number.isInteger(num) || num < 1 || num > 40) {
        throw new BadRequestException('Selected numbers must be integers between 1 and 40');
      }
    }

    // Check for duplicates
    const uniqueNumbers = new Set(selectedNumbers);
    if (uniqueNumbers.size !== selectedNumbers.length) {
      throw new BadRequestException('Duplicate numbers are not allowed');
    }
  }

  private generateDrawnNumbers(serverSeed: string, clientSeed: string, nonce: number): number[] {
    const drawnNumbers: number[] = [];
    const availableNumbers = Array.from({ length: 40 }, (_, i) => i + 1);

    // Generate 10 unique numbers using cursor-based approach
    for (let cursor = 0; cursor < 10; cursor++) {
      // Generate random value using cursor
      const randomValue = this.provablyFairService.generateRandomValue(
        serverSeed,
        clientSeed,
        nonce.toString(),
        cursor,
      );

      // Select number from remaining available numbers
      const index = Math.floor(randomValue * availableNumbers.length);
      const selectedNumber = availableNumbers.splice(index, 1)[0];
      drawnNumbers.push(selectedNumber);
    }

    return drawnNumbers.sort((a, b) => a - b);
  }

  private calculateMatches(selectedNumbers: number[], drawnNumbers: number[]): number {
    const drawnSet = new Set(drawnNumbers);
    return selectedNumbers.filter((num) => drawnSet.has(num)).length;
  }

  private getPayoutMultiplier(
    riskLevel: KenoRiskLevel,
    selectedCount: number,
    matches: number,
  ): number {
    // Validate input parameters
    if (matches < 0 || selectedCount < 1 || selectedCount > 10 || matches > selectedCount) {
      return 0;
    }

    const multipliers = this.multiplierTables[riskLevel][selectedCount];
    if (!multipliers || matches >= multipliers.length) {
      return 0;
    }

    const multiplier = parseFloat(multipliers[matches]);
    if (isNaN(multiplier) || multiplier === 0) {
      return 0;
    }

    // Return fixed multiplier (already calculated for 1% house edge)
    this.logger.debug(`Keno payout calculation`, {
      riskLevel,
      selectedCount,
      matches,
      multiplier: multiplier.toFixed(4),
    });

    return multiplier;
  }

  getConfig(): KenoConfigResponseDto {
    // Use hardcoded configuration (game logic no longer stored in database)
    return {
      riskLevels: Object.values(KenoRiskLevel),
      multiplierTables: this.multiplierTables,
    };
  }

  async getGameHistory(userId: string, limit: number = 50): Promise<KenoGameResponseDto[]> {
    const games = await this.kenoGameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });

    // Get VIP info for all unique users
    const userIds = [...new Set(games.map((game) => game.userId))];
    const vipInfos = await this.userVipStatusService.getUsersVipStatus(userIds);
    const vipInfoMap = new Map(vipInfos.map((info) => [info.userId, info]));

    return await Promise.all(
      games.map((game) => this.mapToResponseDto(game, vipInfoMap.get(game.userId))),
    );
  }

  async getGameById(gameId: string): Promise<KenoGameResponseDto | null> {
    const game = await this.kenoGameRepository.findOne({
      where: { id: gameId },
      relations: ['user'],
    });

    if (!game) {
      return null;
    }

    const vipInfos = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipInfo = vipInfos.length > 0 ? vipInfos[0] : null;

    return await this.mapToResponseDto(game, userVipInfo);
  }

  async getUserBetById(betId: string): Promise<KenoGameResponseDto | null> {
    const game = await this.kenoGameRepository.findOne({
      where: { id: betId },
      relations: ['user'],
    });

    if (!game) {
      return null;
    }

    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === game.userId);

    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.KENO, betId);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.payoutMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.payoutMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
    }

    return {
      id: game.id,
      user: {
        id: game.user.id,
        userName: game.user.displayName || game.user.username,
        levelImageUrl: userVipStatus?.vipLevelImage || '',
      },
      gameSessionId: game.gameSessionId,
      betAmount: game.betAmount,
      asset: game.asset,
      status: game.status,
      riskLevel: game.riskLevel,
      selectedNumbers: game.selectedNumbers,
      drawnNumbers: game.drawnNumbers,
      matches: game.matches,
      winAmount: game.winAmount,
      payoutMultiplier: game.payoutMultiplier,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: game.status === KenoGameStatus.COMPLETED ? game.serverSeed : undefined,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }

  private async mapToResponseDto(
    game: KenoGameEntity,
    userVipInfo?: any,
  ): Promise<KenoGameResponseDto> {
    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.KENO, game.id);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.payoutMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.payoutMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
    }

    return {
      id: game.id,
      user: game.user?.isPrivate
        ? null
        : userVipInfo
          ? {
              id: game.user?.id || game.userId,
              userName: game.user?.username || 'Unknown',
              levelImageUrl: userVipInfo.vipLevelImage,
            }
          : {
              id: game.userId,
              userName: 'Unknown',
              levelImageUrl: 'user-level/bronze-1',
            },
      gameSessionId: game.gameSessionId,
      betAmount: game.betAmount,
      asset: game.asset,
      status: game.status,
      riskLevel: game.riskLevel,
      selectedNumbers: game.selectedNumbers,
      drawnNumbers: game.drawnNumbers,
      matches: game.matches,
      winAmount: game.winAmount,
      payoutMultiplier: game.payoutMultiplier,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: game.status === KenoGameStatus.COMPLETED ? game.serverSeed : undefined,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }
}
