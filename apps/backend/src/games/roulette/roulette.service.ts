import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BetType,
  BetTypeCategory,
  GameType,
  GameTypeEnum,
  RouletteBet,
  RouletteColor,
  RouletteGame,
  UserEntity,
} from '@zetik/shared-entities';

import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';
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
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { PlaceRouletteBetDto, RouletteBetDto } from './dto/place-roulette-bet.dto';
import { RouletteBetResponseDto, RouletteGameResponseDto } from './dto/roulette-game-response.dto';

// Extended UserEntity interface for typing
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

/**
 * Safely converts a string to CurrencyEnum if it's a valid enum value
 * @param currency - The currency string to convert
 * @returns CurrencyEnum if valid, undefined otherwise
 */
function safeCurrencyConversion(currency?: string): CurrencyEnum | undefined {
  if (!currency) return undefined;

  // Check if the string is a valid CurrencyEnum value
  if (Object.values(CurrencyEnum).includes(currency as CurrencyEnum)) {
    return currency as CurrencyEnum;
  }

  return undefined;
}

@Injectable()
export class RouletteService {
  private readonly logger = new Logger(RouletteService.name);
  // European Roulette rules with mathematical house edge (2.70%)
  // House edge is achieved through multiplier ratios, not payout reductions
  // Example: straight bet pays 36:1 for 1/37 probability = 2.70% house edge
  private readonly redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  private readonly blackNumbers = [
    2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
  ];

  constructor(
    @InjectRepository(RouletteGame)
    private readonly rouletteRepository: Repository<RouletteGame>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly gameConfigService: GameConfigService,
    private readonly userBetService: UserBetService,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async placeBet(
    user: UserWithPrimaryAsset,
    dto: PlaceRouletteBetDto,
  ): Promise<RouletteGameResponseDto> {
    const lockKey = LockKeyBuilder.gameRoulette(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          this.validateBets(dto.bets);

          // Get primary asset from user context (set by JwtStrategy guard)
          const primaryAsset = user.primaryAsset;
          if (!primaryAsset) {
            throw new BadRequestException('No primary asset found for user');
          }

          // Validate each bet individually with fine-grained limits
          await this.validateIndividualBetAmounts(dto.bets, primaryAsset);

          // Calculate total bet amount using BigNumber for precision
          const totalBetAmountBN = dto.bets
            .reduce((sum, bet) => {
              return sum.plus(new BigNumber(bet.amount));
            }, new BigNumber(0))
            .decimalPlaces(8, BigNumber.ROUND_HALF_UP);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // 1) Deduct immediately on place bet (emit bet.confirmed)
            const betOperationId = randomUUID();
            const betBalanceResult = await this.balanceService.updateBalance(
              {
                operation: BalanceOperationEnum.BET,
                operationId: betOperationId,
                userId: user.id,
                amount: totalBetAmountBN,
                asset: primaryAsset,
                description: 'Roulette bet',
                houseEdge: 2.7,
                metadata: {
                  gameType: 'ROULETTE',
                  totalBets: dto.bets.length,
                },
              },
              queryRunner,
            );

            if (!betBalanceResult.success) {
              throw new BadRequestException(betBalanceResult.error || 'Insufficient balance');
            }

            // Extract fiat preservation data for display consistency
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              totalBetAmountBN.toFixed(8),
              primaryAsset,
            );

            // Generate provably fair outcome using centralized service
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.ROULETTE,
              totalBetAmountBN.toFixed(8),
            );

            // Extract seeds and nonce from outcome
            const { serverSeed, clientSeed, nonce: nonceStr } = gameOutcome;
            const nonce = parseInt(nonceStr, 10);
            const serverSeedHash = this.hashServerSeed(serverSeed);

            const rouletteBets: RouletteBet[] = dto.bets.map((bet) => ({
              type: bet.type,
              numbers: bet.numbers,
              amount: bet.amount,
            }));

            // Get the active seed pair ID for proper tracking
            const seedPair = await this.provablyFairService.getActiveSeedPair(user.id);
            if (!seedPair) {
              throw new InternalServerErrorException('No active seed pair found');
            }

            // Use the winning number from provably fair outcome
            const winningNumber = gameOutcome.value;
            const winningColor = this.getNumberColor(winningNumber);
            const { totalPayoutBN, updatedBets } = this.calculatePayouts(
              rouletteBets,
              winningNumber,
            );

            const profit = totalPayoutBN.minus(totalBetAmountBN);

            // 2) Credit winnings (if any) after the spin result
            if (totalPayoutBN.isGreaterThan(0)) {
              const winOperationId = randomUUID();
              const winResult = await this.balanceService.updateBalance(
                {
                  operation: BalanceOperationEnum.WIN,
                  operationId: winOperationId,
                  userId: user.id,
                  amount: totalPayoutBN.decimalPlaces(8, BigNumber.ROUND_HALF_UP),
                  asset: primaryAsset,
                  description: 'Roulette win',
                  metadata: {
                    gameType: 'ROULETTE',
                    winningNumber,
                    totalMultiplier: totalPayoutBN.dividedBy(totalBetAmountBN).toFixed(4),
                  },
                },
                queryRunner,
              );

              if (!winResult.success) {
                throw new BadRequestException(winResult.error || 'Failed to credit winnings');
              }
            }

            const game = queryRunner.manager.create(RouletteGame, {
              id: randomUUID(),
              userId: user.id,
              asset: primaryAsset,
              seedPairId: seedPair.id,
              bets: rouletteBets,
              totalBetAmount: totalBetAmountBN.toFixed(8),
              nonce,
              clientSeed,
              isCompleted: false,
              // Include fiat preservation data
              originalFiatAmount: fiatData.originalFiatAmount,
              originalFiatCurrency: fiatData.originalFiatCurrency,
              fiatToUsdRate: fiatData.fiatToUsdRate,
            });

            await queryRunner.manager.save(game);

            game.winningNumber = winningNumber;
            game.winningColor = winningColor;
            game.totalPayout = totalPayoutBN.toFixed(8);
            game.profit = profit.toFixed(8);
            game.totalMultiplier = totalPayoutBN.isGreaterThan(0)
              ? totalPayoutBN.dividedBy(totalBetAmountBN).toFixed(4)
              : '0.0000';
            game.bets = updatedBets;
            game.isCompleted = true;

            const finalGame = await queryRunner.manager.save(game);

            await queryRunner.commitTransaction();

            // Record bet in user_bets table
            try {
              // Calculate bet feed display values
              let betFeedMultiplier: string;
              let betFeedPayout: string;

              if (
                finalGame.totalMultiplier &&
                finalGame.totalMultiplier !== '0.0000' &&
                finalGame.totalMultiplier !== '0' &&
                totalPayoutBN.isGreaterThan(0)
              ) {
                // Win: show actual multiplier and total payout
                betFeedMultiplier = finalGame.totalMultiplier;
                betFeedPayout = finalGame.totalPayout || '0.00000000';
              } else {
                // Loss: show 0.00x multiplier and 0 payout
                betFeedMultiplier = '0.0000';
                betFeedPayout = '0.00000000';
              }

              await this.userBetService.createUserBet({
                userId: user.id,
                game: GameTypeEnum.ROULETTE,
                betId: finalGame.id,
                betAmount: finalGame.totalBetAmount,
                asset: finalGame.asset,
                multiplier: betFeedMultiplier,
                payout: betFeedPayout,
                // Include fiat preservation data
                originalFiatAmount: finalGame.originalFiatAmount,
                originalFiatCurrency: safeCurrencyConversion(finalGame.originalFiatCurrency),
                fiatToUsdRate: finalGame.fiatToUsdRate,
              });
            } catch (error) {
              this.logger.error('Failed to record roulette bet', {
                gameId: finalGame.id,
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            return await this.mapToResponseDto(finalGame, serverSeedHash);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for roulette bet', {
          userId: user.id,
          betCount: dto.bets.length,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async getGameHistory(userId: string, limit = 50, offset = 0): Promise<RouletteGameResponseDto[]> {
    const games = await this.rouletteRepository.find({
      where: { userId, isCompleted: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return await Promise.all(
      games.map(async (game) => await this.mapToResponseDto(game, game.seedPairId.toString())),
    );
  }

  async getUserBetById(betId: string): Promise<any> {
    return await this.userBetService.getUserBetById(GameTypeEnum.ROULETTE, betId);
  }

  async getBetById(betId: string): Promise<RouletteGameResponseDto> {
    const game = await this.rouletteRepository.findOne({
      where: { id: betId },
      relations: ['user'],
    });

    if (!game) {
      throw new NotFoundException('Bet not found');
    }

    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === game.userId);

    const userInfo = game.user.isPrivate
      ? null
      : {
          id: game.user.id,
          userName: game.user.displayName || game.user.username,
          levelImageUrl: userVipStatus?.vipLevelImage || '',
        };

    return await this.mapToResponseDto(game, game.seedPairId.toString(), userInfo);
  }

  getConfiguration(): {
    betTypes: string[];
    payoutMultipliers: Record<string, number>;
  } {
    // Return hardcoded configuration as per simplified approach
    return {
      betTypes: [
        'STRAIGHT',
        'SPLIT',
        'STREET',
        'CORNER',
        'LINE',
        'BASKET',
        'TRIO',
        'COLUMN',
        'DOZEN',
        'RED',
        'BLACK',
        'EVEN',
        'ODD',
        'LOW',
        'HIGH',
      ],
      payoutMultipliers: {
        STRAIGHT: 36,
        SPLIT: 18,
        STREET: 12,
        CORNER: 9,
        LINE: 6,
        BASKET: 9,
        TRIO: 12,
        COLUMN: 3,
        DOZEN: 3,
        RED: 2,
        BLACK: 2,
        EVEN: 2,
        ODD: 2,
        LOW: 2,
        HIGH: 2,
      },
    };
  }

  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  private validateBets(bets: RouletteBetDto[]): void {
    this.validateBetNumbers(bets);
  }

  private validateBetNumbers(bets: RouletteBetDto[]): void {
    for (const bet of bets) {
      this.validateSingleBetNumbers(bet.type, bet.numbers);
    }
  }

  /**
   * Validate individual bet amounts with fine-grained limits
   */
  private async validateIndividualBetAmounts(
    bets: RouletteBetDto[],
    asset: AssetTypeEnum,
  ): Promise<void> {
    for (const bet of bets) {
      const betTypeCategory = this.getBetTypeCategory(bet.type);

      try {
        const validation = await this.gameConfigService.validateBetTypeAmount(
          GameType.ROULETTE,
          betTypeCategory,
          bet.amount,
          asset,
        );

        if (!validation.isValid) {
          throw new BadRequestException(
            validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
          );
        }

        this.logger.debug(
          `${bet.type} bet amount ${bet.amount} ${asset} validated (${validation.usdAmount?.toFixed(2)} USD)`,
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }

        this.logger.warn(
          `Failed to validate ${bet.type} bet amount with fine-grained limits, using fallback:`,
          error,
        );
        // Fallback to general game limits
        await this.validateBetAmountFallback(bet.amount, asset);
      }
    }
  }

  /**
   * Determine bet type category for roulette bets
   */
  private getBetTypeCategory(betType: BetType): BetTypeCategory {
    // Inside bets: straight, split, street, corner, line, basket, trio
    const insideBets = [
      BetType.STRAIGHT,
      BetType.SPLIT,
      BetType.STREET,
      BetType.CORNER,
      BetType.LINE,
      BetType.BASKET,
      BetType.TRIO,
    ];

    // Outside bets: red/black, odd/even, low/high, dozens, columns
    const outsideBets = [
      BetType.RED,
      BetType.BLACK,
      BetType.EVEN,
      BetType.ODD,
      BetType.LOW,
      BetType.HIGH,
      BetType.DOZEN,
      BetType.COLUMN,
    ];

    if (insideBets.includes(betType)) {
      return BetTypeCategory.ROULETTE_INSIDE;
    } else if (outsideBets.includes(betType)) {
      return BetTypeCategory.ROULETTE_OUTSIDE;
    } else {
      // Fallback to general limits for unknown bet types
      return BetTypeCategory.DEFAULT;
    }
  }

  /**
   * Fallback bet amount validation using general game limits
   */
  private async validateBetAmountFallback(betAmount: string, asset: AssetTypeEnum): Promise<void> {
    try {
      const validation = await this.gameConfigService.validateBetAmount(
        GameType.ROULETTE,
        betAmount,
        asset,
      );

      if (!validation.isValid) {
        throw new BadRequestException(
          validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
        );
      }

      this.logger.debug(
        `Fallback bet amount ${betAmount} ${asset} validated (${validation.usdAmount?.toFixed(2)} USD)`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(
        'Failed to validate bet amount with USD conversion, using hardcoded fallback:',
        error,
      );
      // Hardcoded fallback validation
      const betAmountBN = new BigNumber(betAmount);
      if (betAmountBN.isLessThan('0.00000001')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
      }
      if (betAmountBN.isGreaterThan('100')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_LARGE);
      }
    }
  }

  private validateSingleBetNumbers(betType: BetType, numbers: number[]): void {
    if (numbers.some((num) => num < 0 || num > 36)) {
      throw new BadRequestException('Numbers must be between 0 and 36');
    }

    const expectedCount = this.getExpectedNumberCount(betType);
    if (numbers.length !== expectedCount) {
      throw new BadRequestException(
        `${betType} bet requires exactly ${expectedCount} number(s), got ${numbers.length}`,
      );
    }

    switch (betType) {
      case BetType.STRAIGHT:
        break;
      case BetType.SPLIT:
        if (!this.isValidSplit(numbers)) {
          throw new BadRequestException('Invalid split bet: numbers must be adjacent');
        }
        break;
      case BetType.STREET:
        if (!this.isValidStreet(numbers)) {
          throw new BadRequestException('Invalid street bet: numbers must form a row');
        }
        break;
      case BetType.CORNER:
        if (!this.isValidCorner(numbers)) {
          throw new BadRequestException('Invalid corner bet: numbers must form a square');
        }
        break;
      case BetType.LINE:
        if (!this.isValidLine(numbers)) {
          throw new BadRequestException('Invalid line bet: numbers must form two adjacent rows');
        }
        break;
      case BetType.BASKET:
        if (!this.isValidBasket(numbers)) {
          throw new BadRequestException('Invalid basket bet: numbers must be 0, 1, 2, 3');
        }
        break;
      case BetType.TRIO:
        if (!this.isValidTrio(numbers)) {
          throw new BadRequestException('Invalid trio bet: numbers must be 0, 1, 2 or 0, 2, 3');
        }
        break;
      case BetType.COLUMN:
        if (!this.isValidColumn(numbers)) {
          throw new BadRequestException('Invalid column bet');
        }
        break;
      case BetType.DOZEN:
        if (!this.isValidDozen(numbers)) {
          throw new BadRequestException('Invalid dozen bet');
        }
        break;
    }
  }

  private getExpectedNumberCount(betType: BetType): number {
    switch (betType) {
      case BetType.STRAIGHT:
        return 1;
      case BetType.SPLIT:
        return 2;
      case BetType.STREET:
        return 3;
      case BetType.CORNER:
        return 4;
      case BetType.LINE:
        return 6;
      case BetType.BASKET:
        return 4;
      case BetType.TRIO:
        return 3;
      case BetType.COLUMN:
        return 12;
      case BetType.DOZEN:
        return 12;
      case BetType.RED:
        return 18;
      case BetType.BLACK:
        return 18;
      case BetType.EVEN:
        return 18;
      case BetType.ODD:
        return 18;
      case BetType.LOW:
        return 18;
      case BetType.HIGH:
        return 18;
      default:
        throw new BadRequestException(`Unknown bet type: ${String(betType)}`);
    }
  }

  private isValidSplit(numbers: number[]): boolean {
    if (numbers.length !== 2) return false;
    const [a, b] = numbers.sort((x, y) => x - y);

    if (a === 0) return b === 1 || b === 2 || b === 3;

    const row1 = Math.floor((a - 1) / 3);
    const col1 = (a - 1) % 3;
    const row2 = Math.floor((b - 1) / 3);
    const col2 = (b - 1) % 3;

    return (
      (Math.abs(row1 - row2) === 1 && col1 === col2) ||
      (row1 === row2 && Math.abs(col1 - col2) === 1)
    );
  }

  private isValidStreet(numbers: number[]): boolean {
    if (numbers.length !== 3) return false;
    const sorted = numbers.sort((a, b) => a - b);
    const baseRow = Math.floor((sorted[0] - 1) / 3) * 3 + 1;
    return sorted[0] === baseRow && sorted[1] === baseRow + 1 && sorted[2] === baseRow + 2;
  }

  private isValidCorner(numbers: number[]): boolean {
    if (numbers.length !== 4) return false;
    const sorted = numbers.sort((a, b) => a - b);
    const [a, b, c, d] = sorted;

    const row = Math.floor((a - 1) / 3);
    const col = (a - 1) % 3;

    return b === a + 1 && c === a + 3 && d === a + 4 && col < 2 && row < 11;
  }

  private isValidLine(numbers: number[]): boolean {
    if (numbers.length !== 6) return false;
    const sorted = numbers.sort((a, b) => a - b);
    const baseRow = Math.floor((sorted[0] - 1) / 3) * 3 + 1;
    const expectedNumbers = [
      baseRow,
      baseRow + 1,
      baseRow + 2,
      baseRow + 3,
      baseRow + 4,
      baseRow + 5,
    ];
    return JSON.stringify(sorted) === JSON.stringify(expectedNumbers);
  }

  private isValidBasket(numbers: number[]): boolean {
    if (numbers.length !== 4) return false;
    const sorted = numbers.sort((a, b) => a - b);
    return JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3]);
  }

  private isValidTrio(numbers: number[]): boolean {
    if (numbers.length !== 3) return false;
    const sorted = numbers.sort((a, b) => a - b);
    return (
      JSON.stringify(sorted) === JSON.stringify([0, 1, 2]) ||
      JSON.stringify(sorted) === JSON.stringify([0, 2, 3])
    );
  }

  private isValidColumn(numbers: number[]): boolean {
    if (numbers.length !== 12) return false;
    const col = (numbers[0] - 1) % 3;
    return numbers.every((num) => (num - 1) % 3 === col && num >= 1 && num <= 36);
  }

  private isValidDozen(numbers: number[]): boolean {
    if (numbers.length !== 12) return false;
    const dozen = Math.floor((numbers[0] - 1) / 12);
    const start = dozen * 12 + 1;
    const end = start + 11;
    return numbers.every((num) => num >= start && num <= end);
  }

  private getNumberColor(number: number): RouletteColor {
    if (number === 0) return RouletteColor.GREEN;
    if (this.redNumbers.includes(number)) return RouletteColor.RED;
    return RouletteColor.BLACK;
  }

  private calculatePayouts(
    bets: RouletteBet[],
    winningNumber: number,
  ): { totalPayoutBN: BigNumber; updatedBets: RouletteBet[] } {
    let totalPayoutBN = new BigNumber(0);
    const updatedBets: RouletteBet[] = [];

    for (const bet of bets) {
      const isWinning = this.isBetWinning(bet.type, bet.numbers, winningNumber);
      let payoutBN = new BigNumber(0);

      if (isWinning) {
        const multiplier = this.getBaseMultiplier(bet.type);

        // Use BigNumber for precise calculations
        const betAmountBN = new BigNumber(bet.amount);

        if (betAmountBN.isNaN() || betAmountBN.isLessThanOrEqualTo(0)) {
          this.logger.error(`Invalid bet amount`, {
            betType: bet.type,
            betAmount: bet.amount,
          });
          throw new InternalServerErrorException('Invalid bet amount');
        }

        // Calculate payout with proper precision (8 decimal places)
        payoutBN = betAmountBN.multipliedBy(multiplier).decimalPlaces(8, BigNumber.ROUND_DOWN);

        if (payoutBN.isNaN()) {
          this.logger.error(`Payout calculation resulted in NaN`, {
            betType: bet.type,
            betAmount: bet.amount,
            multiplier,
          });
          throw new InternalServerErrorException('Payout calculation error');
        }

        totalPayoutBN = totalPayoutBN.plus(payoutBN);
      }

      updatedBets.push({
        ...bet,
        payout: isWinning ? parseFloat(payoutBN.toFixed(8)) : 0,
      });
    }

    return { totalPayoutBN, updatedBets };
  }

  private isBetWinning(betType: BetType, numbers: number[], winningNumber: number): boolean {
    switch (betType) {
      case BetType.STRAIGHT:
      case BetType.SPLIT:
      case BetType.STREET:
      case BetType.CORNER:
      case BetType.LINE:
      case BetType.BASKET:
      case BetType.TRIO:
      case BetType.COLUMN:
      case BetType.DOZEN:
        return numbers.includes(winningNumber);
      case BetType.RED:
        return this.redNumbers.includes(winningNumber);
      case BetType.BLACK:
        return this.blackNumbers.includes(winningNumber);
      case BetType.EVEN:
        return winningNumber > 0 && winningNumber % 2 === 0;
      case BetType.ODD:
        return winningNumber > 0 && winningNumber % 2 === 1;
      case BetType.LOW:
        return winningNumber >= 1 && winningNumber <= 18;
      case BetType.HIGH:
        return winningNumber >= 19 && winningNumber <= 36;
      default:
        return false;
    }
  }

  private getBaseMultiplier(betType: BetType): number {
    switch (betType) {
      case BetType.STRAIGHT:
        return 36;
      case BetType.SPLIT:
        return 18;
      case BetType.STREET:
        return 12;
      case BetType.CORNER:
        return 9;
      case BetType.LINE:
        return 6;
      case BetType.BASKET:
        return 9;
      case BetType.TRIO:
        return 12;
      case BetType.COLUMN:
      case BetType.DOZEN:
        return 3;
      case BetType.RED:
      case BetType.BLACK:
      case BetType.EVEN:
      case BetType.ODD:
      case BetType.LOW:
      case BetType.HIGH:
        return 2;
      default:
        return 0;
    }
  }

  private async mapToResponseDto(
    game: RouletteGame,
    serverSeedHash: string,
    user?: { id: string; userName: string; levelImageUrl: string } | null,
  ): Promise<RouletteGameResponseDto> {
    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.ROULETTE, game.id);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: any;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.totalMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.totalMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = safeCurrencyConversion(userBet.originalFiatCurrency);
    }

    // Map bets to response DTOs
    const bets: RouletteBetResponseDto[] = game.bets.map((bet) => {
      return {
        type: bet.type,
        numbers: bet.numbers,
        amount: bet.amount,
        payout: bet.payout ? bet.payout.toString() : undefined,
        originalFiatAmount: userBet?.originalFiatAmount
          ? (
              (parseFloat(userBet.originalFiatAmount) * parseFloat(bet.amount)) /
              parseFloat(game.totalBetAmount)
            ).toFixed(2)
          : undefined,
        originalFiatCurrency: userBet?.originalFiatCurrency,
        fiatToUsdRate: userBet?.fiatToUsdRate,
      };
    });

    return {
      id: game.id,
      user: user ?? null,
      asset: game.asset,
      bets,
      totalBetAmount: game.totalBetAmount,
      winningNumber: game.winningNumber,
      winningColor: game.winningColor,
      totalPayout: game.totalPayout,
      profit: game.profit,
      totalMultiplier: game.totalMultiplier || '0.0000',
      isCompleted: game.isCompleted,
      serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      createdAt: game.createdAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }
}
