import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AdminEntity } from '@zetik/shared-entities';

interface RequestWithAdmin extends Express.Request {
  user?: AdminEntity;
}

export const CurrentAdmin = createParamDecorator(
  (data: keyof AdminEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = request.user;

    return data ? admin?.[data] : admin;
  },
);
