import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService, ILogAdminActionInput } from '../services/audit-log.service';

interface IRequestWithAuditData extends Request {
  auditData?: ILogAdminActionInput;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<IRequestWithAuditData>();

    return next.handle().pipe(
      tap(() => {
        if (request.auditData) {
          void this.auditLogService.logAdminAction(request.auditData).catch((error) => {
            console.error('Failed to log admin action:', error);
          });
        }
      }),
    );
  }
}
