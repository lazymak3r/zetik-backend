import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { sportsbookConfig } from '../../config/sportsbook.config';

@Injectable()
export class BetbyJwtInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { body: any; betbyPayload?: any }>();

    // Allow /sportsbook/betby/ping and /sportsbook/betby/token/generate without JWT
    const url = (request as any).url as string | undefined;

    if (
      url &&
      (url.includes('/sportsbook/betby/ping') || url.includes('/sportsbook/betby/token/generate'))
    ) {
      return next.handle();
    }

    const body: any = (request as any).body;
    if (!body || typeof body !== 'object' || typeof body.payload !== 'string') {
      throw new BadRequestException('Missing Betby payload');
    }

    // Read Betby public key from config and normalize to PEM
    const cfg = sportsbookConfig().betby;
    const rawPub = cfg.publicKey;
    let publicKeyPem = rawPub;
    try {
      if (!rawPub.includes('BEGIN PUBLIC KEY')) {
        publicKeyPem = Buffer.from(rawPub, 'base64').toString();
      }
    } catch {
      // keep as-is if decoding fails
    }

    try {
      const decoded = this.jwtService.verify(body.payload, {
        algorithms: ['RS256'],
        clockTolerance: 15, // seconds
        secret: publicKeyPem,
      });

      if (!decoded || typeof decoded !== 'object') {
        throw new UnauthorizedException('Invalid JWT token');
      }

      const payload = decoded.payload ?? decoded;
      (request as any).betbyPayload = payload;

      (request as any).body = payload;
    } catch {
      throw new UnauthorizedException('Invalid JWT token');
    }

    return next.handle();
  }
}
