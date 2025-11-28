import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';

export interface RequestWithUser extends Request {
  user?: UserEntity;
  rawBody: Buffer;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error('User not found in request');
    }
    return request.user;
  },
);

export const CurrentUserOptional = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
