import { Provider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

// Import actual service classes for proper DI tokens
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { AffiliateService } from '../affiliate/affiliate.service';
import { BalanceService } from '../balance/balance.service';
import { CryptoConverterService } from '../balance/services/crypto-converter.service';
import { CurrencyRateService } from '../balance/services/currency-rate.service';
import { UserVipStatusService } from '../bonus/services/user-vip-status.service';
import { VipTierService } from '../bonus/services/vip-tier.service';
import { DistributedLockService } from '../common/services/distributed-lock.service';
import { LockMetricsService } from '../common/services/lock-metrics.service';
import { RedisService } from '../common/services/redis.service';
import { BlackjackCardService } from '../games/blackjack/services/blackjack-card.service';
import { BlackjackGameLogicService } from '../games/blackjack/services/blackjack-game-logic.service';
import { BlackjackPayoutService } from '../games/blackjack/services/blackjack-payout.service';
import { CrashWebSocketService } from '../games/crash/services/crash-websocket.service';
import { GameConfigService } from '../games/services/game-config.service';
import { HouseEdgeService } from '../games/services/house-edge.service';
import { ProvablyFairService } from '../games/services/provably-fair.service';
import { UserBetService } from '../games/services/user-bet.service';
import { DailyGamblingStatsService } from '../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../websocket/services/notification.service';

// Import entities for proper repository tokens
import {
  BalanceHistoryEntity,
  BalanceWalletEntity,
  BlackjackGameEntity,
  BonusTransactionEntity,
  BonusVipTierEntity,
  CrashBetEntity,
  CrashGameEntity,
  DiceBetEntity,
  GameConfigEntity,
  GameResultEntity,
  GameSessionEntity,
  KenoGameEntity,
  LimboGameEntity,
  MinesGameEntity,
  PlinkoGameEntity,
  SeedPairEntity,
  UserBetEntity,
  UserEntity,
  UserVipStatusEntity,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';

/**
 * Common test providers to resolve widespread DI issues across test suites.
 * These providers mock essential services that are frequently injected as dependencies.
 */

// Mock for NotificationService using actual class reference
export const createNotificationServiceMock = (): Provider => ({
  provide: NotificationService,
  useValue: {
    sendToUser: jest.fn(),
    sendBalanceUpdate: jest.fn(),
    notifyUser: jest.fn(),
    notifyVipTierChange: jest.fn(),
    notifyBonusReceived: jest.fn(),
    sendSystemNotification: jest.fn(),
    emit: jest.fn(),
  },
});

// Alternative provider for direct class token (keeping for backward compatibility)
export const createNotificationServiceDirectMock = (): Provider => createNotificationServiceMock();

// Mock for AffiliateService
export const createAffiliateServiceMock = (): Provider => ({
  provide: AffiliateService,
  useValue: {
    createCampaign: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getCampaignStats: jest.fn(),
    trackAffiliateAction: jest.fn(),
    calculateCommission: jest.fn(),
    processReferral: jest.fn(),
    resolveCampaignRefToId: jest.fn().mockResolvedValue(null),
  },
});

// Mock for Redis-related services
export const createRedisServiceMock = (): Provider => ({
  provide: RedisService,
  useValue: {
    get: jest.fn(),
    set: jest.fn(),
    setNX: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn(),
    disconnect: jest.fn(),
    exists: jest.fn(),
  },
});

// Mock for LockMetricsService
export const createLockMetricsServiceMock = (): Provider => ({
  provide: LockMetricsService,
  useValue: {
    recordLockAcquisition: jest.fn(),
    recordLockRelease: jest.fn(),
    recordLockExtension: jest.fn(),
    recordLockFailure: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      totalAcquisitions: 0,
      totalReleases: 0,
      totalExtensions: 0,
      totalFailures: 0,
      averageHoldTime: 0,
    }),
    clearMetrics: jest.fn(),
  },
});

// Mock for DistributedLockService
export const createDistributedLockServiceMock = (): Provider => ({
  provide: DistributedLockService,
  useValue: {
    acquireLock: jest.fn().mockResolvedValue({
      resources: ['test-lock'],
      expiration: Date.now() + 10000,
    }),
    releaseLock: jest.fn().mockResolvedValue(undefined),
    extendLock: jest.fn().mockResolvedValue({
      resources: ['test-lock'],
      expiration: Date.now() + 10000,
    }),
    withLock: jest.fn().mockImplementation((_resource, _ttl, operation) => operation()),
    tryLock: jest.fn().mockResolvedValue({
      resources: ['test-lock'],
      expiration: Date.now() + 10000,
    }),
    isLocked: jest.fn().mockResolvedValue(false),
  },
});

// Mock for Queue services
export const createQueueServiceMock = (queueName: string): Provider => ({
  provide: `BullQueue_${queueName}`,
  useValue: {
    add: jest.fn(),
    process: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    removeJob: jest.fn(),
    getJobCounts: jest.fn(),
  },
});

// Mock for Balance Service using actual class reference
export const createBalanceServiceMock = (): Provider => ({
  provide: BalanceService,
  useValue: {
    updateBalance: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      balance: '1000.00000000',
    }),
    getBalance: jest.fn().mockResolvedValue('1000.00000000'),
    getBalances: jest.fn().mockResolvedValue([]),
    validateFinancialOperation: jest.fn().mockResolvedValue({ isValid: true }),
    checkLossLimits: jest.fn().mockResolvedValue({ limitReached: false }),
    processDeposit: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      balance: '1000.00000000',
    }),
    processWithdrawal: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      balance: '1000.00000000',
    }),
    createTip: jest.fn().mockResolvedValue({
      success: true,
      message: 'Tip created successfully',
    }),
    getBalanceHistory: jest.fn().mockResolvedValue([]),
    switchPrimaryWallet: jest.fn().mockResolvedValue({
      success: true,
      message: 'Wallet switched successfully',
    }),
    getBalanceStatistics: jest.fn().mockResolvedValue([]),
    updateFiatBalance: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      balance: '1000.00',
    }),
    getVaultInfo: jest.fn().mockResolvedValue({
      totalBalance: '1000.00000000',
      availableBalance: '1000.00000000',
      lockedBalance: '0.00000000',
    }),
    transferToVault: jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'test-tx-id',
    }),
    transferFromVault: jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'test-tx-id',
    }),
  },
});

// Mock for Auth-related services
export const createAuthConfigMock = (): Provider => ({
  provide: 'AUTH_CONFIG',
  useValue: {
    secret: 'test-jwt-secret-key',
    refreshSecret: 'test-refresh-secret-key',
    accessExpiration: '15m',
    refreshExpiration: '30d',
    telegramBotToken: 'test-telegram-bot-token',
    googleClientId: 'test-google-client-id',
    steamApiKey: 'test-steam-api-key',
  },
});

// Mock for SelfExclusionService
export const createSelfExclusionServiceMock = (): Provider => ({
  provide: SelfExclusionService,
  useValue: {
    getActiveSelfExclusions: jest.fn().mockResolvedValue([]),
    hasActiveSelfExclusion: jest.fn().mockResolvedValue(false),
    createSelfExclusion: jest.fn(),
    updateSelfExclusion: jest.fn(),
    formatRemainingTime: jest.fn(),
    checkExclusion: jest.fn(),
  },
});

// Mock for DataSource
export const createDataSourceMock = (): Provider => ({
  provide: DataSource,
  useValue: {
    query: jest.fn(),
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        transaction: jest.fn(),
        query: jest.fn().mockResolvedValue([[[], 0]]),
        getRepository: jest.fn(() => ({
          find: jest.fn().mockResolvedValue([]),
          findOne: jest.fn().mockResolvedValue(null),
          findOneBy: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          delete: jest.fn().mockResolvedValue({ affected: 1 }),
          create: jest.fn().mockImplementation((entityData) => entityData),
          count: jest.fn().mockResolvedValue(0),
          createQueryBuilder: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orWhere: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            having: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            setParameters: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
            getMany: jest.fn().mockResolvedValue([]),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            getRawOne: jest.fn().mockResolvedValue(null),
            getRawMany: jest.fn().mockResolvedValue([]),
            execute: jest.fn().mockResolvedValue([]),
          })),
        })),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          having: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockReturnThis(),
          setParameters: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
          getMany: jest.fn().mockResolvedValue([]),
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
          getRawOne: jest.fn().mockResolvedValue(null),
          getRawMany: jest.fn().mockResolvedValue([]),
          execute: jest.fn().mockResolvedValue([]),
        })),
      },
    })),
    getRepository: jest.fn(() => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((entityData) => entityData),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getRawOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
        execute: jest.fn().mockResolvedValue([]),
      })),
    })),
    manager: {
      transaction: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    },
  },
});

// Mock for UserBetService
export const createUserBetServiceMock = (): Provider => ({
  provide: UserBetService,
  useValue: {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getUserBets: jest.fn(),
    getBetStats: jest.fn(),
  },
});

// Mock for VipTierService
export const createVipTierServiceMock = (): Provider => ({
  provide: VipTierService,
  useValue: {
    findAllTiers: jest.fn(),
    findById: jest.fn(),
    getTierByLevel: jest.fn(),
    calculateTierProgress: jest.fn(),
  },
});

// Mock for UserVipStatusService
export const createUserVipStatusServiceMock = (): Provider => ({
  provide: UserVipStatusService,
  useValue: {
    getUserVipStatus: jest.fn(),
    updateVipStatus: jest.fn(),
    incrementUserWager: jest.fn(),
    upsertUserVipStatus: jest.fn(),
    logBonusTransaction: jest.fn(),
  },
});

// Mock for HouseEdgeService
export const createHouseEdgeServiceMock = (): Provider => ({
  provide: HouseEdgeService,
  useValue: {
    calculateHouseEdge: jest.fn(),
    getGameHouseEdge: jest.fn(),
    validateHouseEdge: jest.fn(),
  },
});

// Mock for GameConfigService
export const createGameConfigServiceMock = (): Provider => ({
  provide: GameConfigService,
  useValue: {
    getGameConfig: jest.fn(),
    updateGameConfig: jest.fn(),
    getGameLimits: jest.fn(),
    isGameActive: jest.fn().mockResolvedValue(true),
    isGameEnabled: jest.fn().mockResolvedValue(true),
    validateBetAmount: jest.fn().mockResolvedValue({ isValid: true, usdAmount: 1.0 }),
    validateGameParameters: jest.fn().mockResolvedValue(undefined),
    getBetLimits: jest.fn().mockResolvedValue({ minBet: '0.00000001', maxBet: '1000' }),
    getBetLimitsUsd: jest.fn().mockResolvedValue({ minBetUsd: 0.01, maxBetUsd: 1000 }),
    getAllBetLimits: jest.fn().mockResolvedValue([]),
    updateBetLimits: jest.fn().mockResolvedValue(undefined),
    refreshCache: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock for WebSocket services
export const createWebSocketServiceMock = (serviceClass: any): Provider => ({
  provide: serviceClass,
  useValue: {
    emitToUser: jest.fn(),
    emitToRoom: jest.fn(),
    emitToAll: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    handleConnection: jest.fn(),
    handleDisconnect: jest.fn(),
    sendGameUpdate: jest.fn(),
    broadcastGameState: jest.fn(),
  },
});

// Mock for EventEmitter2
export const createEventEmitterMock = (): Provider => ({
  provide: EventEmitter2,
  useValue: {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    setMaxListeners: jest.fn(),
  },
});

// Mock for additional services that commonly appear in DI issues
export const createProvablyFairServiceMock = (): Provider => ({
  provide: ProvablyFairService,
  useValue: {
    generateRandomValue: jest.fn().mockReturnValue(0.5),
    generateServerSeed: jest.fn().mockReturnValue('test-server-seed'),
    generateClientSeed: jest.fn().mockReturnValue('test-client-seed'),
    calculateOutcome: jest.fn().mockReturnValue(0.5),
    verifyOutcome: jest.fn().mockReturnValue(true),
    generateNonce: jest.fn().mockReturnValue('1'),
    generateGameOutcome: jest.fn().mockResolvedValue({
      serverSeed: 'test-server-seed',
      clientSeed: 'test-client-seed',
      nonce: '1',
      value: 0.5,
      hash: 'test-hash',
    }),
    updateClientSeed: jest.fn().mockResolvedValue(undefined),
    hashServerSeed: jest.fn().mockReturnValue('hashed-server-seed'),
    verifyGameOutcome: jest.fn().mockReturnValue(true),
  },
});

export const createBlackjackCardServiceMock = (): Provider => ({
  provide: BlackjackCardService,
  useValue: {
    shuffleDeck: jest.fn().mockReturnValue([]),
    dealCard: jest.fn().mockReturnValue({ suit: 'Hearts', rank: 'A', value: 11 }),
    generateCard: jest.fn().mockReturnValue({ suit: 'Hearts', rank: 'A', value: 11 }),
    generateCards: jest.fn().mockReturnValue([{ suit: 'Hearts', rank: 'A', value: 11 }]),
    calculateHandValue: jest.fn().mockReturnValue({ soft: 21, hard: 11 }),
    isBlackjack: jest.fn().mockReturnValue(false),
    isBust: jest.fn().mockReturnValue(false),
    verifyCard: jest.fn().mockReturnValue(true),
    isValidCard: jest.fn().mockReturnValue(true),
    hashServerSeed: jest.fn().mockReturnValue('hashed-seed'),
  },
});

export const createBlackjackGameLogicServiceMock = (): Provider => ({
  provide: BlackjackGameLogicService,
  useValue: {
    canSplit: jest.fn(),
    canDouble: jest.fn(),
    shouldDealerHit: jest.fn(),
    determineOutcome: jest.fn(),
    calculateScore: jest.fn().mockReturnValue({ soft: 21, hard: 11 }),
    getBestScore: jest.fn().mockReturnValue(21),
    isBlackjack: jest.fn().mockReturnValue(false),
    isDealerBust: jest.fn().mockReturnValue(false),
    isPlayerBust: jest.fn().mockReturnValue(false),
    getHandStatus: jest.fn().mockReturnValue('active'),
    getAvailableActions: jest.fn().mockReturnValue(['hit', 'stand']),
    checkIfGameCompleted: jest.fn().mockReturnValue(false),
    validateBets: jest.fn().mockReturnValue({ isValid: true }),
  },
});

export const createBlackjackPayoutServiceMock = (): Provider => ({
  provide: BlackjackPayoutService,
  useValue: {
    calculatePayout: jest.fn(),
    creditWinnings: jest.fn(),
    processInsurance: jest.fn(),
    calculateWinAmount: jest.fn().mockReturnValue({
      winAmount: '100.00000000',
      payoutMultiplier: '1.5000',
      isValid: true,
    }),
    getHouseEdgeAdjustedMultipliers: jest.fn().mockReturnValue({
      blackjackMultiplier: 2.5,
      winMultiplier: 2.0,
      pushMultiplier: 1.0,
      lossMultiplier: 0.0,
      houseEdge: 0.52,
    }),
    setGamePayout: jest.fn(),
    creditSideBetWinnings: jest.fn(),
    getTheoreticalRTP: jest.fn().mockReturnValue(99.48),
    calculateExpectedValue: jest.fn().mockReturnValue(0.995),
    validatePayoutAmount: jest.fn().mockReturnValue(true),
  },
});

export const createCryptoConverterServiceMock = (): Provider => ({
  provide: CryptoConverterService,
  useValue: {
    convertToUsd: jest.fn().mockResolvedValue('1000.00'),
    convertFromUsd: jest.fn().mockResolvedValue('0.00002000'),
    getExchangeRate: jest.fn().mockResolvedValue(50000),
    toSatoshi: jest.fn().mockReturnValue('100000000'),
    fromSatoshi: jest.fn().mockReturnValue('1.00000000'),
    getRate: jest.fn().mockResolvedValue(50000),
    toUsd: jest.fn().mockResolvedValue('1000.00'),
    fromUsd: jest.fn().mockResolvedValue('0.00002000'),
    convertBetweenAssets: jest.fn().mockResolvedValue('1.00000000'),
    initializeOnStartup: jest.fn().mockResolvedValue(undefined),
  },
});

export const createDailyGamblingStatsServiceMock = (): Provider => ({
  provide: DailyGamblingStatsService,
  useValue: {
    updateStats: jest.fn(),
    getStats: jest.fn(),
    getTotalLossAmount: jest.fn().mockResolvedValue('0'),
    checkLimits: jest.fn(),
  },
});

// Mock for CurrencyRateService
export const createCurrencyRateServiceMock = (): Provider => ({
  provide: CurrencyRateService,
  useValue: {
    getAllLatestRates: jest.fn().mockResolvedValue([]),
    getLatestRateForAsset: jest.fn().mockResolvedValue(50000),
    hasRatesForAllActiveCurrencies: jest.fn().mockResolvedValue(true),
    areRatesOlderThan: jest.fn().mockResolvedValue(false),
    initializeRatesFromExternalSources: jest.fn().mockResolvedValue(undefined),
    updateRateForAsset: jest.fn().mockResolvedValue(undefined),
    refreshAllRates: jest.fn().mockResolvedValue(undefined),
  },
});

export const createUsersServiceMock = (): Provider => ({
  provide: UsersService,
  useValue: {
    // User creation methods
    createWithEmail: jest.fn(),
    createWithGoogle: jest.fn(),
    createWithSteam: jest.fn(),
    createWithMetamask: jest.fn(),
    createWithPhantom: jest.fn(),
    createWithTelegram: jest.fn(),

    // User lookup methods
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    findByEmailOrUsername: jest.fn(),

    // User update methods
    update: jest.fn(),
    updateRegistrationData: jest.fn(),
    updateUserProfile: jest.fn(),

    // User management methods
    delete: jest.fn(),
    create: jest.fn(),

    // Profile and stats methods
    getUserProfile: jest.fn(),
    getPublicUserProfile: jest.fn(),
    getUserStats: jest.fn(),
    getUnifiedUserProfile: jest.fn(),

    // Search and listing methods
    searchUsers: jest.fn(),
    getAllUsers: jest.fn(),

    // Cache management
    invalidateUserCache: jest.fn(),
    clearUserCache: jest.fn(),

    // Other utility methods that might be used in tests
    validateUser: jest.fn(),
    isUsernameAvailable: jest.fn(),
    isEmailAvailable: jest.fn(),
    generateUniqueUsername: jest.fn().mockResolvedValue('uniqueuser123'),
  },
});

// Generic Repository Mock Factory
export const createRepositoryMock = <T = any>(entity?: new () => T): Provider => ({
  provide: entity ? getRepositoryToken(entity) : 'MOCK_REPOSITORY',
  useValue: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
    preload: jest.fn(),
    count: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawOne: jest.fn().mockResolvedValue(null),
      getRawMany: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue([]),
    })),
  },
});

// Repository mock value with all common methods
const createRepositoryMockValue = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findOneBy: jest.fn().mockResolvedValue(null),
  findBy: jest.fn().mockResolvedValue([]),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  remove: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  create: jest.fn().mockImplementation((entityData) => entityData),
  preload: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  increment: jest.fn().mockResolvedValue({ affected: 1 }),
  decrement: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue([]),
  })),
});

// Repository Mocks using proper TypeORM getRepositoryToken
export const createCommonRepositoryMocks = (): Provider[] => {
  const entities = [
    UserEntity,
    BalanceWalletEntity,
    BalanceHistoryEntity,
    BlackjackGameEntity,
    CrashGameEntity,
    CrashBetEntity,
    DiceBetEntity,
    PlinkoGameEntity,
    MinesGameEntity,
    KenoGameEntity,
    LimboGameEntity,
    GameConfigEntity,
    BonusVipTierEntity,
    UserVipStatusEntity,
    BonusTransactionEntity,
    UserBetEntity,
    GameResultEntity,
    GameSessionEntity,
    WeeklyRacePrizeEntity,
    SeedPairEntity,
  ];

  return entities.map((entity) => ({
    provide: getRepositoryToken(entity),
    useValue: createRepositoryMockValue(),
  }));
};

// Common providers bundle
export const getCommonTestProviders = (): Provider[] => [
  createNotificationServiceMock(),
  createAffiliateServiceMock(),
  createRedisServiceMock(),
  createLockMetricsServiceMock(),
  createDistributedLockServiceMock(),
  createBalanceServiceMock(),
  createAuthConfigMock(),
  createSelfExclusionServiceMock(),
  createDataSourceMock(),
  createUserBetServiceMock(),
  createVipTierServiceMock(),
  createUserVipStatusServiceMock(),
  createHouseEdgeServiceMock(),
  createGameConfigServiceMock(),
  createEventEmitterMock(),
  createProvablyFairServiceMock(),
  createBlackjackCardServiceMock(),
  createBlackjackGameLogicServiceMock(),
  createBlackjackPayoutServiceMock(),
  createCryptoConverterServiceMock(),
  createCurrencyRateServiceMock(),
  createDailyGamblingStatsServiceMock(),
  createUsersServiceMock(),
  createWebSocketServiceMock(CrashWebSocketService),
  createQueueServiceMock('bonus'),
  createQueueServiceMock('notification'),
  createQueueServiceMock('payment'),
  ...createCommonRepositoryMocks(),
];

// Provider factory for specific services
export interface TestProviderOptions {
  includeNotificationService?: boolean;
  includeAffiliateService?: boolean;
  includeRedisService?: boolean;
  includeBalanceService?: boolean;
  includeAuthConfig?: boolean;
  includeSelfExclusionService?: boolean;
  includeQueues?: string[];
  customProviders?: Provider[];
}

export const createTestProviders = (options: TestProviderOptions = {}): Provider[] => {
  const {
    includeNotificationService = true,
    includeAffiliateService = true,
    includeRedisService = true,
    includeBalanceService = true,
    includeAuthConfig = true,
    includeSelfExclusionService = true,
    includeQueues = ['bonus', 'notification'],
    customProviders = [],
  } = options;

  const providers: Provider[] = [];

  if (includeNotificationService) providers.push(createNotificationServiceMock());
  if (includeAffiliateService) providers.push(createAffiliateServiceMock());
  if (includeRedisService) providers.push(createRedisServiceMock());
  if (includeBalanceService) providers.push(createBalanceServiceMock());
  if (includeAuthConfig) providers.push(createAuthConfigMock());
  if (includeSelfExclusionService) providers.push(createSelfExclusionServiceMock());

  // Always include essential services that are commonly required
  providers.push(
    createDataSourceMock(),
    createLockMetricsServiceMock(),
    createDistributedLockServiceMock(),
    createUserBetServiceMock(),
    createVipTierServiceMock(),
    createUserVipStatusServiceMock(),
    createHouseEdgeServiceMock(),
    createGameConfigServiceMock(),
    createEventEmitterMock(),
    createProvablyFairServiceMock(),
    createBlackjackCardServiceMock(),
    createBlackjackGameLogicServiceMock(),
    createBlackjackPayoutServiceMock(),
    createCryptoConverterServiceMock(),
    createCurrencyRateServiceMock(),
    createDailyGamblingStatsServiceMock(),
    createUsersServiceMock(),
    createWebSocketServiceMock(CrashWebSocketService),
  );

  includeQueues.forEach((queueName) => {
    providers.push(createQueueServiceMock(queueName));
  });

  // Always include common repository mocks
  providers.push(...createCommonRepositoryMocks());

  providers.push(...customProviders);

  return providers;
};
