import { Injectable, LogLevel, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum LogLevelEnum {
  ERROR = 'error',
  WARN = 'warn',
  LOG = 'log',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly maxLength: number;
  private readonly allowedLevels: Set<LogLevel>;

  constructor(private readonly configService: ConfigService) {
    this.maxLength = this.configService.get<number>('common.logging.maxLength') || 1000;

    // In production only LOG and ERROR levels
    const isProduction = this.configService.get<boolean>('common.isProduction') || false;
    this.allowedLevels = new Set(
      isProduction
        ? (['log', 'error'] as LogLevel[])
        : (['verbose', 'debug', 'log', 'warn', 'error'] as LogLevel[]),
    );
  }

  private shouldLog(level: LogLevel): boolean {
    return this.allowedLevels.has(level);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: unknown,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}] ` : '';
    const metaStr = meta ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '';

    let formattedMessage = `${timestamp} ${level.toUpperCase()} ${contextStr}${message}${metaStr}`;

    // Truncate message if too long in production
    if (formattedMessage.length > this.maxLength) {
      const truncateStr = '... [TRUNCATED]';
      formattedMessage =
        formattedMessage.substring(0, this.maxLength - truncateStr.length) + truncateStr;
    }

    return formattedMessage;
  }

  log(message: string, context?: string, meta?: unknown): void {
    if (this.shouldLog('log')) {
      console.log(this.formatMessage('log', message, context, meta));
    }
  }

  error(message: string, context?: string, meta?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context, meta));
    }
  }

  warn(message: string, context?: string, meta?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context, meta));
    }
  }

  debug(message: string, context?: string, meta?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context, meta));
    }
  }

  verbose(message: string, context?: string, meta?: unknown): void {
    if (this.shouldLog('verbose')) {
      console.log(this.formatMessage('verbose', message, context, meta));
    }
  }

  setLogLevels(): void {
    // NestJS compatibility - not used with our custom implementation
  }
}
