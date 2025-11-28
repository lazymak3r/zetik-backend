import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@zetik/shared-entities';
import { EmailNotificationService } from './email-notification.service';
import { MailgunService } from './mailgun.service';

/**
 * Central email module for sending emails via Mailgun
 * Provides MailgunService for all email operations
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([UserEntity])],
  providers: [MailgunService, EmailNotificationService],
  exports: [MailgunService, EmailNotificationService],
})
export class EmailModule {}
