import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordUtil } from '@zetik/common';
import {
  AuthStrategyEnum,
  IEmailRegistrationData,
  IGoogleRegistrationData,
  IMetamaskRegistrationData,
  IPhantomRegistrationData,
  ISteamRegistrationData,
  ModerationActionTypeEnum,
  UserAvatarEntity,
  UserEntity,
  UserIgnoredUserEntity,
  UserModerationHistoryEntity,
} from '@zetik/shared-entities';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { EmailVerificationService } from '../auth/services/email-verification.service';
import { BalanceService } from '../balance/balance.service';
import { UserVipStatusService } from '../bonus/services/user-vip-status.service';
import { VipTierService } from '../bonus/services/vip-tier.service';
import { RedisService } from '../common/services/redis.service';
import { UserCacheService } from '../common/services/user-cache.service';
import { UploadService } from '../upload/upload.service';
import { DefaultAvatarService } from './default-avatar.service';
import {
  ActivateAvatarResponseDto,
  AvatarGalleryResponseDto,
  AvatarUploadGalleryResponseDto,
  DeleteAvatarResponseDto,
  UserAvatarDto,
} from './dto/avatar-upload.dto';
import {
  ActivateDefaultAvatarDto,
  ActivateDefaultAvatarResponseDto,
} from './dto/default-avatar.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { SearchUsersResponseDto } from './dto/search-users-response.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserStatsDto } from './dto/user-stats.dto';
import { IUnifiedUserProfile } from './interfaces/unified-user-profile.interface';
import { SelfExclusionService } from './self-exclusion.service';
import { UserPrivacyEventPublisher } from './services/user-privacy-event.publisher';
import { UserRoleService } from './services/user-role.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly UNIFIED_PROFILE_CACHE_KEY_PREFIX = 'unified-profile:';
  private readonly UNIFIED_PROFILE_TTL_SECONDS = 1 * 60; // 1 minute

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserIgnoredUserEntity)
    private readonly userIgnoredUserRepository: Repository<UserIgnoredUserEntity>,
    @InjectRepository(UserAvatarEntity)
    private readonly userAvatarRepository: Repository<UserAvatarEntity>,
    @InjectRepository(UserModerationHistoryEntity)
    private readonly moderationHistoryRepository: Repository<UserModerationHistoryEntity>,
    private readonly defaultAvatarService: DefaultAvatarService,
    private readonly userVipStatusService: UserVipStatusService,
    @Inject(forwardRef(() => BalanceService))
    private readonly balanceService: BalanceService,
    private readonly vipTierService: VipTierService,
    private readonly selfExclusionService: SelfExclusionService,
    private readonly redisService: RedisService,
    private readonly uploadService: UploadService,
    private readonly userCacheService: UserCacheService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => EmailVerificationService))
    private readonly emailVerificationService: EmailVerificationService,
    private readonly userRoleService: UserRoleService,
    private readonly userPrivacyEventPublisher: UserPrivacyEventPublisher,
  ) {}

  /**
   * Handle PostgreSQL unique constraint violations with proper typing
   * Provides graceful error messages for database-level race conditions
   */
  private handleUniqueConstraintError(
    error: unknown,
    defaultMessage = 'User already exists',
  ): never {
    if (error instanceof QueryFailedError) {
      const pgError = error.driverError;

      // PostgreSQL unique violation error code
      if (pgError?.code === '23505') {
        const constraint = pgError.constraint || '';

        if (constraint.includes('email')) {
          throw new ConflictException('Email already exists');
        }
        if (constraint.includes('username')) {
          throw new ConflictException('Username already exists');
        }

        // Generic fallback for other constraints (e.g., UUID collision, address, etc.)
        this.logger.warn(`Unique constraint violation: ${constraint}`, {
          constraint,
          code: pgError.code,
        });
        throw new ConflictException(defaultMessage);
      }
    }

    throw error;
  }

  private async validateAndGetCampaignId(
    code: string | undefined,
    manager: EntityManager,
  ): Promise<string | undefined> {
    if (!code) {
      return undefined;
    }

    const { AffiliateCampaignEntity } = await import('@zetik/shared-entities');
    const campaign = await manager.findOne(AffiliateCampaignEntity, {
      where: { code },
      select: ['id'],
    });

    if (!campaign) {
      throw new BadRequestException('Invalid referral code');
    }

    return campaign.id;
  }

  /**
   * Execute user creation with transaction retry logic
   * Uses SERIALIZABLE isolation to prevent race conditions
   * Retries on serialization failures (common under high concurrency)
   */
  private async executeWithRetry<T>(
    operation: (manager: EntityManager) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.dataSource.transaction('SERIALIZABLE', operation);
      } catch (error) {
        // PostgreSQL serialization failure error code
        if (error instanceof QueryFailedError) {
          const pgError = error.driverError;
          if (pgError?.code === '40001' && attempt < maxRetries - 1) {
            this.logger.debug(
              `Serialization failure, retrying (attempt ${attempt + 1}/${maxRetries})`,
            );
            // Small backoff before retry
            await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  async createWithEmail(
    email: string,
    username: string,
    password: string,
    referralCode?: string,
  ): Promise<UserEntity> {
    const lowercaseUsername = username.toLowerCase();
    const passwordHash = await PasswordUtil.hash(password);

    return this.executeWithRetry(async (manager) => {
      const existingByUsername = await manager.findOne(UserEntity, {
        where: { username: lowercaseUsername },
      });
      if (existingByUsername) {
        throw new ConflictException('Username already exists');
      }

      const existingByEmail = await manager.findOne(UserEntity, {
        where: { email },
      });
      if (existingByEmail) {
        throw new ConflictException('Email already exists');
      }

      const affiliateCampaignId = await this.validateAndGetCampaignId(referralCode, manager);

      const user = manager.create(UserEntity, {
        id: randomUUID(),
        username: lowercaseUsername,
        email,
        isEmailVerified: false,
        registrationStrategy: AuthStrategyEnum.EMAIL,
        affiliateCampaignId,
        referralCode,
        registrationData: {
          passwordHash,
        } as IEmailRegistrationData,
      });

      try {
        return await manager.save(user);
      } catch (error) {
        this.handleUniqueConstraintError(error);
      }
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      return this.usersRepository.findOne({ where: { email } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Error finding user by email: ${email}`, errorMessage);
      return null;
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<UserEntity | null> {
    try {
      const qb = this.usersRepository.createQueryBuilder('user');
      return await qb
        .where('user.email = :emailOrUsername', { emailOrUsername })
        .orWhere('LOWER(user.username) = LOWER(:emailOrUsername)', { emailOrUsername })
        .getOne();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Error finding user by email or username: ${emailOrUsername}`,
        errorMessage,
      );
      return null;
    }
  }

  async findByMetamaskAddress(address: string): Promise<UserEntity | null> {
    try {
      const qb = this.usersRepository.createQueryBuilder('user');
      return await qb
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.METAMASK })
        .andWhere(`"registrationData"->>'address' = :address`, { address })
        .getOne();
    } catch (error) {
      const errMsg = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Error finding user by Metamask address: ${address}`, errMsg);
      return null;
    }
  }

  async createWithMetamask(address: string, referralCode?: string): Promise<UserEntity> {
    return this.executeWithRetry(async (manager) => {
      const existingByAddress = await manager
        .createQueryBuilder(UserEntity, 'user')
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.METAMASK })
        .andWhere(`"registrationData"->>'address' = :address`, { address })
        .getOne();

      if (existingByAddress) {
        throw new ConflictException('Address already exists');
      }

      const affiliateCampaignId = await this.validateAndGetCampaignId(referralCode, manager);

      const userId = randomUUID();
      const user = manager.create(UserEntity, {
        id: userId,
        username: userId,
        registrationStrategy: AuthStrategyEnum.METAMASK,
        affiliateCampaignId,
        referralCode,
        registrationData: { address } as IMetamaskRegistrationData,
      });

      try {
        return await manager.save(user);
      } catch (error) {
        this.handleUniqueConstraintError(error, 'Address already exists');
      }
    });
  }

  async findByPhantomAddress(address: string): Promise<UserEntity | null> {
    try {
      const qb = this.usersRepository.createQueryBuilder('user');
      return await qb
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.PHANTOM })
        .andWhere(`"registrationData"->>'address' = :address`, { address })
        .getOne();
    } catch (error) {
      const errMsg = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Error finding user by Phantom address: ${address}`, errMsg);
      return null;
    }
  }

  async createWithPhantom(address: string, referralCode?: string): Promise<UserEntity> {
    return this.executeWithRetry(async (manager) => {
      const existingByAddress = await manager
        .createQueryBuilder(UserEntity, 'user')
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.PHANTOM })
        .andWhere(`"registrationData"->>'address' = :address`, { address })
        .getOne();

      if (existingByAddress) {
        throw new ConflictException('Address already exists');
      }

      const affiliateCampaignId = await this.validateAndGetCampaignId(referralCode, manager);

      const userId = randomUUID();
      const user = manager.create(UserEntity, {
        id: userId,
        username: userId,
        registrationStrategy: AuthStrategyEnum.PHANTOM,
        affiliateCampaignId,
        referralCode,
        registrationData: { address } as IPhantomRegistrationData,
      });

      try {
        return await manager.save(user);
      } catch (error) {
        this.handleUniqueConstraintError(error, 'Address already exists');
      }
    });
  }

  async getUserProfile(user: UserEntity): Promise<UserProfileDto> {
    // Use unified profile with private data
    const unifiedProfile = await this.buildUnifiedUserProfile(user, true);
    const profile = this.convertToUserProfileDto(unifiedProfile);

    // Get user role
    const role = await this.userRoleService.getUserRole(user.id);
    if (role) {
      profile.role = role;
    }

    return profile;
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await this.userCacheService.invalidateAllUserCaches(userId);
  }

  private async getUnifiedProfileFromCache(userId: string): Promise<IUnifiedUserProfile | null> {
    const cacheKey = `${this.UNIFIED_PROFILE_CACHE_KEY_PREFIX}${userId}`;
    const cachedString = await this.redisService.get(cacheKey);

    if (!cachedString) {
      return null;
    }

    try {
      return JSON.parse(cachedString);
    } catch (error) {
      this.logger.warn(`Failed to parse cached unified profile for user ${userId}:`, error);
      return null;
    }
  }

  private async setUnifiedProfileCache(
    userId: string,
    profile: IUnifiedUserProfile,
  ): Promise<void> {
    const cacheKey = `${this.UNIFIED_PROFILE_CACHE_KEY_PREFIX}${userId}`;
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(profile),
        this.UNIFIED_PROFILE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Failed to cache unified profile for user ${userId}:`, error);
    }
  }

  private async buildUnifiedUserProfile(
    user: UserEntity,
    includePrivateData: boolean = false,
  ): Promise<IUnifiedUserProfile> {
    // Get full VIP status for the user (including currentWager)
    const userVipStatus = await this.userVipStatusService.getUserVipStatus(user.id);
    const vipLevel = userVipStatus?.currentVipLevel || 0;
    const currentWager = parseFloat(userVipStatus?.currentWager || '0');

    // Get current and next VIP tier information
    const [vipTier, nextVipTier] = await Promise.all([
      this.vipTierService.findTierByLevel(vipLevel),
      this.vipTierService.findNextTier(vipLevel),
    ]);

    // Calculate VIP level progress percentage (0-99)
    let vipPercent = 0;
    if (vipTier && nextVipTier) {
      const currentLevelWager = parseFloat(vipTier.wagerRequirement);
      const nextLevelWager = parseFloat(nextVipTier.wagerRequirement);
      const progressWager = currentWager - currentLevelWager;
      const requiredWager = nextLevelWager - currentLevelWager;

      if (requiredWager > 0) {
        vipPercent = Math.min(99, Math.max(0, Math.floor((progressWager / requiredWager) * 100)));
      }
    }

    // Get balance statistics for the user
    const balanceStats = await this.balanceService.getBalanceStatisticsForUsers([user.id]);
    const userBalanceStats = balanceStats.find((stat) => stat.userId === user.id);

    // Calculate statistics
    const numberOfBets = userBalanceStats?.betCount || 0;
    const numberOfWins = userBalanceStats?.winCount || 0;
    const numberOfLosses = numberOfBets - numberOfWins;
    const totalWageredCents = parseFloat(userBalanceStats?.bets || '0');

    const profile: IUnifiedUserProfile = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      isPrivate: user.isPrivate,
      hideStatistics: user.hideStatistics,
      hideRaceStatistics: user.hideRaceStatistics,
      vipInfo: {
        level: vipLevel,
        name: vipTier?.name || 'Visitor',
        imageUrl: vipTier?.imageUrl || '',
        percent: vipPercent,
      },
      statistics: {
        totalBets: numberOfBets,
        numberOfWins: numberOfWins,
        numberOfLosses: numberOfLosses < 0 ? 0 : numberOfLosses,
        wageredCents: totalWageredCents,
      },
    };

    profile.cookieConsentAcceptedAt = user.cookieConsentAcceptedAt;

    // Add private data if requested
    if (includePrivateData) {
      // Get active self-exclusions for the user
      const activeSelfExclusions = await this.selfExclusionService.getActiveSelfExclusions(user.id);

      profile.email = user.email;
      profile.isEmailVerified = user.isEmailVerified;
      profile.phoneNumber = user.phoneNumber;
      profile.isPhoneVerified = user.isPhoneVerified;
      profile.registrationStrategy = user.registrationStrategy;
      profile.currentFiatFormat = user.currentFiatFormat;
      profile.currentCurrency = user.currentCurrency;
      profile.activeSelfExclusions = activeSelfExclusions;
      profile.referralCode = user.referralCode;

      // Add user settings
      profile.emailMarketing = user.emailMarketing;
      profile.streamerMode = user.streamerMode;
      profile.excludeFromRain = user.excludeFromRain;
    }

    return profile;
  }

  private async getUnifiedUserProfile(
    userId: string,
    includePrivateData: boolean = false,
  ): Promise<IUnifiedUserProfile> {
    // Try cache first (only use cache for public profiles to avoid privacy issues)
    if (!includePrivateData) {
      const cachedProfile = await this.getUnifiedProfileFromCache(userId);
      if (cachedProfile) {
        return cachedProfile;
      }
    }

    // Find user by ID
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Build unified profile
    const profile = await this.buildUnifiedUserProfile(user, includePrivateData);

    // Cache profile asynchronously (only cache public version)
    if (!includePrivateData) {
      this.setUnifiedProfileCache(userId, profile).catch((error) => {
        this.logger.warn(`Failed to cache unified profile for user ${userId}:`, error);
      });
    }

    return profile;
  }

  private convertToUserProfileDto(unifiedProfile: IUnifiedUserProfile): UserProfileDto {
    return {
      id: unifiedProfile.id,
      username: unifiedProfile.username,
      email: unifiedProfile.email,
      isEmailVerified: unifiedProfile.isEmailVerified || false,
      phoneNumber: unifiedProfile.phoneNumber,
      isPhoneVerified: unifiedProfile.isPhoneVerified || false,
      displayName: unifiedProfile.displayName,
      bio: unifiedProfile.bio,
      avatarUrl: unifiedProfile.avatarUrl,
      referralCode: unifiedProfile.referralCode,
      createdAt: unifiedProfile.createdAt,
      registrationStrategy: unifiedProfile.registrationStrategy!,
      currentFiatFormat: unifiedProfile.currentFiatFormat!,
      currentCurrency: unifiedProfile.currentCurrency!,
      vipLevel: unifiedProfile.vipInfo.level,
      vipLevelImage: unifiedProfile.vipInfo.imageUrl,
      isPrivate: unifiedProfile.isPrivate,
      emailMarketing: unifiedProfile.emailMarketing || true,
      streamerMode: unifiedProfile.streamerMode || false,
      excludeFromRain: unifiedProfile.excludeFromRain || false,
      hideStatistics: unifiedProfile.hideStatistics || false,
      hideRaceStatistics: unifiedProfile.hideRaceStatistics || false,
      activeSelfExclusions: unifiedProfile.activeSelfExclusions,
      cookieConsentAcceptedAt: unifiedProfile.cookieConsentAcceptedAt,
    };
  }

  private convertToPublicUserProfileDto(unifiedProfile: IUnifiedUserProfile): PublicUserProfileDto {
    const baseProfile = {
      userName: unifiedProfile.displayName || unifiedProfile.username,
      userId: unifiedProfile.id,
      createdAt: unifiedProfile.createdAt,
      avatarUrl: unifiedProfile.avatarUrl,
      vipLevel: {
        level: unifiedProfile.vipInfo.level,
        name: unifiedProfile.vipInfo.name,
        imageUrl: unifiedProfile.vipInfo.imageUrl,
        percent: unifiedProfile.vipInfo.percent,
      },
      hideStatistics: unifiedProfile.hideStatistics,
      hideRaceStatistics: unifiedProfile.hideRaceStatistics || false,
      cookieConsentAcceptedAt: unifiedProfile.cookieConsentAcceptedAt,
    };

    if (unifiedProfile.hideStatistics) {
      return baseProfile as unknown as PublicUserProfileDto;
    }

    return {
      ...baseProfile,
      statistics: {
        totalBets: unifiedProfile.statistics.totalBets,
        numberOfWins: unifiedProfile.statistics.numberOfWins,
        numberOfLosses: unifiedProfile.statistics.numberOfLosses,
        wagered: (unifiedProfile.statistics.wageredCents / 100).toFixed(2),
      },
    };
  }

  async updateUserProfile(
    userId: string,
    updateDto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Handle email updates with conditional 2FA logic
    if (updateDto.email !== undefined) {
      const newEmail = updateDto.email.trim();

      // If user already has an email, they must use the separate /profile/email endpoint (with 2FA)
      if (user.email) {
        throw new ForbiddenException(
          'To change your existing email, update it in your profile settings.',
        );
      }

      // First-time email add: no 2FA required (catch-22 fix)
      // Check if email already exists
      if (newEmail) {
        const existingByEmail = await this.usersRepository.findOne({
          where: { email: newEmail },
        });
        if (existingByEmail) {
          throw new ConflictException('Email already exists');
        }

        // Add email to user account
        user.email = newEmail;
        user.isEmailVerified = false;

        this.logger.log(
          `User ${userId} added email for the first time (no 2FA required): ${newEmail}`,
        );
      }
    }

    // Handle other profile updates
    if (updateDto.username !== undefined) {
      const lowercaseUsername = updateDto.username.toLowerCase();
      if (lowercaseUsername !== user.username) {
        const existingByUsername = await this.usersRepository.findOne({
          where: { username: lowercaseUsername },
        });
        if (existingByUsername) {
          throw new ConflictException('Username already exists');
        }
        user.username = lowercaseUsername;
      }
    }
    if (updateDto.displayName !== undefined) {
      user.displayName = updateDto.displayName;
    }
    if (updateDto.bio !== undefined) {
      user.bio = updateDto.bio;
    }
    if (updateDto.avatarUrl !== undefined) {
      user.avatarUrl = updateDto.avatarUrl;
    }
    if (updateDto.currentFiatFormat !== undefined) {
      user.currentFiatFormat = updateDto.currentFiatFormat;
    }
    if (updateDto.currentCurrency !== undefined) {
      user.currentCurrency = updateDto.currentCurrency;
    }
    if (updateDto.isPrivate !== undefined) {
      const wasPrivate = user.isPrivate;
      user.isPrivate = updateDto.isPrivate;

      // Invalidate all user caches in backend (unified-profile + jwt-user)
      if (wasPrivate !== user.isPrivate) {
        await this.invalidateUserCache(user.id);

        // Publish event for cache invalidation in other services (bet-feed-service)
        await this.userPrivacyEventPublisher.publishPrivacyChanged(user.id, user.isPrivate);
      }
    }
    if (updateDto.emailMarketing !== undefined) {
      user.emailMarketing = updateDto.emailMarketing;
    }
    if (updateDto.streamerMode !== undefined) {
      user.streamerMode = updateDto.streamerMode;
    }
    if (updateDto.excludeFromRain !== undefined) {
      user.excludeFromRain = updateDto.excludeFromRain;
    }
    if (updateDto.hideStatistics !== undefined) {
      user.hideStatistics = updateDto.hideStatistics;
    }
    if (updateDto.hideRaceStatistics !== undefined) {
      user.hideRaceStatistics = updateDto.hideRaceStatistics;
    }

    // If avatarUrl is being cleared, also clear defaultAvatarId
    if (updateDto.avatarUrl !== undefined && !updateDto.avatarUrl) {
      user.defaultAvatarId = null as any;
    }

    const updatedUser = await this.usersRepository.save(user);

    // Send verification email if email was added
    if (updateDto.email !== undefined && updatedUser.email) {
      try {
        await this.emailVerificationService.createAndSend(updatedUser);
        this.logger.log(`Verification email sent to ${updatedUser.email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${updatedUser.email}:`,
          error instanceof Error ? error.message : String(error),
        );
        // Don't fail the entire request if email sending fails
        // User can request a new verification email later
      }
    }

    // Invalidate user cache to ensure fresh data on next authentication
    await this.invalidateUserCache(userId);

    return this.getUserProfile(updatedUser);
  }

  async updateUserEmail(userId: string, newEmail: string): Promise<UserProfileDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (newEmail === user.email) {
      return this.getUserProfile(user);
    }

    const existingByEmail = await this.usersRepository.findOne({
      where: { email: newEmail },
    });
    if (existingByEmail) {
      throw new ConflictException('Email already exists');
    }

    user.email = newEmail;
    user.isEmailVerified = false;

    const updatedUser = await this.usersRepository.save(user);
    await this.invalidateUserCache(userId);

    return this.getUserProfile(updatedUser);
  }

  async searchUsers(searchDto: SearchUsersDto): Promise<SearchUsersResponseDto[]> {
    const { username, limit = 10, offset = 0 } = searchDto;

    if (!username || username.trim() === '') {
      return [];
    }

    const searchTerm = username.trim().toLowerCase();

    // Create query builder with improved search logic
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.isBanned = false') // Exclude banned users from search
      .andWhere('user.isPrivate = false') // Exclude private profiles from search results
      .andWhere(
        // Search in username and displayName with different matching strategies
        '(' +
          'LOWER(user.username) LIKE :exact ' + // Exact prefix match (highest priority)
          'OR LOWER(user.username) LIKE :partial ' + // Partial match in username
          'OR LOWER(user.displayName) LIKE :partial ' + // Partial match in display name
          'OR user.username ILIKE :fuzzy ' + // Case-insensitive fuzzy match
          ')',
        {
          exact: `${searchTerm}%`, // Exact prefix match
          partial: `%${searchTerm}%`, // Partial match
          fuzzy: `%${searchTerm.split('').join('%')}%`, // Fuzzy match (characters can be separated)
        },
      )
      // Order by relevance: exact matches first, then partial matches
      .orderBy(
        `CASE 
          WHEN LOWER(user.username) = :exactMatch THEN 1
          WHEN LOWER(user.username) LIKE :exactPrefix THEN 2
          WHEN LOWER(user.displayName) LIKE :exactPrefix THEN 3
          WHEN LOWER(user.username) LIKE :partialMatch THEN 4
          WHEN LOWER(user.displayName) LIKE :partialMatch THEN 5
          ELSE 6
        END`,
      )
      .addOrderBy('user.createdAt', 'DESC') // Secondary sort by registration date
      .setParameters({
        exactMatch: searchTerm,
        exactPrefix: `${searchTerm}%`,
        partialMatch: `%${searchTerm}%`,
      })
      .limit(limit)
      .offset(offset)
      .select(['user.id']);

    const users = await queryBuilder.getMany();
    const userIds = users.map((user) => user.id);

    if (userIds.length === 0) {
      return [];
    }

    // Get simplified search results without statistics
    return this.getSearchUsersProfiles(userIds);
  }

  async getUserStats(userId: string): Promise<UserStatsDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Implement actual statistics calculation
    return {
      totalWagered: '0',
      totalWon: '0',
      totalLost: '0',
      gamesPlayed: 0,
      favoriteGame: 'None',
    };
  }

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    try {
      const qb = this.usersRepository.createQueryBuilder('user');
      return await qb
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.GOOGLE })
        .andWhere(`"registrationData"->>'id' = :googleId`, { googleId })
        .getOne();
    } catch (error) {
      const errMsg = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Error finding user by Google ID: ${googleId}`, errMsg);
      return null;
    }
  }

  async createWithGoogle(
    googleData: IGoogleRegistrationData,
    referralCode?: string,
  ): Promise<UserEntity> {
    return this.executeWithRetry(async (manager) => {
      const existingByGoogleId = await manager
        .createQueryBuilder(UserEntity, 'user')
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.GOOGLE })
        .andWhere(`"registrationData"->>'id' = :googleId`, { googleId: googleData.id })
        .getOne();
      if (existingByGoogleId) {
        throw new ConflictException('Google user already exists');
      }

      const affiliateCampaignId = await this.validateAndGetCampaignId(referralCode, manager);

      const userId = randomUUID();
      const user = manager.create(UserEntity, {
        id: userId,
        username: userId,
        displayName: googleData.name,
        avatarUrl: googleData.picture,
        registrationStrategy: AuthStrategyEnum.GOOGLE,
        affiliateCampaignId,
        referralCode,
        registrationData: googleData,
      });

      try {
        return await manager.save(user);
      } catch (error) {
        this.handleUniqueConstraintError(error, 'Google user already exists');
      }
    });
  }

  async updateRegistrationData(
    userId: string,
    registrationData:
      | IEmailRegistrationData
      | IMetamaskRegistrationData
      | IPhantomRegistrationData
      | IGoogleRegistrationData
      | ISteamRegistrationData,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.registrationData = registrationData;
    await this.usersRepository.save(user);

    // Invalidate user cache to ensure fresh data on next authentication
    await this.invalidateUserCache(userId);
  }

  async generateUniqueUsername(baseUsername: string): Promise<string> {
    // Clean username from invalid characters and convert to lowercase
    let cleanUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    // Truncate to maximum length
    if (cleanUsername.length > 20) {
      cleanUsername = cleanUsername.substring(0, 20);
    }

    // If empty or too short, use default
    if (cleanUsername.length < 3) {
      cleanUsername = 'user';
    }

    let username = cleanUsername;
    let counter = 1;

    // Check uniqueness and add suffix if necessary
    while (await this.usersRepository.findOne({ where: { username } })) {
      username = `${cleanUsername}_${counter}`;
      counter++;

      // Protection against too long username
      if (username.length > 32) {
        const suffix = `_${counter}`;
        const maxBaseLength = 32 - suffix.length;
        username = cleanUsername.substring(0, maxBaseLength) + suffix;
      }
    }

    return username;
  }

  async findBySteamId(steamId: string): Promise<UserEntity | null> {
    try {
      const qb = this.usersRepository.createQueryBuilder('user');
      return await qb
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.STEAM })
        .andWhere(`"registrationData"->>'steamId' = :steamId`, { steamId })
        .getOne();
    } catch (error) {
      const errMsg = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Error finding user by Steam ID: ${steamId}`, errMsg);
      return null;
    }
  }

  async createWithSteam(
    steamData: ISteamRegistrationData,
    referralCode?: string,
  ): Promise<UserEntity> {
    return this.executeWithRetry(async (manager) => {
      const existingBySteamId = await manager
        .createQueryBuilder(UserEntity, 'user')
        .where('"registrationStrategy" = :strategy', { strategy: AuthStrategyEnum.STEAM })
        .andWhere(`"registrationData"->>'steamId' = :steamId`, { steamId: steamData.steamId })
        .getOne();
      if (existingBySteamId) {
        throw new ConflictException('Steam user already exists');
      }

      const affiliateCampaignId = await this.validateAndGetCampaignId(referralCode, manager);

      const userId = randomUUID();
      const user = manager.create(UserEntity, {
        id: userId,
        username: userId,
        displayName: steamData.personaName,
        avatarUrl: steamData.avatarUrl,
        registrationStrategy: AuthStrategyEnum.STEAM,
        affiliateCampaignId,
        referralCode,
        registrationData: steamData,
      });

      try {
        return await manager.save(user);
      } catch (error) {
        this.handleUniqueConstraintError(error, 'Steam user already exists');
      }
    });
  }

  async getPublicUserProfile(
    userId: string,
    currentUserId?: string,
  ): Promise<PublicUserProfileDto> {
    // Get unified profile without private data (will use cache automatically)
    const unifiedProfile = await this.getUnifiedUserProfile(userId, false);

    // Check if user profile is private, but allow if viewing own profile
    if (unifiedProfile.isPrivate && userId !== currentUserId) {
      throw new ForbiddenException('User profile is private');
    }

    // Check admin/moderator status early (for moderation history)
    const isViewingOwnProfile = currentUserId === userId;
    const isAdmin = currentUserId
      ? await this.userRoleService.isAdminOrModerator(currentUserId)
      : false;

    const publicProfile = this.convertToPublicUserProfileDto(unifiedProfile);

    // Get user entity to retrieve isBanned and mutedUntil status
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'isBanned', 'mutedUntil'],
    });

    if (user) {
      publicProfile.isBanned = user.isBanned;
      // Only include mutedUntil if it's in the future
      if (user.mutedUntil) {
        const now = new Date();
        publicProfile.mutedUntil = user.mutedUntil > now ? user.mutedUntil : null;
      } else {
        publicProfile.mutedUntil = null;
      }
    }

    // Get moderation history - only show to the user themselves or admins/moderators
    if (isViewingOwnProfile || isAdmin) {
      const history = await this.getModerationHistory(userId);
      const limitedHistory = isAdmin ? history : history.slice(0, 3);

      publicProfile.adminActionHistory = limitedHistory.map((item) => ({
        id: item.id,
        actionType: item.actionType,
        reason: item.reason,
        durationMinutes: item.durationMinutes,
        createdAt: item.createdAt,
        adminId: item.admin.id,
        adminUsername: item.admin.username,
        adminDisplayName: item.admin.displayName,
      }));
    }

    return publicProfile;
  }

  /**
   * Get public user profiles for multiple users in a single database query
   * Used for extending balance history with user information
   */
  async getPublicUserProfiles(
    userIds: string[],
    currentUserId?: string,
  ): Promise<PublicUserProfileDto[]> {
    if (userIds.length === 0) {
      return [];
    }

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIds)];

    // Fetch users from database
    const users = await this.usersRepository.find({
      where: { id: In(uniqueUserIds) },
    });

    // Convert to public profile DTOs, filtering out private profiles
    const result: PublicUserProfileDto[] = [];

    for (const user of users) {
      try {
        // Skip private profiles unless viewing own profile
        if (user.isPrivate && user.id !== currentUserId) {
          continue;
        }

        // Build unified profile and convert to public profile DTO
        const unifiedProfile = await this.buildUnifiedUserProfile(user, false);
        const publicProfile = this.convertToPublicUserProfileDto(unifiedProfile);
        result.push(publicProfile);
      } catch (error) {
        // Log error but continue with other users
        this.logger.warn(`Failed to build public profile for user ${user.id}:`, error);
      }
    }

    return result;
  }

  /**
   * Get simplified user profiles for search results (without statistics)
   * Used for user search endpoint to return lightweight user information
   */
  async getSearchUsersProfiles(userIds: string[]): Promise<SearchUsersResponseDto[]> {
    if (userIds.length === 0) {
      return [];
    }

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIds)];

    // Fetch users from database
    const users = await this.usersRepository.find({
      where: { id: In(uniqueUserIds) },
    });

    // Get VIP statuses for all users
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus(uniqueUserIds);
    const vipStatusMap = new Map(vipStatuses.map((status) => [status.userId, status]));

    // Convert to search response DTOs
    const result: SearchUsersResponseDto[] = [];

    for (const user of users) {
      try {
        // Skip private profiles (already filtered in search query, but double-check)
        if (user.isPrivate) {
          continue;
        }

        const vipStatus = vipStatusMap.get(user.id);
        const vipLevel = vipStatus?.vipLevel || 0;

        // Get VIP tier information
        const vipTier = await this.vipTierService.findTierByLevel(vipLevel);

        const searchResult: SearchUsersResponseDto = {
          userName: user.displayName || user.username,
          userId: user.id,
          createdAt: user.createdAt,
          avatarUrl: user.avatarUrl,
          vipLevel: {
            level: vipLevel,
            name: vipTier?.name || 'Unranked',
            imageUrl: vipTier?.imageUrl,
            percent: 0, // Progress percentage not calculated for search results to keep them lightweight
          },
        };

        result.push(searchResult);
      } catch (error) {
        // Log error but continue with other users
        this.logger.warn(`Failed to build search profile for user ${user.id}:`, error);
      }
    }

    return result;
  }

  /**
   * Enable 2FA for a user
   */
  async enable2FA(userId: string, secret: string): Promise<void> {
    await this.usersRepository.update(userId, {
      is2FAEnabled: true,
      twoFactorSecret: secret,
    });

    // Clear cached user data
    await this.invalidateUserCache(userId);
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      is2FAEnabled: false,
      twoFactorSecret: undefined,
    });

    // Clear cached user data
    await this.invalidateUserCache(userId);
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, googleData: IGoogleRegistrationData): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this Google account is already linked to another user
    const existingGoogleUser = await this.findByGoogleId(googleData.id);
    if (existingGoogleUser) {
      throw new ConflictException('This Google account is already linked to another user');
    }

    // Store Google data in a new field for linked accounts
    const updatedRegistrationData = {
      ...user.registrationData,
      linkedAccounts: {
        ...(user.registrationData as any)?.linkedAccounts,
        google: googleData,
      },
    };

    await this.usersRepository.update(userId, {
      registrationData: updatedRegistrationData,
    });

    // Clear cached user data
    await this.invalidateUserCache(userId);
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove Google data from linked accounts
    const updatedRegistrationData = {
      ...user.registrationData,
      linkedAccounts: {
        ...(user.registrationData as any)?.linkedAccounts,
        google: undefined,
      },
    };

    await this.usersRepository.update(userId, {
      registrationData: updatedRegistrationData,
    });

    // Clear cached user data
    await this.invalidateUserCache(userId);
  }

  /**
   * Check if user has Google account linked
   */
  async isGoogleLinked(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) {
      return false;
    }

    const linkedAccounts = (user.registrationData as any)?.linkedAccounts;
    return Boolean(linkedAccounts?.google);
  }

  /**
   * Get linked Google account data for user
   */
  async getLinkedGoogleData(userId: string): Promise<IGoogleRegistrationData | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    const linkedAccounts = (user.registrationData as any)?.linkedAccounts;
    return linkedAccounts?.google || null;
  }

  /**
   * Ignore a user
   */
  async ignoreUser(ignorerId: string, ignoredUserId: string): Promise<void> {
    if (ignorerId === ignoredUserId) {
      throw new ConflictException('Cannot ignore yourself');
    }

    // Check if the user being ignored exists
    const ignoredUser = await this.findById(ignoredUserId);
    if (!ignoredUser) {
      throw new NotFoundException('User to ignore not found');
    }

    // Check if already ignored
    const existingIgnore = await this.userIgnoredUserRepository.findOne({
      where: { ignorerId, ignoredUserId },
    });

    if (existingIgnore) {
      throw new ConflictException('User is already ignored');
    }

    // Create the ignore relationship
    const ignoreEntity = this.userIgnoredUserRepository.create({
      ignorerId,
      ignoredUserId,
    });

    await this.userIgnoredUserRepository.save(ignoreEntity);
    this.logger.log(`User ${ignorerId} ignored user ${ignoredUserId}`);
  }

  /**
   * Unignore a user
   */
  async unignoreUser(ignorerId: string, ignoredUserId: string): Promise<void> {
    const ignoreEntity = await this.userIgnoredUserRepository.findOne({
      where: { ignorerId, ignoredUserId },
    });

    if (!ignoreEntity) {
      throw new NotFoundException('User is not ignored');
    }

    await this.userIgnoredUserRepository.remove(ignoreEntity);
    this.logger.log(`User ${ignorerId} unignored user ${ignoredUserId}`);
  }

  /**
   * Get list of ignored users for a user
   */
  async getIgnoredUsers(userId: string): Promise<
    Array<{
      id: string;
      username: string;
      displayName?: string;
      avatarUrl?: string;
      vipLevelImage?: string;
      ignoredAt: Date;
    }>
  > {
    const ignoredRelations = await this.userIgnoredUserRepository.find({
      where: { ignorerId: userId },
      relations: ['ignoredUser'],
      order: { createdAt: 'DESC' },
    });

    if (!ignoredRelations.length) {
      return [];
    }

    const ignoredUserIds = ignoredRelations.map((relation) => relation.ignoredUser.id);
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus(ignoredUserIds);
    const vipStatusMap = new Map(
      vipStatuses.map((status) => [status.userId, status.vipLevelImage]),
    );

    return ignoredRelations.map((relation) => ({
      id: relation.ignoredUser.id,
      username: relation.ignoredUser.username,
      displayName: relation.ignoredUser.displayName,
      avatarUrl: relation.ignoredUser.avatarUrl,
      vipLevelImage: vipStatusMap.get(relation.ignoredUser.id) || undefined,
      ignoredAt: relation.createdAt,
    }));
  }

  /**
   * Check if a user is ignored by another user
   */
  async isUserIgnored(ignorerId: string, ignoredUserId: string): Promise<boolean> {
    const ignoreEntity = await this.userIgnoredUserRepository.findOne({
      where: { ignorerId, ignoredUserId },
    });

    return !!ignoreEntity;
  }

  /**
   * Get list of users who have ignored the specified user
   */
  async getIgnoringUsers(userId: string): Promise<string[]> {
    const ignoringRelations = await this.userIgnoredUserRepository.find({
      where: { ignoredUserId: userId },
      select: ['ignorerId'],
    });

    return ignoringRelations.map((relation) => relation.ignorerId);
  }

  /**
   * Filter out ignored users from a list of user IDs
   * This method can be used by chat, bet feed, and other systems
   */
  async filterIgnoredUsers(viewerId: string, userIds: string[]): Promise<string[]> {
    if (!userIds.length) {
      return [];
    }

    const ignoredUserIds = await this.userIgnoredUserRepository.find({
      where: { ignorerId: viewerId, ignoredUserId: In(userIds) },
      select: ['ignoredUserId'],
    });

    const ignoredIds = new Set(ignoredUserIds.map((rel) => rel.ignoredUserId));
    return userIds.filter((id) => !ignoredIds.has(id));
  }

  /**
   * Check if user can interact with another user (not ignored and not ignoring)
   */
  async canUsersInteract(userId1: string, userId2: string): Promise<boolean> {
    const isIgnored = await this.userIgnoredUserRepository.findOne({
      where: [
        { ignorerId: userId1, ignoredUserId: userId2 },
        { ignorerId: userId2, ignoredUserId: userId1 },
      ],
    });

    return !isIgnored;
  }

  /**
   * Upload avatar to user's gallery and set it as active
   */
  async uploadAvatarToGallery(userId: string, file: any): Promise<AvatarUploadGalleryResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 5MB.');
    }

    try {
      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExtension}`;
      const key = `avatars/${fileName}`;

      // Upload to MinIO
      const avatarUrl = await this.uploadService.uploadWithCustomKey(file, key);

      // Deactivate all current avatars for this user
      await this.userAvatarRepository.update({ userId, isActive: true }, { isActive: false });

      // Create new avatar entity and set as active
      const newAvatar = this.userAvatarRepository.create({
        id: randomUUID(),
        userId,
        avatarUrl,
        isActive: true,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      const savedAvatar = await this.userAvatarRepository.save(newAvatar);

      // Also update legacy avatarUrl field for backward compatibility
      await this.usersRepository.update(userId, { avatarUrl });

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      return {
        avatar: this.toUserAvatarDto(savedAvatar),
        message: 'Avatar uploaded and set as active successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to upload avatar to gallery for user ${userId}:`, error);
      throw new BadRequestException('Failed to upload avatar');
    }
  }

  /**
   * Get all avatars for a user (personal + default system avatars)
   * Returns a combined array with isSystem flag
   */
  async getUserAvatars(userId: string): Promise<AvatarGalleryResponseDto> {
    // Get user's personal avatars
    const userAvatars = await this.userAvatarRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Get default system avatars
    const defaultAvatars = await this.defaultAvatarService.getActiveDefaultAvatars();

    // Get user's selected default avatar (if any)
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['defaultAvatarId'],
    });

    const selectedDefaultAvatarId = user?.defaultAvatarId;

    // Combine all avatars into one array
    const combinedAvatars: UserAvatarDto[] = [];

    // Add user avatars first
    userAvatars.forEach((avatar) => {
      combinedAvatars.push({
        id: avatar.id,
        avatarUrl: avatar.avatarUrl,
        isSystem: false,
        originalFilename: avatar.originalFilename,
        fileSize: avatar.fileSize,
        mimeType: avatar.mimeType,
        createdAt: avatar.createdAt,
      });
    });

    // Add default system avatars
    defaultAvatars.forEach((defaultAvatar) => {
      combinedAvatars.push({
        id: defaultAvatar.id,
        avatarUrl: defaultAvatar.avatarUrl,
        isSystem: true,
        originalFilename: defaultAvatar.originalFilename,
        fileSize: defaultAvatar.fileSize,
        mimeType: defaultAvatar.mimeType,
        createdAt: defaultAvatar.createdAt,
      });
    });

    // Find the selected avatar ID (either user avatar or default avatar)
    let selectedAvatarId: string | undefined;
    if (selectedDefaultAvatarId) {
      selectedAvatarId = selectedDefaultAvatarId;
    } else {
      const activeUserAvatar = userAvatars.find((a) => a.isActive);
      selectedAvatarId = activeUserAvatar?.id;
    }

    return {
      avatars: combinedAvatars,
      selectedAvatarId,
    };
  }

  /**
   * Activate a specific avatar from user's gallery
   */
  async activateAvatar(userId: string, avatarId: string): Promise<ActivateAvatarResponseDto> {
    // Check if avatar exists and belongs to user
    const avatar = await this.userAvatarRepository.findOne({
      where: { id: avatarId, userId },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    if (avatar.isActive) {
      return {
        avatarId,
        message: 'Avatar is already active',
      };
    }

    try {
      // Deactivate all current avatars
      await this.userAvatarRepository.update({ userId, isActive: true }, { isActive: false });

      // Activate the selected avatar
      await this.userAvatarRepository.update(avatarId, { isActive: true });

      // Update legacy avatarUrl field and clear defaultAvatarId (switching from default to user avatar)
      await this.usersRepository.update(userId, {
        avatarUrl: avatar.avatarUrl,
      });

      // Clear default avatar selection separately to avoid TypeScript errors
      await this.usersRepository
        .createQueryBuilder()
        .update()
        .set({ defaultAvatarId: null as any })
        .where('id = :userId', { userId })
        .execute();

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      return {
        avatarId,
        message: 'Avatar activated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to activate avatar ${avatarId} for user ${userId}:`, error);
      throw new BadRequestException('Failed to activate avatar');
    }
  }

  /**
   * Delete an avatar from user's gallery
   */
  async deleteAvatar(userId: string, avatarId: string): Promise<DeleteAvatarResponseDto> {
    // Check if avatar exists and belongs to user
    const avatar = await this.userAvatarRepository.findOne({
      where: { id: avatarId, userId },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    const wasActive = avatar.isActive;

    try {
      // Delete from database
      await this.userAvatarRepository.delete(avatarId);

      // Delete file from MinIO
      const key = this.uploadService.extractKeyFromUrl(avatar.avatarUrl);
      await this.uploadService.deleteFile(key);

      // If deleted avatar was active, activate another one or clear legacy field
      if (wasActive) {
        const remainingAvatars = await this.userAvatarRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
        });

        if (remainingAvatars.length > 0) {
          // Activate the most recent remaining avatar
          const newActiveAvatar = remainingAvatars[0];
          await this.userAvatarRepository.update(newActiveAvatar.id, { isActive: true });
          await this.usersRepository.update(userId, { avatarUrl: newActiveAvatar.avatarUrl });
        } else {
          // No avatars left, clear legacy field
          await this.usersRepository.update(userId, { avatarUrl: undefined });
        }
      }

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      return {
        message: 'Avatar deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete avatar ${avatarId} for user ${userId}:`, error);
      throw new BadRequestException('Failed to delete avatar');
    }
  }

  /**
   * Activate a default system avatar for user
   * This deactivates any personal avatars and sets the default avatar reference
   */
  async activateDefaultAvatar(
    userId: string,
    dto: ActivateDefaultAvatarDto,
  ): Promise<ActivateDefaultAvatarResponseDto> {
    const { defaultAvatarId } = dto;

    // Verify default avatar exists
    const defaultAvatar = await this.defaultAvatarService.getDefaultAvatarById(defaultAvatarId);

    if (!defaultAvatar.isActive) {
      throw new BadRequestException('This default avatar is not available');
    }

    try {
      // Deactivate all personal avatars
      await this.userAvatarRepository.update({ userId, isActive: true }, { isActive: false });

      // Set default avatar reference
      await this.usersRepository.update(userId, {
        defaultAvatarId,
        avatarUrl: defaultAvatar.avatarUrl, // Update legacy field
      });

      // Invalidate user cache
      await this.invalidateUserCache(userId);

      this.logger.log(`User ${userId} activated default avatar ${defaultAvatarId}`);

      return {
        defaultAvatar: {
          id: defaultAvatar.id,
          avatarUrl: defaultAvatar.avatarUrl,
          originalFilename: defaultAvatar.originalFilename,
          fileSize: defaultAvatar.fileSize,
          mimeType: defaultAvatar.mimeType,
          displayOrder: defaultAvatar.displayOrder,
          isActive: defaultAvatar.isActive,
          description: defaultAvatar.description,
          createdAt: defaultAvatar.createdAt,
          updatedAt: defaultAvatar.updatedAt,
        },
        message: 'Default avatar activated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to activate default avatar for user ${userId}:`, error);
      throw new BadRequestException('Failed to activate default avatar');
    }
  }

  /**
   * Convert UserAvatarEntity to DTO
   */
  private toUserAvatarDto(avatar: UserAvatarEntity): UserAvatarDto {
    return {
      id: avatar.id,
      avatarUrl: avatar.avatarUrl,
      isSystem: false, // User avatars are never system avatars
      originalFilename: avatar.originalFilename,
      fileSize: avatar.fileSize,
      mimeType: avatar.mimeType,
      createdAt: avatar.createdAt,
    };
  }

  async banUser(
    userId: string,
    bannedByAdminId: string,
    durationMinutes: number,
    reason?: string,
  ): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    user.isBanned = true;
    const bannedUser = await this.usersRepository.save(user);

    const historyRecord = this.moderationHistoryRepository.create({
      userId,
      adminId: bannedByAdminId,
      actionType: ModerationActionTypeEnum.BAN,
      reason,
      durationMinutes,
    });
    await this.moderationHistoryRepository.save(historyRecord);

    this.logger.log(
      `User ${userId} banned by admin ${bannedByAdminId}${reason ? `, reason: ${reason}` : ''}`,
    );

    await this.invalidateUserCache(userId);

    return bannedUser;
  }

  async unbanUser(userId: string, unbannedByAdminId: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    const now = new Date();
    user.isBanned = false;
    const unbannedUser = await this.usersRepository.save(user);

    const activeBanHistory = await this.moderationHistoryRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.actionType = :actionType', { actionType: ModerationActionTypeEnum.BAN })
      .andWhere(
        `history."createdAt" + (history."durationMinutes" || ' minutes')::INTERVAL > :now`,
        { now },
      )
      .orderBy('history.createdAt', 'DESC')
      .getOne();

    if (activeBanHistory) {
      const actualDurationMinutes = Math.floor(
        (now.getTime() - activeBanHistory.createdAt.getTime()) / 60000,
      );
      activeBanHistory.durationMinutes = actualDurationMinutes;
      await this.moderationHistoryRepository.save(activeBanHistory);
      this.logger.log(
        `Updated ban history for user ${userId}: actual duration ${actualDurationMinutes} minutes`,
      );
    }

    this.logger.log(`User ${userId} unbanned by admin ${unbannedByAdminId}`);

    await this.invalidateUserCache(userId);

    return unbannedUser;
  }

  async getModerationHistory(userId: string): Promise<UserModerationHistoryEntity[]> {
    return this.moderationHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['admin'],
    });
  }

  async setCookieConsent(userId: string): Promise<Date | undefined> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'cookieConsentAcceptedAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Idempotent: only update if not already set
    if (!user.cookieConsentAcceptedAt) {
      const timestamp = new Date();
      await this.usersRepository.update(userId, { cookieConsentAcceptedAt: timestamp });
      await this.invalidateUserCache(userId);
      return timestamp;
    }

    // Already set, return existing timestamp
    return user.cookieConsentAcceptedAt;
  }
}
