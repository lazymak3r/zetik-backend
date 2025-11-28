import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly twilioClient?: Twilio;
  private readonly phoneNumber: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.phoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';
    this.enabled = this.configService.get<boolean>('TWILIO_ENABLED') !== false;

    if (this.enabled && accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio service initialized');
    } else {
      this.logger.warn('Twilio not configured - SMS functionality disabled');
      this.enabled = false;
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.enabled || !this.twilioClient) {
      this.logger.warn(`Twilio disabled - would send to ${to}: ${message}`);
      return true; // Return true in dev mode for testing
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.phoneNumber,
        to,
      });

      this.logger.log(`SMS sent successfully to ${to}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      return false;
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `Your Zetik verification code is: ${code}. This code expires in 10 minutes.`;
    return this.sendSMS(phoneNumber, message);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
