import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;

    const now = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - now;

        this.logger.log(
          `Outgoing Response: ${method} ${url} - Status: ${response.statusCode} - ${responseTime}ms`,
        );

        if (data && typeof data === 'object') {
          const responseBody = JSON.stringify(data).substring(0, 1000);
          this.logger.debug(`Response Body: ${responseBody}`);
        }
      }),
    );
  }
}
