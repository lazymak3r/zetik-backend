import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { Request } from 'express';

interface IAdminUser {
  id: string;
  email: string;
}

interface IRequestWithUser extends Request {
  user?: IAdminUser;
  auditData?: IAuditData;
}

interface IAuditData {
  adminId: string;
  adminEmail: string;
  action: AdminActionTypeEnum;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

export interface IAuditOptions {
  action: AdminActionTypeEnum;
  resource: string;
  getResourceId?: (args: unknown[]) => string;
  getDetails?: (args: unknown[], result?: unknown) => Record<string, unknown>;
}

export const AuditLog = (options: IAuditOptions) => {
  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const request = args.find(
        (arg): arg is IRequestWithUser => typeof arg === 'object' && arg !== null && 'user' in arg,
      );
      const admin = request?.user;

      if (!admin) {
        return method.apply(this, args);
      }

      try {
        const result = await method.apply(this, args);

        const auditData: IAuditData = {
          adminId: admin.id,
          adminEmail: admin.email,
          action: options.action,
          resource: options.resource,
          resourceId: options.getResourceId?.(args),
          details: options.getDetails?.(args, result),
          ipAddress: request?.ip || 'unknown',
          userAgent: request?.get('user-agent') || 'unknown',
        };

        if (request) {
          request.auditData = auditData;
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const auditData: IAuditData = {
          adminId: admin.id,
          adminEmail: admin.email,
          action: options.action,
          resource: options.resource,
          resourceId: options.getResourceId?.(args),
          details: { error: errorMessage, ...options.getDetails?.(args) },
          ipAddress: request?.ip || 'unknown',
          userAgent: request?.get('user-agent') || 'unknown',
        };

        if (request) {
          request.auditData = auditData;
        }
        throw error;
      }
    };

    return descriptor;
  };
};

export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IAdminUser | undefined => {
    const request = ctx.switchToHttp().getRequest<IRequestWithUser>();
    return request.user;
  },
);
