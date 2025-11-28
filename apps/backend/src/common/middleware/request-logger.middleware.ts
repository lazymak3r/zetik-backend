import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { LoggerService } from '../services/logger.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
  };
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly requestLoggingEnabled: boolean;

  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    const isProduction = this.configService.get<boolean>('common.isProduction') || false;
    this.requestLoggingEnabled = isProduction
      ? this.configService.get<boolean>('common.logging.requestLogging') || false
      : false; // In development disable custom request logging
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.requestLoggingEnabled) {
      next();
      return;
    }

    const startTime = Date.now();
    const authenticatedRequest = req as AuthenticatedRequest;

    // Mask sensitive data from request body for security
    const body = req.body as Record<string, unknown>;
    const maskedBody: Record<string, unknown> = { ...body };
    if ('password' in maskedBody) maskedBody.password = '****';
    if ('passwordHash' in maskedBody) maskedBody.passwordHash = '****';
    if ('token' in maskedBody) maskedBody.token = '****';

    // Log request start
    const requestId = this.generateRequestId();
    const requestInfo = {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: authenticatedRequest.user?.id,
      contentLength: req.get('Content-Length'),
      ...(Object.keys(maskedBody).length > 0 && { body: maskedBody }),
      ...(Object.keys(req.query).length > 0 && { query: req.query }),
    };

    this.logger.debug(`HTTP Request Started`, 'RequestLogger', requestInfo);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseInfo = {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        userId: authenticatedRequest.user?.id,
      };

      if (res.statusCode >= 500) {
        this.logger.error(`HTTP Request Failed`, 'RequestLogger', responseInfo);
      } else if (res.statusCode >= 400) {
        this.logger.warn(`HTTP Request Client Error`, 'RequestLogger', responseInfo);
      } else {
        this.logger.debug(`HTTP Request Completed`, 'RequestLogger', responseInfo);
      }
    });

    next();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
