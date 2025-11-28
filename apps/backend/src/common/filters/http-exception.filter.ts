import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { commonConfig } from '../../config/common.config';
import { LoggerService } from '../services/logger.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | object;
  errorId?: string;
  code?: string | number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly isProduction = commonConfig().isProduction;

  constructor(private readonly logger?: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorId = randomUUID();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let shouldExposeError = false;
    let isBetByError = false;

    // Determine error status and message based on exception type
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Safe exceptions that can be exposed to client
      if (
        exception instanceof BadRequestException ||
        exception instanceof UnauthorizedException ||
        exception instanceof ForbiddenException ||
        exception instanceof NotFoundException ||
        exception instanceof ConflictException
      ) {
        shouldExposeError = true;
        message = exceptionResponse;

        if (typeof exceptionResponse === 'object' && 'bet_error' in exceptionResponse) {
          isBetByError = true;
        }
      } else {
        // Other HTTP exceptions - log but don't expose details
        message = this.getSafeErrorMessage(status);
      }
    } else if (exception instanceof Error) {
      // Handle specific error types that might leak information
      if (
        exception.message.includes('duplicate key value') ||
        exception.message.includes('violates unique constraint')
      ) {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        shouldExposeError = true;
      } else if (exception.message.includes('foreign key constraint')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference';
        shouldExposeError = true;
      } else {
        // Database or system errors - don't expose details
        message = this.getSafeErrorMessage(status);
      }
    }

    // Comprehensive logging with error ID for correlation
    const authenticatedRequest = request as AuthenticatedRequest;
    const logContext = {
      errorId,
      method: request.method,
      url: request.url,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      userId: authenticatedRequest.user?.id,
      body: this.sanitizeRequestBody(request.body),
      query: request.query,
      params: request.params,
    };

    // Use custom logger only in production
    if (this.isProduction && this.logger) {
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `Server Error [${errorId}]: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
          'GlobalExceptionFilter',
          {
            ...logContext,
            stack: exception instanceof Error ? exception.stack : undefined,
            exception: exception instanceof Error ? exception.name : typeof exception,
          },
        );
      } else if (status >= HttpStatus.BAD_REQUEST) {
        this.logger.warn(
          `Client Error [${errorId}]: ${exception instanceof Error ? exception.message : 'Client error'}`,
          'GlobalExceptionFilter',
          logContext,
        );
      } else {
        this.logger.log(
          `Request Error [${errorId}]: Unexpected status ${status}`,
          'GlobalExceptionFilter',
          logContext,
        );
      }
    } else {
      // In development use standard console for NestJS logger compatibility
      const logMessage = `[${errorId}] ${exception instanceof Error ? exception.message : 'Unknown error'}`;
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        console.error(`Server Error: ${logMessage}`, logContext);
      } else if (status >= HttpStatus.BAD_REQUEST) {
        console.warn(`Client Error: ${logMessage}`, logContext);
      } else {
        console.log(`Request Error: ${logMessage}`, logContext);
      }
    }

    // Prepare response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: shouldExposeError || !this.isProduction ? message : this.getSafeErrorMessage(status),
    };

    if (isBetByError) {
      Object.assign(errorResponse, {
        code: typeof message === 'object' && 'code' in message ? message.code : undefined,
        message: typeof message === 'object' && 'message' in message ? message.message : message,
      });
    }

    // Include error ID in production for support correlation
    if (this.isProduction && status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.errorId = errorId;
    }

    response.status(status).json(errorResponse);
  }

  private getSafeErrorMessage(status: HttpStatus): string {
    const statusMessages: Partial<Record<HttpStatus, string>> = {
      [HttpStatus.BAD_REQUEST]: 'Invalid request',
      [HttpStatus.UNAUTHORIZED]: 'Authentication required',
      [HttpStatus.FORBIDDEN]: 'Access denied',
      [HttpStatus.NOT_FOUND]: 'Resource not found',
      [HttpStatus.CONFLICT]: 'Resource conflict',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
    };

    return statusMessages[status] || 'Internal server error';
  }

  private sanitizeRequestBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    const sanitized = { ...(body as Record<string, unknown>) };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
