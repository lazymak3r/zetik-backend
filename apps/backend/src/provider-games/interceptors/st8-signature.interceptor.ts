import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { SignatureUtils } from '@zetik/common';
import { Observable, of } from 'rxjs';
import { RequestWithUser } from '../../common/decorators/current-user.decorator';
import { providerGamesConfig } from '../../config/provider-games.config';
import { St8ResponseStatusEnum } from '../enums/st8.enum';

@Injectable()
export class St8SignatureInterceptor implements NestInterceptor {
  private readonly logger = new Logger(St8SignatureInterceptor.name);
  private readonly publicKey = Buffer.from(
    providerGamesConfig().st8.apiPublicKey,
    'base64',
  ).toString();
  private readonly signatureHeader = providerGamesConfig().signatureHeader;

  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.SKIP_ST8_SIGNATURE_CHECK === 'true') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          '🚨 SECURITY CRITICAL: Cannot skip ST8 signature check in production environment',
        );
        return of({ status: St8ResponseStatusEnum.AUTH_FAILED });
      }
      this.logger.warn(
        '⚠️ SECURITY WARNING: Skipping ST8 signature verification (DEVELOPMENT ONLY)',
      );
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const signature = String(request.headers[this.signatureHeader]);
    const rawBody = request.rawBody;

    if (!signature) {
      this.logger.warn(`Missing ${this.signatureHeader} header`);
      return of({ status: St8ResponseStatusEnum.AUTH_FAILED });
    }

    if (!rawBody) {
      this.logger.warn('Missing raw body');
      return of({ status: St8ResponseStatusEnum.AUTH_FAILED });
    }

    if (!SignatureUtils.verifySignature(this.publicKey, rawBody.toString(), signature)) {
      this.logger.warn('Invalid signature');
      return of({ status: St8ResponseStatusEnum.AUTH_FAILED });
    }

    return next.handle();
  }
}
