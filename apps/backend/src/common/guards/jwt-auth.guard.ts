import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check if handler (method) has @Public decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public endpoints: try to load JWT if present, but don't require it
      const result = super.canActivate(context);

      if (result instanceof Observable) {
        return result.pipe(catchError(() => of(true)));
      } else if (result instanceof Promise) {
        return result.catch(() => true);
      }

      return result;
    }

    // For non-public endpoints: require valid JWT
    return super.canActivate(context);
  }
}
