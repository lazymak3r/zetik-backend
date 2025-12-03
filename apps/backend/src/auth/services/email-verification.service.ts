import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MailTokenEntity, UserEntity } from '@zetik/shared-entities';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { MailTokenTypeEnum } from '../enums/mail-token-type.enum';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(MailTokenEntity)
    private readonly tokenRepo: Repository<MailTokenEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createAndSend(user: UserEntity): Promise<void> {
    // Create verification token
    const token = randomUUID();
    const expirationSec = this.configService.get<number>('mail.emailVerificationExpiration')!;
    const expiresAt = new Date(Date.now() + expirationSec * 1000);
    const record = this.tokenRepo.create({
      userId: user.id,
      token,
      expiresAt,
      type: MailTokenTypeEnum.EMAIL_VERIFICATION,
    });
    await this.tokenRepo.save(record);

    // Build verification link
    const frontendUrl = this.configService.get<string>('mail.frontendUrl')!.replace(/\/+$/, '');
    const verificationLink = `${frontendUrl}/account/profile?token=${token}`;

    // Send email using central MailgunService
    // ⚠️ DISABLED: Email sending temporarily disabled for development
    // await this.mailgunService.sendTemplateEmail(user.email!, EmailTemplateEnum.EMAIL_VERIFICATION, {
    //   username: user.username,
    //   verificationLink,
    // });
    console.log(`[DISABLED] Email verification link: ${verificationLink}`);
  }

  async verify(token: string): Promise<void> {
    const record = await this.tokenRepo.findOne({
      where: { token, type: MailTokenTypeEnum.EMAIL_VERIFICATION },
      relations: ['user'],
    });
    if (!record || record.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired verification token');
    }
    const user = record.user;
    user.isEmailVerified = true;
    await this.tokenRepo.manager.save(user);
    await this.tokenRepo.remove(record);
  }
}
