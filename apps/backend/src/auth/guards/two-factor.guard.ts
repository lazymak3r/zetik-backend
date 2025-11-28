import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserEntity } from '@zetik/shared-entities';
import { REQUIRE_TWO_FACTOR_KEY } from '../decorators/require-two-factor.decorator';
import { TwoFactorValidationService } from '../services/two-factor-validation.service';

@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly twoFactorValidationService: TwoFactorValidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresTwoFactor = this.reflector.getAllAndOverride<boolean>(REQUIRE_TWO_FACTOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresTwoFactor) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;

    if (!user) {
      throw new InternalServerErrorException('Guard misconfiguration: user not found in request');
    }

    const twoFactorCode = request.body?.twoFactorCode;

    await this.twoFactorValidationService.validateUserTwoFactor(user, twoFactorCode);

    return true;
  }
}
