import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PhoneVerificationEntity, UserEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UserCacheService } from '../../common/services/user-cache.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);
  private readonly CODE_LENGTH = 6;
  private readonly CODE_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_MINUTES = 1; // Minimum time between code requests

  constructor(
    @InjectRepository(PhoneVerificationEntity)
    private readonly phoneVerificationRepository: Repository<PhoneVerificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly twilioService: TwilioService,
    @Inject(forwardRef(() => UserCacheService))
    private readonly userCacheService: UserCacheService,
  ) {}

  /**
   * Send verification code to phone number
   */
  async sendVerificationCode(userId: string, phoneNumber: string): Promise<void> {
    // Check if phone number is already verified by another user
    const existingUser = await this.userRepository.findOne({
      where: { phoneNumber, isPhoneVerified: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('This phone number is already verified by another user');
    }

    // Check rate limiting - prevent spam
    const recentCode = await this.phoneVerificationRepository.findOne({
      where: { userId, phoneNumber },
      order: { createdAt: 'DESC' },
    });

    if (recentCode) {
      const timeSinceLastCode = Date.now() - recentCode.createdAt.getTime();
      const minTimeBetweenCodes = this.RATE_LIMIT_MINUTES * 60 * 1000;

      if (timeSinceLastCode < minTimeBetweenCodes) {
        const waitSeconds = Math.ceil((minTimeBetweenCodes - timeSinceLastCode) / 1000);
        throw new BadRequestException(
          `Please wait ${waitSeconds} seconds before requesting another code`,
        );
      }
    }

    // Generate 6-digit code
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

    // Save verification code to database
    const verification = this.phoneVerificationRepository.create({
      userId,
      phoneNumber,
      code,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });

    await this.phoneVerificationRepository.save(verification);

    // Send SMS
    const smsSent = await this.twilioService.sendVerificationCode(phoneNumber, code);

    if (!smsSent) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}`);
      throw new InternalServerErrorException(
        'Failed to send verification code. Please try again later.',
      );
    }

    this.logger.log(`Verification code sent to ${phoneNumber} for user ${userId}`);
  }

  /**
   * Verify code and mark phone as verified
   */
  async verifyCode(userId: string, phoneNumber: string, code: string): Promise<boolean> {
    // Find the most recent non-used verification for this user and phone
    const verification = await this.phoneVerificationRepository.findOne({
      where: { userId, phoneNumber, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!verification) {
      throw new BadRequestException('No verification code found for this phone number');
    }

    // Check if code expired
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    // Check max attempts
    if (verification.attempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new code',
      );
    }

    // Increment attempts
    verification.attempts += 1;
    await this.phoneVerificationRepository.save(verification);

    // Verify code
    if (verification.code !== code) {
      const attemptsLeft = this.MAX_ATTEMPTS - verification.attempts;
      throw new BadRequestException(
        `Invalid verification code. ${attemptsLeft} attempt(s) remaining`,
      );
    }

    // Mark verification as used
    verification.isUsed = true;
    await this.phoneVerificationRepository.save(verification);

    // Update user phone verification status
    await this.userRepository.update(
      { id: userId },
      {
        phoneNumber,
        isPhoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    );

    // Invalidate user cache to ensure fresh data
    await this.userCacheService.invalidateAllUserCaches(userId);

    this.logger.log(`Phone ${phoneNumber} verified for user ${userId}`);
    return true;
  }

  /**
   * Check if phone number is already verified
   */
  async isPhoneVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['isPhoneVerified'],
    });

    return user?.isPhoneVerified || false;
  }

  /**
   * Remove phone number from user
   */
  async removePhoneNumber(userId: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      {
        phoneNumber: undefined,
        isPhoneVerified: false,
        phoneVerifiedAt: undefined,
      },
    );

    // Invalidate user cache to ensure fresh data
    await this.userCacheService.invalidateAllUserCaches(userId);

    this.logger.log(`Phone number removed for user ${userId}`);
  }

  /**
   * Generate random 6-digit code
   */
  private generateCode(): string {
    const min = Math.pow(10, this.CODE_LENGTH - 1);
    const max = Math.pow(10, this.CODE_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Clean up expired verification codes (run periodically)
   */
  async cleanupExpiredCodes(): Promise<void> {
    const result = await this.phoneVerificationRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired verification codes`);
    }
  }
}
