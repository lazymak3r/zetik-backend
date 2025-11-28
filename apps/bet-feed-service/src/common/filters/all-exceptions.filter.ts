import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Global exception filter for Bet Feed Service
 * Catches all unhandled exceptions and prevents process crashes
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      // Safe handling of getResponse() which can return string or object
      const responseData = exception.getResponse();
      if (typeof responseData === 'string') {
        message = responseData;
      } else if (typeof responseData === 'object' && responseData !== null) {
        const responseObj = responseData as any;
        message = responseObj.message || responseObj.error || 'Bad request';
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
      // In production, don't expose internal error details
      message = isProduction ? 'Internal server error' : exception.message;
    } else {
      this.logger.error('Unknown exception:', exception);
    }

    // Don't crash the process - send error response
    if (response.headersSent) {
      return super.catch(exception, host);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
