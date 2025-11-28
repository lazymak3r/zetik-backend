// apps/backend/src/email/email-notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionStatusEnum, UserEntity, WithdrawStatusEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { EmailTemplateEnum } from './email-templates.enum';
import { MailgunService } from './mailgun.service';

export interface WithdrawalNotificationData {
  requestId: string;
  asset: string;
  amount: string;
  networkFee?: string;
  toAddress: string;
  status: WithdrawStatusEnum;
  reason?: string;
  transactionId?: string;
  txHash?: string;
}

export interface DepositNotificationData {
  transactionId: string;
  asset: string;
  amount: string;
  address: string;
  status: TransactionStatusEnum;
  networkFee?: string;
  txHash?: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(
    private readonly mailgunService: MailgunService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Send withdrawal status notification
   */
  async sendWithdrawalNotification(
    userId: string,
    data: WithdrawalNotificationData,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.email) {
        this.logger.warn(`User ${userId} not found or has no email for withdrawal notification`);
        return;
      }

      const template = this.getWithdrawalTemplate(data.status);
      const variables = this.buildWithdrawalVariables(user, data);

      await this.mailgunService.sendTemplateEmail(user.email, template, variables);

      this.logger.log(
        `Withdrawal ${data.status} email sent to ${user.email} for request ${data.requestId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send withdrawal email to user ${userId}:`, error);
      // Don't throw - email failure shouldn't break the main flow
    }
  }

  /**
   * Send deposit status notification
   */
  async sendDepositNotification(userId: string, data: DepositNotificationData): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user || !user.email) {
        this.logger.warn(`User ${userId} not found or has no email for deposit notification`);
        return;
      }

      const template = this.getDepositTemplate(data.status);
      const variables = this.buildDepositVariables(user, data);

      await this.mailgunService.sendTemplateEmail(user.email, template, variables);

      this.logger.log(
        `Deposit ${data.status} email sent to ${user.email} for transaction ${data.transactionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send deposit email to user ${userId}:`, error);
      // Don't throw - email failure shouldn't break the main flow
    }
  }

  private getWithdrawalTemplate(status: WithdrawStatusEnum): EmailTemplateEnum {
    const templateMap: Record<WithdrawStatusEnum, EmailTemplateEnum> = {
      [WithdrawStatusEnum.PENDING]: EmailTemplateEnum.WITHDRAWAL_PENDING,
      [WithdrawStatusEnum.PROCESSING]: EmailTemplateEnum.WITHDRAWAL_PROCESSING,
      [WithdrawStatusEnum.APPROVED]: EmailTemplateEnum.WITHDRAWAL_APPROVED,
      [WithdrawStatusEnum.REJECTED]: EmailTemplateEnum.WITHDRAWAL_REJECTED,
      [WithdrawStatusEnum.SENT]: EmailTemplateEnum.WITHDRAWAL_SENT,
      [WithdrawStatusEnum.FAILED]: EmailTemplateEnum.WITHDRAWAL_FAILED,
    };

    return templateMap[status];
  }

  private getDepositTemplate(status: TransactionStatusEnum): EmailTemplateEnum {
    const templateMap: Record<TransactionStatusEnum, EmailTemplateEnum> = {
      [TransactionStatusEnum.PENDING]: EmailTemplateEnum.DEPOSIT_PENDING,
      [TransactionStatusEnum.CONFIRMED]: EmailTemplateEnum.DEPOSIT_CONFIRMED,
      [TransactionStatusEnum.FAILED]: EmailTemplateEnum.DEPOSIT_FAILED,
      [TransactionStatusEnum.COMPLETED]: EmailTemplateEnum.DEPOSIT_COMPLETED,
    };

    return templateMap[status];
  }

  private buildWithdrawalVariables(user: UserEntity, data: WithdrawalNotificationData) {
    const baseVariables = {
      username: user.username,
      requestId: data.requestId,
      asset: data.asset,
      amount: data.amount,
      toAddress: this.maskAddress(data.toAddress),
      networkFee: data.networkFee || '0',
      transactionId: data.transactionId || 'N/A',
      txHash: data.txHash || 'Pending',
      timestamp: new Date().toISOString(),
    };

    // Add status-specific variables
    switch (data.status) {
      case WithdrawStatusEnum.REJECTED:
      case WithdrawStatusEnum.FAILED:
        return {
          ...baseVariables,
          reason: data.reason || 'Please contact support for more information.',
        };
      default:
        return baseVariables;
    }
  }

  private buildDepositVariables(user: UserEntity, data: DepositNotificationData) {
    return {
      username: user.username,
      transactionId: data.transactionId,
      asset: data.asset,
      amount: data.amount,
      address: this.maskAddress(data.address),
      networkFee: data.networkFee || '0',
      txHash: data.txHash || 'Pending',
      timestamp: new Date().toISOString(),
    };
  }

  private maskAddress(address: string): string {
    if (address.length <= 16) return address;
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  }
}
