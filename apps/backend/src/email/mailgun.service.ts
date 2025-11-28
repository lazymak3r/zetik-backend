/* eslint-disable @typescript-eslint/no-require-imports */
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplateEnum } from './email-templates.enum';

// Static requires for FormData and Mailgun (CJS modules)
const FormData = require('form-data');
const Mailgun = require('mailgun.js');

/**
 * Central Mailgun service for sending templated emails
 * Provides a single point of integration with Mailgun SDK
 */
@Injectable()
export class MailgunService {
  private readonly logger = new Logger(MailgunService.name);

  constructor(private readonly configService: ConfigService) {
    this.validateConfig();
  }

  /**
   * Validate that all required Mailgun configuration values are present
   * Throws error at startup if any required config is missing
   */
  private validateConfig(): void {
    const required = ['mail.mailgunApiKey', 'mail.mailgunDomain', 'mail.mailgunFrom'];
    const missing = required.filter((key) => !this.configService.get<string>(key));

    if (missing.length > 0) {
      throw new Error(`Missing required Mailgun configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Send a templated email using Mailgun
   * @param to Recipient email address
   * @param templateName Template name from EmailTemplateEnum
   * @param variables Template variables as key-value pairs
   * @throws HttpException if email sending fails
   */
  async sendTemplateEmail(
    to: string,
    templateName: EmailTemplateEnum,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('mail.mailgunApiKey')!;
    const domain = this.configService.get<string>('mail.mailgunDomain')!;
    const from = this.configService.get<string>('mail.mailgunFrom')!;

    // Initialize Mailgun SDK
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: 'api',
      key: apiKey,
      url: this.configService.get<string>('mail.mailgunBaseUrl') || 'https://api.mailgun.net',
    });

    try {
      const result = await mg.messages.create(domain, {
        from,
        to,
        template: templateName,
        'h:X-Mailgun-Variables': JSON.stringify(variables),
        'h:List-Unsubscribe': `<mailto:unsubscribe@${domain}>`,
      });

      this.logger.log(
        `Email sent successfully to ${to} using template ${templateName}. Response: ${JSON.stringify(result)}`,
      );
    } catch (err) {
      const errorInfo = err as {
        status?: number;
        message?: string;
        details?: string;
      };

      // Log full error including non-enumerable props
      this.logger.error(
        `Mailgun send error for template ${templateName} to ${to}: ${JSON.stringify(errorInfo, Object.getOwnPropertyNames(errorInfo))}`,
      );

      const statusCode: number = typeof errorInfo.status === 'number' ? errorInfo.status : 500;
      throw new HttpException(
        {
          status: errorInfo.status,
          message: errorInfo.message || 'Failed to send email',
          details: errorInfo.details,
        },
        statusCode,
      );
    }
  }
}
