import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordUtil } from '@zetik/common';
import { MailTokenEntity, UserEntity } from '@zetik/shared-entities';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { MailTokenTypeEnum } from '../enums/mail-token-type.enum';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(MailTokenEntity)
    private readonly tokenRepo: Repository<MailTokenEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createAndSend(user: UserEntity): Promise<void> {
    // Create password reset token
    const token = randomUUID();
    const expirationSec = this.configService.get<number>('mail.passwordResetExpiration')!;
    const expiresAt = new Date(Date.now() + expirationSec * 1000);
    const record = this.tokenRepo.create({
      userId: user.id,
      token,
      expiresAt,
      type: MailTokenTypeEnum.PASSWORD_RESET,
    });
    await this.tokenRepo.save(record);

    // Build password reset link
    const frontendUrl = this.configService.get<string>('mail.frontendUrl')!.replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/?modal=reset-password&token=${token}`;

    // Send email using central MailgunService
    // ⚠️ DISABLED: Email sending temporarily disabled for development
    // await this.mailgunService.sendTemplateEmail(user.email!, EmailTemplateEnum.PASSWORD_RESET, {
    //   username: user.username,
    //   resetLink,
    // });
    console.log(`[DISABLED] Password reset link: ${resetLink}`);
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const record = await this.tokenRepo.findOne({
      where: { token, type: MailTokenTypeEnum.PASSWORD_RESET },
      relations: ['user'],
    });
    if (!record || record.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired password reset token');
    }
    const user = record.user;
    const passwordHash = await PasswordUtil.hash(newPassword);
    const regData = user.registrationData as {
      email: string;
      passwordHash: string;
      isEmailVerified: boolean;
    };
    regData.passwordHash = passwordHash;
    await this.tokenRepo.manager.save(user);
    await this.tokenRepo.remove(record);
  }
}
